/**
 * 卡面数据存储（side-car）。
 *
 * 卡片属性（分类、稀有度、星数、五维、标签、美术配方）**绝不写进 skill 文件**，
 * 全部落在 DSH 的 storages 目录下：<dshHome>/storages/skill-card/cards.json。
 * 这样只读位置的技能（app.asar 内置、node_modules 里的插件技能）同样能拥有卡面。
 *
 * 写入一律走「临时文件 + rename」的原子替换，避免进程中断写坏整个卡库。
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * 卡库文件格式版本，将来结构变更时用于迁移。
 *
 * v2：标签改为「只由用户手动维护」——模型配方不再产出 tags，存量卡片的自动标签在
 * 首次加载时一次性清空。迁移只做一次，之后用户自己加的标签会随 v2 文件保留。
 *
 * v3：卡片身份从「技能名」改为「技能真实路径」（`id`）。同名但位于不同项目的技能
 * 是两张卡，因此键不能再是名字；`migrateCardKeys` 负责把旧的名字键复制到各路径键上。
 */
export const STORE_VERSION = 3;

/** 内存缓存的卡库内容；null 表示尚未加载。 */
let cached = null;

/** 串行化写入的 Promise 链，避免并发写互相覆盖。 */
let writeChain = Promise.resolve();

/** 卡库文件绝对路径。 */
let storeFile = null;

/**
 * 初始化卡库的文件位置。
 *
 * @param dshHome DSH 主目录（例如 C:\\Users\\<用户>\\.dsh）
 * @returns 卡库文件绝对路径
 */
export function initStore(dshHome) {
  storeFile = join(dshHome, 'storages', 'skill-card', 'cards.json');
  cached = null;
  return storeFile;
}

/**
 * 取当前卡库文件路径。
 *
 * @returns 卡库文件绝对路径；尚未初始化时抛错
 */
export function storePath() {
  if (storeFile === null) throw new Error('skill-card: store not initialized');
  return storeFile;
}

/**
 * 从磁盘加载卡库（带内存缓存），并把旧版本文件就地迁移到当前版本。
 *
 * @returns 卡库对象 { version, cards }
 */
async function load() {
  if (cached !== null) return cached;
  const file = storePath();
  let parsed;
  try {
    parsed = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    cached = { version: STORE_VERSION, diskVersion: STORE_VERSION, cards: {} };
    return cached;
  }
  const cards = parsed !== null && typeof parsed === 'object' && typeof parsed.cards === 'object' && parsed.cards !== null ? parsed.cards : {};
  const version = parsed !== null && typeof parsed === 'object' && Number.isInteger(parsed.version) ? parsed.version : 1;
  // diskVersion 记录磁盘文件当前的格式版本，迁移完成后才推进到 STORE_VERSION
  cached = { version: STORE_VERSION, diskVersion: version, cards };
  if (version < 2) await migrate(cards);
  return cached;
}

/**
 * 把 v1 卡库迁移到 v2：清空所有存量标签，其余卡片属性原样保留。
 *
 * 标签从此只由用户手动添加，因此迁移不需要区分「模型写的」与「手写的」——v1 时代
 * 标签全部由模型配方写入。落盘失败不影响本次运行（内存里已是迁移后的数据）。
 *
 * @param cards 待迁移的卡片映射（就地修改）
 * @returns 无
 */
async function migrate(cards) {
  for (const card of Object.values(cards)) {
    if (card === null || typeof card !== 'object') continue;
    if (Array.isArray(card.tags)) card.tags = [];
  }
  cached.diskVersion = 2;
  try {
    await persist(cached);
  } catch {
    /* 写盘失败时保留内存里的迁移结果，下一次写入会重新落盘 */
  }
}

/**
 * 把 v2 卡库（按技能名存）迁移到 v3（按技能真实路径存）。
 *
 * 一个旧键可能对应多个新身份（同名技能分布在多个项目里）：旧数据复制给每一个身份，
 * 这样两边都保留原来的卡面/标签，之后各改各的。找不到对应技能的老键原样留着（读不到而已）。
 *
 * @param mapping 技能名 → 该名字对应的全部身份数组
 * @returns 无
 */
export async function migrateCardKeys(mapping) {
  return withStore((data) => {
    for (const [name, ids] of Object.entries(mapping ?? {})) {
      const card = data.cards[name];
      if (card === undefined) continue;
      for (const id of Array.isArray(ids) ? ids : []) {
        if (typeof id !== 'string' || id === '' || data.cards[id] !== undefined) continue;
        data.cards[id] = { ...card };
      }
      delete data.cards[name];
    }
    data.diskVersion = STORE_VERSION;
  });
}

/**
 * 读卡库的版本信息（不动内容）。
 *
 * @returns { version, diskVersion, count }
 */
export async function storeMeta() {
  const data = await load();
  return { version: data.version, diskVersion: data.diskVersion, count: Object.keys(data.cards).length };
}

/**
 * 把卡库原子写回磁盘。
 *
 * @param data 卡库对象
 * @returns 写入完成后 resolve
 */
async function persist(data) {
  const file = storePath();
  await mkdir(dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now();
  await writeFile(tmp, JSON.stringify({ version: data.diskVersion ?? STORE_VERSION, cards: data.cards }, null, 2), 'utf8');
  await rename(tmp, file);
}

/**
 * 在写队列里串行执行一次卡库读改写。
 *
 * @param mutator 接收卡库对象、返回返回值的函数（可同步或异步）
 * @returns 与 mutator 相同的返回值
 */
async function withStore(mutator) {
  const run = writeChain.then(async () => {
    const data = await load();
    const result = await mutator(data);
    await persist(data);
    return result;
  });
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * 读取所有已保存的卡片数据。
 *
 * @returns 技能名到卡片数据的映射（浅拷贝的副本）
 */
export async function readCards() {
  const data = await load();
  return { ...data.cards };
}

/**
 * 读取单个技能的卡片数据。
 *
 * @param skillName 技能名
 * @returns 卡片数据；未保存过时返回 undefined
 */
export async function readCard(skillName) {
  const data = await load();
  return data.cards[skillName];
}

/**
 * 以补丁方式写回单个技能的卡片数据（与已有字段合并）。
 *
 * @param skillName 技能名
 * @param patch 要写入的字段（值为 undefined 的键会被忽略）
 * @returns 合并后的完整卡片数据
 */
export async function patchCard(skillName, patch) {
  return withStore((data) => {
    const clean = {};
    for (const [key, value] of Object.entries(patch ?? {})) {
      if (value !== undefined) clean[key] = value;
    }
    const next = { ...(data.cards[skillName] ?? {}), ...clean };
    data.cards[skillName] = next;
    return next;
  });
}

/**
 * 删除某个技能的卡片数据。
 *
 * @param skillName 技能名
 * @returns 是否确实删掉了一条记录
 */
export async function dropCard(skillName) {
  return withStore((data) => {
    if (!(skillName in data.cards)) return false;
    delete data.cards[skillName];
    return true;
  });
}

/**
 * 批量写入：一次性把多张卡的新数据合并进卡库（只落盘一次）。
 *
 * @param entries 技能名到补丁的映射
 * @returns 无
 */
export async function patchCards(entries) {
  return withStore((data) => {
    for (const [skillName, patch] of Object.entries(entries ?? {})) {
      const clean = {};
      for (const [key, value] of Object.entries(patch ?? {})) {
        if (value !== undefined) clean[key] = value;
      }
      data.cards[skillName] = { ...(data.cards[skillName] ?? {}), ...clean };
    }
  });
}

/**
 * 用一个外部计算的完整结果替换某技能的卡片数据。
 *
 * @param skillName 技能名
 * @param value 新的卡片数据（整体替换）
 * @returns 无
 */
export async function putCard(skillName, value) {
  return withStore((data) => {
    data.cards[skillName] = { ...(value ?? {}) };
  });
}

/**
 * 丢弃内存缓存，强制下次读取时重新读盘。
 *
 * @returns 无
 */
export function invalidateStoreCache() {
  cached = null;
}
