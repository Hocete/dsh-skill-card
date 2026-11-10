/**
 * 读取 DSH 的工作空间列表，得到「项目根」候选。
 *
 * DSH 把工作空间记录在 <dshHome>/storages/workspace.json：
 * `{ unit, global, tables: { workspaces: { <id>: { path, title, sessionIds, ... } } } }`。
 * 卡库的「项目技能」用这份列表定位项目 —— 只认已打开会话的话，没在某个项目里开会话
 * 就永远看不到那个项目的技能；`title` 也正好是界面上项目下拉要显示的名字。
 *
 * 这份文件是 DSH 的内部存储，格式可能随版本变化：解析不出来就返回空数组，
 * 让调用方退回到「已打开会话」这一路，绝不能让整个列表接口挂掉。
 */
import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

/**
 * 从 workspace.json 的文本中解析出工作空间条目。
 *
 * @param text workspace.json 全文
 * @returns 去重后的 [{ path, title }]（保持文件中的顺序）；解析失败返回空数组
 */
export function parseWorkspaces(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? ''));
  } catch {
    return [];
  }
  const table = parsed !== null && typeof parsed === 'object' ? parsed.tables?.workspaces : undefined;
  if (table === null || typeof table !== 'object' || Array.isArray(table)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of Object.values(table)) {
    if (entry === null || typeof entry !== 'object') continue;
    const raw = typeof entry.path === 'string' ? entry.path.trim() : '';
    if (raw === '') continue;
    let path;
    try {
      path = resolve(raw);
    } catch {
      continue;
    }
    if (seen.has(path)) continue;
    seen.add(path);
    const title = typeof entry.title === 'string' && entry.title.trim() !== '' ? entry.title.trim() : basename(path);
    out.push({ path, title });
  }
  return out;
}

/**
 * 从 workspace.json 的文本中解析出工作空间根目录。
 *
 * @param text workspace.json 全文
 * @returns 去重后的工作空间绝对路径（保持文件中的顺序）；解析失败返回空数组
 */
export function parseWorkspaceRoots(text) {
  return parseWorkspaces(text).map((item) => item.path);
}

/**
 * 读取本机 DSH 的工作空间条目。
 *
 * @param dshHome DSH 主目录（例如 C:\\Users\\<用户>\\.dsh）
 * @returns [{ path, title }]；文件缺失或损坏时返回空数组
 */
export async function readWorkspaces(dshHome) {
  if (typeof dshHome !== 'string' || dshHome === '') return [];
  let text;
  try {
    text = await readFile(join(dshHome, 'storages', 'workspace.json'), 'utf8');
  } catch {
    return [];
  }
  return parseWorkspaces(text);
}

/**
 * 读取本机 DSH 的工作空间根目录。
 *
 * @param dshHome DSH 主目录（例如 C:\\Users\\<用户>\\.dsh）
 * @returns 去重后的工作空间绝对路径；文件缺失或损坏时返回空数组
 */
export async function readWorkspaceRoots(dshHome) {
  return (await readWorkspaces(dshHome)).map((item) => item.path);
}
