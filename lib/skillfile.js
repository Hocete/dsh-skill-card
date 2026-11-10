/**
 * 技能文件写操作：可写性判定、描述写回、删除、新建。
 *
 * 铁律：卡片属性（分类/稀有度/星数/五维/标签/美术配方）**永不**写进 skill 文件，
 * 本模块只处理 SKILL.md 自身的描述字段与技能文件的生命周期。
 */
import { constants } from 'node:fs';
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { isSkillName, normalizeBody, splitSkillDocument } from './scan.js';

/** 二次确认框里统计目录文件数时的上限，避免超大目录拖慢请求。 */
const MAX_COUNT_FILES = 500;

/** 单条技能描述的最大长度，防止写入异常大的 frontmatter。 */
const MAX_DESCRIPTION_LENGTH = 4000;

/** 单个技能正文的最大长度（字符），防止把异常大的内容写进 SKILL.md。 */
const MAX_BODY_LENGTH = 200000;

/** 新建技能时的文件名。 */
const SKILL_FILE_NAME = 'SKILL.md';

/**
 * 判断 child 路径是否位于 parent 目录之内（含相等的情况）。
 *
 * @param parent 父目录绝对路径
 * @param child 子路径绝对路径
 * @returns child 是否在 parent 之内
 */
export function isInside(parent, child) {
  const rel = relative(resolve(parent), resolve(child));
  if (rel === '') return true;
  return !rel.startsWith('..' + sep) && rel !== '..' && !/^[A-Za-z]:/.test(rel);
}

/**
 * 探测一个技能是否可写，并给出不可写时的具体原因。
 *
 * 判定顺序（原因文案对应用户确认过的三类）：
 * 1. app.asar 内置资源 → 应用目录只读（来源为 bundled 却没有路径的内置技能也算这一类）
 * 2. node_modules 里的插件包 → 属于插件内容
 * 3. 符号链接 → 改动会影响链接目标
 * 4. 实际写权限探测失败 → 没有写权限
 * 5. 是目录形态且需要删除整个目录时，目录也必须可写
 *
 * @param skill 技能记录（需要 path / directory / linked）
 * @returns { writable, code, reason }
 */
export async function probeWritable(skill) {
  const file = typeof skill?.path === 'string' ? skill.path : '';
  if (file === '') {
    if (skill?.level === 'bundled') {
      return {
        writable: false,
        code: 'asar',
        reason: '该技能由 DSH 内置提供，打包在应用内置资源（app.asar）中，应用目录只读，无法修改或删除。',
      };
    }
    return { writable: false, code: 'no-path', reason: '无法定位该技能的文件路径，可能是运行时注册的临时技能。' };
  }
  const lower = file.toLowerCase();
  if (lower.includes('app.asar')) {
    return {
      writable: false,
      code: 'asar',
      reason: '该技能打包在 DSH 应用内置资源（app.asar）中，应用目录只读，无法修改或删除。',
    };
  }
  if (lower.includes(sep + 'node_modules' + sep)) {
    const owner = ownerPackageName(file);
    return {
      writable: false,
      code: 'node-modules',
      reason: owner === ''
        ? '该技能位于 node_modules 内的插件包中，属于插件内容，修改或删除会破坏该插件；如需移除请卸载对应插件。'
        : '该技能由已安装的插件包 ' + owner + ' 提供，属于插件内容，修改或删除会破坏该插件；如需移除请卸载该插件。',
    };
  }
  if (skill?.linked === true) {
    return { writable: false, code: 'symlink', reason: '该技能是符号链接，改动会影响链接指向的真实文件，插件不会修改它。' };
  }
  try {
    await access(file, constants.W_OK);
  } catch {
    return { writable: false, code: 'permission', reason: '当前用户对该路径没有写权限：' + file };
  }
  return { writable: true, code: 'ok', reason: '' };
}

/**
 * 从 node_modules 路径里提取所属的包名。
 *
 * @param file 技能文件绝对路径
 * @returns 包名；无法识别时返回空串
 */
function ownerPackageName(file) {
  const marker = sep + 'node_modules' + sep;
  const index = file.lastIndexOf(marker);
  if (index < 0) return '';
  const rest = file.slice(index + marker.length).split(sep);
  if (rest.length === 0) return '';
  if (rest[0].startsWith('@') && rest.length >= 2) return rest[0] + '/' + rest[1];
  return rest[0];
}

/**
 * 统计技能目录内的文件数量（用于删除前的二次确认提示）。
 *
 * @param dir 技能目录绝对路径
 * @returns 文件数量；目录不存在或不可读时返回 0
 */
export async function countFiles(dir) {
  if (typeof dir !== 'string' || dir === '') return 0;
  let total = 0;
  const stack = [dir];
  while (stack.length > 0 && total < MAX_COUNT_FILES) {
    const current = stack.pop();
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (total >= MAX_COUNT_FILES) break;
      if (entry.isDirectory()) stack.push(join(current, entry.name));
      else total += 1;
    }
  }
  return total;
}

/**
 * 把描述写回 SKILL.md 的 frontmatter，只替换 description 一处。
 *
 * 除 description 之外的所有内容（其它键、键序、注释、正文、换行风格）逐字保留，
 * 绝不重新序列化整个文件 —— 这是「外科手术式修改」在本模块的落地。
 *
 * @param content SKILL.md 全文
 * @param description 新描述
 * @returns 新的 SKILL.md 全文
 */
export function rewriteDescription(content, description) {
  const text = String(content ?? '');
  const value = yamlDoubleQuote(String(description ?? '').trim());
  const open = /^---[ \t]*\r?\n/.exec(text);
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  if (open === null) {
    return '---' + eol + 'description: ' + value + eol + '---' + eol + eol + text;
  }
  const bodyStart = open[0].length;
  const close = /^---[ \t]*\r?$/m.exec(text.slice(bodyStart));
  const bodyEnd = close === null ? text.length : bodyStart + close.index;
  const body = text.slice(bodyStart, bodyEnd);
  const lines = body.split('\n');
  let offset = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    // 行尾的 \r 必须显式吃掉：JS 的 `.` 不匹配 \r，而 Windows 上的 SKILL.md 基本都是 CRLF，
    // 否则这个匹配会整体失败、走到「找不到就插入」分支，在 frontmatter 顶部多加一行 description。
    const m = /^description:[ \t]*(.*?)\r?$/.exec(line);
    if (m === null) {
      offset += line.length + 1;
      continue;
    }
    const start = bodyStart + offset;
    let end = start + line.length;
    const rest = m[1].trim();
    if ((rest.startsWith('|') || rest.startsWith('>')) && rest.length <= 3) {
      let j = i + 1;
      while (j < lines.length && (lines[j].trim() === '' || /^[ \t]/.test(lines[j]))) j += 1;
      end = bodyStart + offset;
      for (let k = i; k < j; k += 1) end += lines[k].length + 1;
      end -= 1;
    }
    // 原行是 CRLF 时补回 \r，避免把这一行改成 LF、整篇文件变成混合换行
    const cr = line.endsWith('\r') ? '\r' : '';
    return text.slice(0, start) + 'description: ' + value + cr + text.slice(end);
  }
  const insertAt = bodyStart;
  return text.slice(0, insertAt) + 'description: ' + value + eol + text.slice(insertAt);
}

/**
 * 生成 YAML 双引号标量（转义反斜杠、双引号与换行）。
 *
 * @param text 原始文本
 * @returns 可直接写进 frontmatter 的标量文本
 */
function yamlDoubleQuote(text) {
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
  return '"' + escaped + '"';
}

/**
 * 原子地把内容写进文件（先写临时文件再 rename）。
 *
 * @param file 目标文件绝对路径
 * @param content 新的文件内容
 * @returns 无
 */
async function atomicWrite(file, content) {
  const tmp = file + '.tmp-skillcard-' + process.pid + '-' + Date.now();
  await writeFile(tmp, content, 'utf8');
  await rename(tmp, file);
}

/**
 * 保存某个技能的新描述（写回 SKILL.md）。
 *
 * @param skill 技能记录
 * @param description 新描述
 * @returns 技能文件绝对路径
 */
export async function saveDescription(skill, description) {
  const file = typeof skill?.path === 'string' ? skill.path : '';
  if (file === '') throw new Error('无法定位该技能的文件路径');
  const clean = String(description ?? '').trim();
  if (clean === '') throw new Error('技能描述不能为空');
  if (clean.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error('技能描述过长（上限 ' + MAX_DESCRIPTION_LENGTH + ' 字）');
  }
  const writable = await probeWritable(skill);
  if (!writable.writable) throw new Error(writable.reason);
  const content = await readFile(file, 'utf8');
  await atomicWrite(file, rewriteDescription(content, clean));
  return file;
}

/**
 * 用新正文替换 SKILL.md 的正文部分，frontmatter 逐字保留。
 *
 * 正文里统一用 \n；原文件是 CRLF 时按原换行符写回，避免整篇正文的换行风格被改掉。
 *
 * @param content SKILL.md 原文
 * @param body 新的正文文本
 * @returns 改写后的全文
 */
export function rewriteBody(content, body) {
  const text = String(content ?? '');
  const { frontmatter } = splitSkillDocument(text);
  if (frontmatter === '') throw new Error('该技能文件没有可识别的 frontmatter，已拒绝改写正文');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  // splitSkillDocument 会把结尾分隔线那一行的 \r 一并算进 frontmatter，这里削掉，否则 CRLF 文件会写出 \r\r\n
  const head = frontmatter.endsWith('\r') ? frontmatter.slice(0, -1) : frontmatter;
  const clean = normalizeBody(body);
  if (clean === '') return head + eol;
  const bodyText = eol === '\n' ? clean : clean.replace(/\n/g, '\r\n');
  return head + eol + eol + bodyText;
}

/**
 * 保存某个技能的新正文（只改写 SKILL.md 里 frontmatter 之后的部分）。
 *
 * @param skill 技能记录
 * @param body 新正文
 * @returns 技能文件绝对路径
 */
export async function saveBody(skill, body) {
  const file = typeof skill?.path === 'string' ? skill.path : '';
  if (file === '') throw new Error('无法定位该技能的文件路径');
  const clean = String(body ?? '');
  if (clean.length > MAX_BODY_LENGTH) {
    throw new Error('技能正文过长（上限 ' + MAX_BODY_LENGTH + ' 字符）');
  }
  const writable = await probeWritable(skill);
  if (!writable.writable) throw new Error(writable.reason);
  const content = await readFile(file, 'utf8');
  await atomicWrite(file, rewriteBody(content, clean));
  return file;
}

/**
 * 删除一个技能（目录形态删整个目录，散文件形态删那个 .md）。
 *
 * @param skill 技能记录
 * @param allowedRoots 允许删除的技能根白名单（绝对路径）
 * @returns { kind, path, files } 删除形态、被删路径、涉及的文件数
 */
export async function deleteSkill(skill, allowedRoots) {
  const file = typeof skill?.path === 'string' ? skill.path : '';
  if (file === '') throw new Error('无法定位该技能的文件路径');
  const writable = await probeWritable(skill);
  if (!writable.writable) throw new Error(writable.reason);
  const roots = Array.isArray(allowedRoots) ? allowedRoots : [];
  const insideRoot = roots.some((root) => isInside(root, file));
  if (!insideRoot) throw new Error('该技能不在可管理的技能根目录内，拒绝删除：' + file);
  if (basename(file) === SKILL_FILE_NAME && basename(dirname(file)) === String(skill?.name ?? '')) {
    const dir = dirname(file);
    const files = await countFiles(dir);
    await rm(dir, { recursive: true, force: false });
    return { kind: 'directory', path: dir, files };
  }
  const files = 1;
  await rm(file, { force: false });
  return { kind: 'file', path: file, files };
}

/**
 * 新建一个技能（目录形态：<root>/<name>/SKILL.md）。
 *
 * @param root 目标技能根绝对路径
 * @param name 技能名（必须符合官方技能名语法）
 * @param description 技能描述
 * @returns 新建的 SKILL.md 绝对路径
 */
export async function createSkill(root, name, description) {
  if (!isSkillName(name)) {
    throw new Error('技能名不合法：只能用小写字母、数字与单个连字符，例如 my-new-skill');
  }
  const clean = String(description ?? '').trim();
  if (clean === '') throw new Error('技能描述不能为空');
  if (clean.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error('技能描述过长（上限 ' + MAX_DESCRIPTION_LENGTH + ' 字）');
  }
  const dir = join(root, name);
  if (!isInside(root, dir)) throw new Error('技能名解析后不在目标目录内，已拒绝');
  try {
    await access(dir, constants.F_OK);
    throw new Error('已存在同名技能目录：' + dir);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('已存在同名技能目录')) throw error;
  }
  await mkdir(dir, { recursive: true });
  const file = join(dir, SKILL_FILE_NAME);
  const body = [
    '---',
    'name: ' + name,
    'description: ' + yamlDoubleQuote(clean),
    '---',
    '',
    '# ' + name,
    '',
    clean,
    '',
  ].join('\n');
  await writeFile(file, body, 'utf8');
  return file;
}
