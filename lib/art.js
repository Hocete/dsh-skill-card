/**
 * 卡面美术：确定性保底卡面 + 大模型美术配方 + 本地 SVG 渲染所需的全部数据。
 *
 * 设计要点（对应已确认的需求）：
 * 1. 永不空白 —— 任何新技能先用「技能名哈希」算出确定性的保底卡面，立即可用。
 * 2. 全自动升级 —— 后台调一次 ctx.llm.stream 让模型按 name + description 输出
 *    严格 JSON 美术配方（含领域分类），成功后替换保底卡面，失败则保留保底。
 * 3. 只生成一次 —— 配方落盘缓存；同一技能同一 ART_VERSION 不再调模型。
 * 4. 绝不写 skill 文件 —— 配方全部落在 storages/skill-card/cards.json。
 */
import { createHash } from 'node:crypto';

/** 配方结构版本；提示词或纹样集变更时递增，可使旧缓存自动重算。 */
export const ART_VERSION = 1;

/** 模型生成失败的最大重试次数（含首次），超过后永久保留保底卡面。 */
const MAX_ART_TRIES = 3;

/** 单个技能的模型调用超时（毫秒），避免请求悬挂。 */
const ART_TIMEOUT_MS = 60000;

/** 允许的稀有度档位（N → UR 由低到高）。 */
export const RARITIES = ['N', 'R', 'SR', 'SSR', 'UR'];

/** 允许的领域分类。DSH 本身没有分类数据，这一层完全由本插件定义。 */
export const CATEGORIES = ['开发', 'AI 智能体', '分析', '文档', '办公', '流程', '其它'];

/** 未分类占位（模型还没跑出来或模型失败时使用）。 */
export const UNCLASSIFIED = '未分类';

/** 纹样 id 集合；客户端渲染器必须实现同名画法。 */
export const MOTIFS = [
  'gear', 'envelope', 'terminal', 'graph', 'waveform', 'crystal', 'orbit',
  'compass', 'search', 'shield', 'doc', 'grid', 'slide', 'key', 'flask', 'book',
];

/** 五维数值的中文名（顺序即卡面展示顺序）。 */
export const STAT_KEYS = ['能力', '效率', '通用', '稳定', '命中'];

/** 卡面配色的兜底色板池（按技能名哈希选取，保证确定性）。 */
const PALETTE_POOL = [
  ['#0c1013', '#1c2f2a', '#39ff88', '#a8ffcf'],
  ['#0d1730', '#1e3a72', '#f0b429', '#63b3ff'],
  ['#06140f', '#0f3b2a', '#00e0a0', '#7dffd4'],
  ['#101a0e', '#1f3d18', '#b7e04a', '#e8ffa8'],
  ['#1a0b2e', '#3f1a63', '#c084fc', '#e9d5ff'],
  ['#0d1030', '#232a6b', '#8b7dff', '#c9c2ff'],
  ['#08202b', '#0f4a5e', '#22d3ee', '#a5f3ff'],
  ['#241206', '#5c2f10', '#f59e0b', '#fcd9a0'],
  ['#0a1626', '#153a5c', '#38bdf8', '#a5e8ff'],
  ['#141414', '#33291a', '#d4a017', '#ffe08a'],
  ['#0b1a2e', '#1b3f6b', '#4a9eff', '#8fd0ff'],
  ['#0a1f16', '#14512f', '#2ecc71', '#8ff0bb'],
  ['#2a0f0c', '#6b2318', '#ff7043', '#ffb199'],
];

/** 稀有度对应的星数区间。 */
const RARITY_STARS = { N: 1, R: 3, SR: 4, SSR: 5, UR: 5 };

/**
 * 计算字符串的 32 位 FNV-1a 哈希。
 *
 * @param text 输入文本
 * @returns 32 位无符号整数哈希
 */
function hash32(text) {
  let h = 0x811c9dc5;
  const s = String(text ?? '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * 由整数种子生成确定性伪随机序列（mulberry32）。
 *
 * @param seed 整数种子
 * @returns 返回 [0,1) 浮点数的函数
 */
function rngFrom(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 生成技能的展示用英文标题（技能名转驼峰标题）。
 *
 * @param name 技能名
 * @returns 标题化字符串
 */
export function titleOf(name) {
  return String(name ?? '')
    .split('-')
    .filter((part) => part !== '')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * 由技能名推导确定性的保底卡面。
 *
 * 这是「永不空白」的保证：不依赖任何外部服务，同样的技能名永远得到同样的卡面。
 *
 * @param skill 技能记录（至少含 name）
 * @returns 保底卡片数据
 */
export function deriveFallbackCard(skill) {
  const name = String(skill?.name ?? '');
  const seed = hash32(name);
  const rand = rngFrom(seed);
  const palette = PALETTE_POOL[seed % PALETTE_POOL.length];
  const motif = MOTIFS[seed % MOTIFS.length];
  const rarityIndex = 1 + Math.floor(rand() * 3);
  const rarity = RARITIES[rarityIndex];
  const stars = RARITY_STARS[rarity];
  const stats = [];
  for (let i = 0; i < 5; i += 1) stats.push(60 + Math.floor(rand() * 33));
  return {
    cn: titleOf(name).slice(0, 12),
    title: titleOf(name),
    category: UNCLASSIFIED,
    rarity,
    stars,
    stats,
    tags: [],
    motif,
    glyph: name.replace(/[^a-z0-9]/gi, '').charAt(0).toUpperCase() || '技',
    palette,
    art: 'fallback',
    artVersion: ART_VERSION,
    artTries: 0,
  };
}

/**
 * 生成给模型的美术配方提示词。
 *
 * @param skill 技能记录（含 name / description）
 * @returns 提示词文本
 */
export function buildPrompt(skill) {
  const lines = [];
  lines.push('你是一名游戏卡牌美术设计助手。请为一个「AI 技能」设计卡面配方，只输出一个 JSON 对象，不要任何解释、不要 markdown 代码块。');
  lines.push('');
  lines.push('技能名（英文 slug）：' + String(skill?.name ?? ''));
  lines.push('技能描述：' + String(skill?.description ?? '').slice(0, 800));
  if (typeof skill?.whenToUse === 'string' && skill.whenToUse !== '') {
    lines.push('使用时机：' + skill.whenToUse.slice(0, 300));
  }
  lines.push('');
  lines.push('JSON 字段要求：');
  lines.push('- cn：中文卡名，2-5 个汉字，要有游戏感（例如「邮件代理」「逆向工程」）');
  lines.push('- title：英文卡名，2-4 个单词，首字母大写');
  lines.push('- category：领域分类，必须从这些里选一个：' + CATEGORIES.filter((c) => c !== '其它').join('、') + '；实在无法归类才用「其它」');
  lines.push('- rarity：稀有度，必须从 N、R、SR、SSR、UR 里选一个（能力越强越稀有）');
  lines.push('- stars：星级，1 到 5 的整数，需与 rarity 相称（N=1、R=3、SR=4、SSR=5、UR=5）');
  lines.push('- stats：长度为 5 的整数数组，依次代表 ' + STAT_KEYS.join('、') + '，取值范围 50-99');
  lines.push('- motif：纹样 id，必须从这些里选一个：' + MOTIFS.join('、'));
  lines.push('- glyph：单个汉字，取中文卡名里最有代表性的一个字');
  lines.push('- palette：长度为 4 的十六进制颜色数组，依次是 [背景深色, 背景中间色, 强调色, 辉光色]，要符合技能气质');
  lines.push('');
  lines.push('示例输出：{"cn":"邮件代理","title":"Mail Agent","category":"办公","rarity":"SR","stars":4,"stats":[88,92,74,85,83],"motif":"envelope","glyph":"邮","palette":["#0d1730","#1e3a72","#f0b429","#63b3ff"]}');
  return lines.join('\n');
}

/**
 * 从模型返回的文本里提取并校验美术配方。
 *
 * @param text 模型输出文本
 * @returns 校验通过的配方对象；无法解析或字段不合法时返回 undefined
 */
export function parseRecipe(text) {
  const raw = String(text ?? '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  let parsed;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;
  const cn = typeof parsed.cn === 'string' && parsed.cn.trim() !== '' ? parsed.cn.trim().slice(0, 12) : undefined;
  const title = typeof parsed.title === 'string' && parsed.title.trim() !== '' ? parsed.title.trim().slice(0, 40) : undefined;
  const category = CATEGORIES.includes(parsed.category) ? parsed.category : UNCLASSIFIED;
  const rarity = RARITIES.includes(parsed.rarity) ? parsed.rarity : 'R';
  let stars = Number.isInteger(parsed.stars) ? parsed.stars : RARITY_STARS[rarity];
  stars = Math.max(1, Math.min(5, stars));
  const stats = [];
  if (Array.isArray(parsed.stats)) {
    for (let i = 0; i < 5; i += 1) {
      const value = Number(parsed.stats[i]);
      stats.push(Number.isFinite(value) ? Math.max(1, Math.min(99, Math.round(value))) : 70);
    }
  } else {
    return undefined;
  }
  const motif = MOTIFS.includes(parsed.motif) ? parsed.motif : undefined;
  const glyph = typeof parsed.glyph === 'string' && parsed.glyph.trim() !== '' ? parsed.glyph.trim().slice(0, 1) : undefined;
  const palette = [];
  if (Array.isArray(parsed.palette)) {
    for (const color of parsed.palette) {
      if (typeof color !== 'string') continue;
      const hex = color.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(hex)) palette.push(hex.toLowerCase());
    }
  }
  if (palette.length !== 4 || motif === undefined || cn === undefined || title === undefined || glyph === undefined) {
    return undefined;
  }
  return { cn, title, category, rarity, stars, stats, motif, glyph, palette };
}

/**
 * 计算一条技能的卡面数据指纹，用于判断是否需要重新调模型。
 *
 * @param skill 技能记录
 * @returns 指纹字符串
 */
export function skillFingerprint(skill) {
  return createHash('sha1')
    .update(String(skill?.name ?? ''))
    .update('\u0000')
    .update(String(skill?.description ?? ''))
    .digest('hex')
    .slice(0, 16);
}

/**
 * 合并「保底卡面」与「已存盘卡片数据」，得到界面使用的完整卡片。
 *
 * @param skill 技能记录
 * @param stored 已存盘的卡片数据（可能为空）
 * @returns 完整卡片数据
 */
export function mergeCard(skill, stored) {
  const fallback = deriveFallbackCard(skill);
  const merged = { ...fallback, ...(stored ?? {}) };
  merged.id = typeof skill?.id === 'string' ? skill.id : String(skill?.name ?? '');
  merged.name = String(skill?.name ?? '');
  merged.path = typeof skill?.path === 'string' ? skill.path : undefined;
  merged.directory = typeof skill?.directory === 'string' ? skill.directory : undefined;
  merged.level = skill?.level;
  merged.description = typeof skill?.description === 'string' ? skill.description : '';
  merged.linked = skill?.linked === true;
  if (!Array.isArray(merged.stats) || merged.stats.length !== 5) merged.stats = fallback.stats;
  if (!Array.isArray(merged.palette) || merged.palette.length !== 4) merged.palette = fallback.palette;
  if (!Array.isArray(merged.tags)) merged.tags = [];
  if (!MOTIFS.includes(merged.motif)) merged.motif = fallback.motif;
  if (!RARITIES.includes(merged.rarity)) merged.rarity = fallback.rarity;
  if (!Number.isInteger(merged.stars)) merged.stars = fallback.stars;
  return merged;
}

/**
 * 判断一条已存盘卡片是否还需要调用模型补全美术配方。
 *
 * @param stored 已存盘卡片数据
 * @param fingerprint 当前技能内容指纹
 * @returns 需要调用模型时返回 true
 */
export function needsArt(stored, fingerprint) {
  if (stored === undefined) return true;
  if (stored.art === 'model' && stored.artVersion === ART_VERSION) return false;
  const tries = Number.isInteger(stored.artTries) ? stored.artTries : 0;
  if (tries >= MAX_ART_TRIES) return false;
  if (stored.artFingerprint !== fingerprint && stored.art === 'model') return true;
  return true;
}

/**
 * 判断一条已存盘卡片是否应该被重新调模型（技能描述变了也要重算）。
 *
 * @param stored 已存盘卡片数据
 * @param fingerprint 当前技能内容指纹
 * @returns 是否需要重新生成
 */
export function shouldRegenerate(stored, fingerprint) {
  if (stored === undefined) return true;
  const tries = Number.isInteger(stored.artTries) ? stored.artTries : 0;
  if (stored.art === 'model' && stored.artVersion === ART_VERSION && stored.artFingerprint === fingerprint) return false;
  if (stored.art === 'model' && stored.artVersion !== ART_VERSION) return true;
  if (tries >= MAX_ART_TRIES) return false;
  return true;
}

/**
 * 调用一次模型，得到某技能的卡面美术配方。
 *
 * @param llm ctx.llm 服务
 * @param route { provider, model } 目标模型路由
 * @param skill 技能记录
 * @param log 日志函数 (message, error) => void
 * @returns 校验通过的配方；失败时返回 undefined
 */
export async function generateRecipe(llm, route, skill, log) {
  if (llm === undefined || llm === null || typeof llm.stream !== 'function') return undefined;
  if (route === undefined || route === null || typeof route.provider !== 'string' || typeof route.model !== 'string') return undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ART_TIMEOUT_MS);
  let text = '';
  let failed = false;
  try {
    const stream = llm.stream({
      provider: route.provider,
      model: route.model,
      messages: [{ role: 'user', content: [{ type: 'text', text: buildPrompt(skill) }] }],
      signal: controller.signal,
    });
    for await (const chunk of stream) {
      if (chunk === null || typeof chunk !== 'object') continue;
      if (chunk.type === 'text-delta' && typeof chunk.text === 'string') text += chunk.text;
      if (chunk.type === 'finish') {
        const kind = chunk.reason?.kind;
        if (kind === 'error' || kind === 'aborted') failed = true;
      }
    }
  } catch (error) {
    failed = true;
    if (typeof log === 'function') log('skill-card: art generation failed for ' + String(skill?.name ?? ''), error);
  } finally {
    clearTimeout(timer);
  }
  if (failed) return undefined;
  return parseRecipe(text);
}

/**
 * 从 ctx.llm 上挑一个可用的模型路由。
 *
 * @param llm ctx.llm 服务
 * @param preferred 配置里指定的 { provider, model }
 * @returns { provider, model }；找不到可用路由时返回 undefined
 */
export async function pickRoute(llm, preferred) {
  if (llm === undefined || llm === null) return undefined;
  if (typeof llm.listProviders !== 'function' || typeof llm.listModels !== 'function') return undefined;
  let providers = [];
  try {
    providers = llm.listProviders() ?? [];
  } catch {
    return undefined;
  }
  const ids = providers.map((p) => p?.id).filter((id) => typeof id === 'string' && id !== '');
  if (ids.length === 0) return undefined;
  const ordered = [];
  if (typeof preferred?.provider === 'string' && ids.includes(preferred.provider)) {
    ordered.push(preferred.provider);
  }
  for (const id of ids) if (!ordered.includes(id)) ordered.push(id);
  for (const provider of ordered) {
    let models = [];
    try {
      models = await llm.listModels(provider);
    } catch {
      models = [];
    }
    if (!Array.isArray(models) || models.length === 0) continue;
    const preferModel = provider === preferred?.provider && typeof preferred?.model === 'string' ? preferred.model : undefined;
    const hit = preferModel !== undefined ? models.find((m) => m?.id === preferModel) : undefined;
    const chosen = hit ?? models[0];
    if (typeof chosen?.id === 'string' && chosen.id !== '') return { provider, model: chosen.id };
  }
  return undefined;
}
