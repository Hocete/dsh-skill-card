/**
 * /api/dsh-skill-card 路由族。
 *
 * 每个路由都带同一道信任围栏：默认只允许回环（本机）访问；写路由会动真实的
 * skill 文件，因此未配对的外网客户端一律 403。
 */
import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import {
  CATEGORIES,
  RARITIES,
  STAT_KEYS,
  UNCLASSIFIED,
  ART_VERSION,
  generateRecipe,
  mergeCard,
  pickRoute,
  shouldRegenerate,
  skillFingerprint,
} from './art.js';
import { collectSkills, customSkillDirsFromLoader, findProjectRoot, findSkillDirs, normalizeSkillRoots } from './scan.js';
import { countFiles, createSkill, deleteSkill, isInside, probeWritable, saveBody, saveDescription } from './skillfile.js';
import { migrateCardKeys, patchCard, readCards, STORE_VERSION, storeMeta, storePath } from './store.js';
import { readWorkspaces } from './workspaces.js';

/** 路由路径常量（客户端包里镜像了同样的字面量）。 */
export const ROUTES = {
  list: '/api/dsh-skill-card/list',
  update: '/api/dsh-skill-card/update',
  setDescription: '/api/dsh-skill-card/set-description',
  setBody: '/api/dsh-skill-card/set-body',
  remove: '/api/dsh-skill-card/delete',
  create: '/api/dsh-skill-card/create',
  refresh: '/api/dsh-skill-card/refresh',
  health: '/api/dsh-skill-card/health',
};

/** 同时进行的模型调用上限，避免一次刷新打爆模型服务。 */
const MAX_CONCURRENT_ART = 2;

/** 请求体体积上限。 */
const MAX_BODY_BYTES = 256 * 1024;

/** 判断一个 IPv4 字符串是否属于 127/8。 */
function isIPv4Loopback(v4) {
  const parts = String(v4).split('.');
  return parts.length === 4 && parts[0] === '127' && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

/** 判断 socket 远端地址是否是回环地址。 */
function isLoopbackAddress(address) {
  if (typeof address !== 'string' || address === '') return false;
  const v = address.toLowerCase();
  if (v === '::1') return true;
  if (v.startsWith('::ffff:')) return isIPv4Loopback(v.slice(7));
  return isIPv4Loopback(v);
}

/** 判断 Host 头是否是回环地址。 */
function isLoopbackHostname(hostname) {
  if (hostname === 'localhost' || hostname === '[::1]') return true;
  return isIPv4Loopback(hostname);
}

/**
 * 请求级信任围栏：socket 地址必须是回环，Host 头也必须是回环，且带浏览器同源标记。
 *
 * @param request HTTP 请求
 * @returns 是否允许进入本插件的 host 路由
 */
function isLoopbackRequest(request) {
  if (!isLoopbackAddress(request?.socket?.remoteAddress)) return false;
  const host = request.headers?.host;
  if (typeof host !== 'string') return false;
  let hostUrl;
  try {
    hostUrl = new URL('http://' + host);
  } catch {
    return false;
  }
  if (!isLoopbackHostname(hostUrl.hostname)) return false;
  if (request.headers['sec-fetch-site'] === 'cross-site') return false;
  const origin = request.headers.origin;
  if (origin === undefined) return true;
  try {
    return new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}

/**
 * 写 JSON 响应。
 *
 * @param res HTTP 响应
 * @param status 状态码
 * @param body 响应体对象
 * @returns 无
 */
function writeJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  });
  res.end(text);
}

/**
 * 读取并解析 JSON 请求体。
 *
 * @param req HTTP 请求
 * @returns 解析后的对象；非法时返回 undefined
 */
async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return undefined;
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.trim() === '') return undefined;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

/**
 * 校验并规范化客户端提交的卡片补丁。
 *
 * @param body 请求体
 * @returns { patch } 或 { error }
 */
function sanitizePatch(body) {
  const patch = {};
  if (typeof body.category === 'string') {
    const category = body.category.trim();
    if (category !== '' && category !== UNCLASSIFIED && !CATEGORIES.includes(category)) {
      return { error: '分类不合法：' + category };
    }
    patch.category = category === '' ? UNCLASSIFIED : category;
  }
  if (typeof body.rarity === 'string') {
    if (!RARITIES.includes(body.rarity)) return { error: '稀有度不合法：' + body.rarity };
    patch.rarity = body.rarity;
  }
  if (body.stars !== undefined) {
    const stars = Number(body.stars);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { error: '星数必须是 1-5 的整数' };
    patch.stars = stars;
  }
  if (body.stats !== undefined) {
    if (!Array.isArray(body.stats) || body.stats.length !== 5) return { error: '五维数值必须是长度为 5 的数组' };
    const stats = [];
    for (const raw of body.stats) {
      const value = Number(raw);
      if (!Number.isFinite(value)) return { error: '五维数值必须是数字' };
      stats.push(Math.max(1, Math.min(99, Math.round(value))));
    }
    patch.stats = stats;
  }
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) return { error: '标签必须是数组' };
    const tags = [];
    for (const raw of body.tags) {
      if (typeof raw !== 'string') continue;
      const tag = raw.trim().replace(/\s+/g, ' ').slice(0, 8);
      if (tag !== '' && !tags.includes(tag)) tags.push(tag);
    }
    patch.tags = tags;
  }
  if (typeof body.cn === 'string' && body.cn.trim() !== '') patch.cn = body.cn.trim().slice(0, 12);
  if (typeof body.title === 'string' && body.title.trim() !== '') patch.title = body.title.trim().slice(0, 40);
  if (body.palette !== undefined) {
    if (!Array.isArray(body.palette) || body.palette.length !== 4) return { error: '配色必须是长度为 4 的数组' };
    const palette = [];
    for (const raw of body.palette) {
      if (typeof raw !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(raw.trim())) return { error: '配色必须是 #rrggbb 形式' };
      palette.push(raw.trim().toLowerCase());
    }
    patch.palette = palette;
  }
  if (Object.keys(patch).length === 0) return { error: '没有可写入的字段' };
  return { patch };
}

/**
 * 从请求体里取卡片键：优先用身份（真实路径），兼容旧客户端的技能名。
 *
 * @param body 请求体
 * @returns 卡片键；两者都没有时返回空串
 */
function cardKeyOf(body) {
  if (typeof body?.id === 'string' && body.id !== '') return body.id;
  if (typeof body?.name === 'string' && body.name !== '') return body.name;
  return '';
}

/**
 * 构建本插件全部路由。
 *
 * @param ctx host 插件上下文
 * @param deps 依赖集合 { dshHome, agentsHome, logger }
 * @returns ctx.webServer.register 需要的路由数组
 */
export function makeRoutes(ctx, deps) {
  const logger = deps.logger ?? { warn: () => undefined };
  /** 正在排队或执行中的美术生成任务：技能名集合。 */
  const artInFlight = new Set();
  /** 美术生成等待队列。 */
  const artQueue = [];
  /** 当前正在执行的模型调用数量。 */
  let artRunning = 0;
  /** 模型路由缓存（首次调用时解析）。 */
  let artRouteCache;

  /** 取 ctx.llm（不存在时返回 undefined，不影响其他功能）。 */
  const llmService = () => {
    try {
      if (typeof ctx.get === 'function') return ctx.get('llm', false);
      return ctx.llm;
    } catch {
      return undefined;
    }
  };

  /** 取所有活跃会话的工作目录。 */
  const activeSessionCwds = () => {
    try {
      const sessions = ctx.sessions;
      if (typeof sessions?.list !== 'function') return [];
      return sessions.list().map((session) => session.header?.cwd).filter((cwd) => typeof cwd === 'string' && cwd !== '');
    } catch {
      return [];
    }
  };

  /**
   * 取所有活跃会话各自的「项目根」。
   *
   * 面板本身没有会话上下文，只认第一个会话会让「项目技能」在多数会话下永远是空的；
   * 因此把每个打开过的会话目录都向上找一次最近的 .git，找不到就用会话目录本身。
   *
   * @returns 去重后的项目根绝对路径数组（顺序与会话列表一致）
   */
  const activeProjectRoots = () => {
    const roots = [];
    const seen = new Set();
    for (const cwd of activeSessionCwds()) {
      const root = findProjectRoot(cwd);
      if (seen.has(root)) continue;
      seen.add(root);
      roots.push(root);
    }
    return roots;
  };

  /** 取插件自己配置的自定义技能根。 */
  const ownCustomDirs = () => {
    try {
      const loader = ctx.get('loader', false);
      if (typeof loader?.entries === 'function') return customSkillDirsFromLoader(loader.entries());
    } catch {
      return [];
    }
    return [];
  };

  /**
   * 取技能的身份键（真实路径，Windows 下已小写）。
   *
   * 卡片数据、正在生成的任务、写操作都按这个键走：同名但不同路径的技能是两张卡。
   *
   * @param skill 技能记录
   * @returns 身份键；拿不到时退回技能名
   */
  const skillKey = (skill) => String(skill?.id ?? skill?.name ?? '');

  /**
   * 按身份键（或退化成技能名）在扫描结果里找一条技能。
   *
   * @param skills 扫描结果
   * @param body 请求体（含 id，兼容旧的 name）
   * @returns 命中的技能记录；找不到时返回 undefined
   */
  const findSkill = (skills, body) => {
    const id = typeof body?.id === 'string' && body.id !== '' ? body.id : undefined;
    if (id !== undefined) {
      const hit = skills.find((skill) => skill.id === id);
      if (hit !== undefined) return hit;
    }
    const name = typeof body?.name === 'string' ? body.name : undefined;
    if (name === undefined) return undefined;
    return skills.find((skill) => skill.name === name);
  };

  /**
   * 卡库 v2 → v3：把按技能名存的卡片数据改成按真实路径存。
   *
   * 同名技能分布在多个项目时，旧数据复制给每一个身份，避免卡面被重新生成。
   *
   * @param skills 本次扫描到的全部技能
   * @returns 无
   */
  const ensureCardIds = async (skills) => {
    const meta = await storeMeta();
    if (meta.diskVersion >= STORE_VERSION) return;
    const mapping = {};
    for (const skill of skills) {
      if (typeof skill.id !== 'string' || skill.id === '') continue;
      const ids = mapping[skill.name] ?? [];
      if (!ids.includes(skill.id)) ids.push(skill.id);
      mapping[skill.name] = ids;
    }
    await migrateCardKeys(mapping);
  };

  /**
   * 把项目根翻译成界面上显示的项目名。
   *
   * 工作空间用它自己的 title（BasketballServer、bm2_server…），没登记成工作空间的会话目录
   * 退回目录名；不是项目技能的技能返回空串。
   *
   * @param root 技能所属项目根（非项目技能为 undefined）
   * @param titles 项目根到工作空间标题的映射
   * @returns 项目显示名；未知时返回空串
   */
  const projectNameOf = (root, titles) => {
    if (typeof root !== 'string' || root === '') return '';
    const title = titles instanceof Map ? titles.get(root) : undefined;
    if (typeof title === 'string' && title !== '') return title;
    return basename(root);
  };

  /**
   * 组装一次技能扫描所需的全部选项。
   *
   * 项目根的来源有两处：
   * 1. 已打开会话的工作目录（向上找最近的 .git）—— 用户此刻正在干活的目录；
   * 2. DSH 的工作空间列表（`~/.dsh/storages/workspace.json`）—— 用户建过工作空间的项目，
   *    即使这次没在里面开会话，它的项目技能也应该能筛出来。
   *
   * 只有第一类才额外要注册表快照（registryRoots）：注册表快照逐个 cwd 串行调用，
   * 工作空间可能有好几个，而它们的技能本来就在 `.dsh/skills`、`.agents/skills` 里，扫盘已覆盖。
   *
   * @param cwd 覆盖的工作目录（不传时取第一个会话的工作目录）
   * @returns 扫描选项对象
   */
  const collectOptions = async (cwd) => {
    const openRoots = activeProjectRoots();
    let workspaces = [];
    try {
      workspaces = await readWorkspaces(deps.dshHome);
    } catch {
      workspaces = [];
    }
    // 项目根 → 界面显示名：工作空间用它的 title，会话目录退回目录名
    const projectTitles = new Map();
    for (const item of workspaces) projectTitles.set(item.path, item.title);
    const projectRoots = [];
    const seen = new Set();
    for (const root of openRoots.concat(workspaces.map((item) => item.path))) {
      if (seen.has(root)) continue;
      seen.add(root);
      projectRoots.push(root);
    }
    return {
      cwd: cwd ?? activeSessionCwds()[0] ?? process.cwd(),
      projectRoots,
      projectTitles,
      registryRoots: openRoots,
      customSkillDirs: normalizeSkillRoots(ownCustomDirs()),
      dshHome: deps.dshHome,
      agentsHome: deps.agentsHome,
      registry: (() => {
        try {
          if (typeof ctx.get === 'function') return ctx.get('skills', false);
          return ctx.skills;
        } catch {
          return undefined;
        }
      })(),
    };
  };

  /**
   * 计算「新建技能」可选的目标根，并把默认根放在第一位。
   *
   * @param cwd 当前工作目录
   * @returns 目标根数组 [{ key, label, path, exists }]
   */
  const createRoots = async (cwd) => {
    const projectRoot = findProjectRoot(cwd);
    const candidates = [
      { key: 'user-agents', label: '公共技能目录 (~/.agents/skills)', path: join(deps.agentsHome, 'skills') },
      { key: 'user-dsh', label: '公共技能目录 (~/.dsh/skills)', path: join(deps.dshHome, 'skills') },
      { key: 'project-agents', label: '项目技能目录 (.agents/skills)', path: join(projectRoot, '.agents', 'skills') },
      { key: 'project-dsh', label: '项目技能目录 (.dsh/skills)', path: join(projectRoot, '.dsh', 'skills') },
    ];
    const out = [];
    for (const item of candidates) {
      const probe = await probeWritable({ path: join(item.path, '__probe__.md'), linked: false });
      out.push({ ...item, writable: probe.writable, reason: probe.reason });
    }
    return out;
  };

  /**
   * 启动一条技能的美术生成任务（带去重与并发上限）。
   *
   * @param skill 技能记录
   * @returns 无
   */
  const scheduleArt = (skill, stored) => {
    const key = skillKey(skill);
    if (key === '' || artInFlight.has(key)) return;
    artInFlight.add(key);
    artQueue.push({ skill, stored });
    pumpArt();
  };

  /** 按并发上限推进美术生成队列。 */
  const pumpArt = () => {
    while (artRunning < MAX_CONCURRENT_ART && artQueue.length > 0) {
      const job = artQueue.shift();
      artRunning += 1;
      runArt(job)
        .catch((error) => logger.warn(error))
        .finally(() => {
          artRunning -= 1;
          artInFlight.delete(skillKey(job.skill));
          pumpArt();
        });
    }
  };

  /**
   * 真正执行一次美术生成：调模型 → 校验配方 → 落盘。
   *
   * @param job { skill, stored }
   * @returns 无
   */
  const runArt = async (job) => {
    const llm = llmService();
    if (artRouteCache === undefined) artRouteCache = await pickRoute(llm, deps.artModel);
    if (artRouteCache === undefined) {
      logger.warn('skill-card: 没有可用的模型路由，卡面将保留确定性的保底样式');
      return;
    }
    const recipe = await generateRecipe(llm, artRouteCache, job.skill, (message, error) => logger.warn(message, error));
    const tries = (Number.isInteger(job.stored?.artTries) ? job.stored.artTries : 0) + 1;
    if (recipe === undefined) {
      await patchCard(skillKey(job.skill), { art: 'fallback', artTries: tries, artVersion: ART_VERSION });
      return;
    }
    await patchCard(skillKey(job.skill), {
      ...recipe,
      art: 'model',
      artVersion: ART_VERSION,
      artTries: tries,
      artAt: new Date().toISOString(),
      artFingerprint: skillFingerprint(job.skill),
    });
  };

  /**
   * 组装一次完整的技能列表响应。
   *
   * @param cwd 覆盖的工作目录
   * @returns 响应体对象
   */
  const buildList = async (cwd) => {
    const options = await collectOptions(cwd);
    const { skills, complete } = await collectSkills(options);
    await ensureCardIds(skills);
    const stored = await readCards();
    const items = [];
    let pending = 0;
    for (const skill of skills) {
      const saved = stored[skillKey(skill)];
      const card = mergeCard(skill, saved);
      const fingerprint = skillFingerprint(skill);
      const regen = shouldRegenerate(saved, fingerprint);
      const inFlight = artInFlight.has(skillKey(skill));
      if (regen && !inFlight) scheduleArt(skill, saved);
      if (regen || inFlight) pending += 1;
      const writable = await probeWritable(skill);
      const deletable = writable.writable && card.directory !== undefined;
      let deleteFiles = 0;
      let deleteTarget = '';
      if (deletable) {
        const dirForm = String(card.path ?? '').toLowerCase().endsWith('skill.md') && card.path.split(/[\\/]/).slice(-2, -1)[0] === skill.name;
        deleteTarget = dirForm ? card.directory : card.path;
        deleteFiles = dirForm ? await countFiles(card.directory) : 1;
      }
      items.push({
        id: skillKey(skill),
        name: card.name,
        cn: card.cn,
        title: card.title,
        category: card.category,
        rarity: card.rarity,
        stars: card.stars,
        stats: card.stats,
        tags: card.tags,
        motif: card.motif,
        glyph: card.glyph,
        palette: card.palette,
        art: card.art === 'model' ? 'model' : 'fallback',
        artPending: regen || inFlight,
        artTries: Number.isInteger(card.artTries) ? card.artTries : 0,
        description: card.description,
        body: typeof skill.body === 'string' ? skill.body : undefined,
        level: card.level,
        levelLabel: levelLabel(card.level),
        project: projectNameOf(skill.projectRoot, options.projectTitles),
        dir: typeof skill.skillsDir === 'string' ? skill.skillsDir : '',
        path: card.path,
        directory: card.directory,
        linked: card.linked,
        canWrite: writable.writable,
        canDelete: deletable,
        readonlyReason: writable.reason,
        deleteTarget,
        deleteFiles,
      });
    }
    return {
      ok: true,
      skills: items,
      categories: CATEGORIES,
      statKeys: STAT_KEYS,
      rarities: RARITIES,
      pending,
      complete,
      storePath: storePath(),
      createRoots: await createRoots(options.cwd),
    };
  };

  const guard = (req, res, method) => {
    if (!isLoopbackRequest(req)) {
      writeJson(res, 403, { error: 'forbidden: loopback-only' });
      return false;
    }
    if (req.method !== method) {
      writeJson(res, 405, { error: 'method not allowed: ' + req.method });
      return false;
    }
    return true;
  };

  return [
    {
      kind: 'exact',
      path: ROUTES.list,
      handler: async (req, res) => {
        if (!guard(req, res, 'GET')) return;
        try {
          const url = new URL(req.url, 'http://localhost');
          writeJson(res, 200, await buildList(url.searchParams.get('cwd') ?? undefined));
        } catch (error) {
          logger.warn(error);
          writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
    {
      kind: 'exact',
      path: ROUTES.update,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return;
        try {
          const body = await readJsonBody(req);
          const target = cardKeyOf(body);
          if (body === undefined || target === '') {
            writeJson(res, 400, { error: 'expected { id | name, ...fields }' });
            return;
          }
          const sanitized = sanitizePatch(body);
          if (sanitized.error !== undefined) {
            writeJson(res, 400, { error: sanitized.error });
            return;
          }
          const saved = await patchCard(target, sanitized.patch);
          writeJson(res, 200, { ok: true, id: target, name: body.name, card: saved });
        } catch (error) {
          logger.warn(error);
          writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
    {
      kind: 'exact',
      path: ROUTES.setDescription,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return;
        try {
          const body = await readJsonBody(req);
          if (body === undefined || typeof body.description !== 'string' || cardKeyOf(body) === '') {
            writeJson(res, 400, { error: 'expected { id | name, description }' });
            return;
          }
          const options = await collectOptions(undefined);
          const { skills } = await collectSkills(options);
          const skill = findSkill(skills, body);
          if (skill === undefined) {
            writeJson(res, 404, { error: '找不到技能：' + (body.id || body.name) });
            return;
          }
          const path = await saveDescription(skill, body.description);
          writeJson(res, 200, { ok: true, id: skillKey(skill), name: skill.name, path });
        } catch (error) {
          writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
    {
      kind: 'exact',
      path: ROUTES.setBody,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return;
        try {
          const body = await readJsonBody(req);
          if (body === undefined || typeof body.body !== 'string' || cardKeyOf(body) === '') {
            writeJson(res, 400, { error: 'expected { id | name, body }' });
            return;
          }
          const options = await collectOptions(undefined);
          const { skills } = await collectSkills(options);
          const skill = findSkill(skills, body);
          if (skill === undefined) {
            writeJson(res, 404, { error: '找不到技能：' + (body.id || body.name) });
            return;
          }
          const path = await saveBody(skill, body.body);
          writeJson(res, 200, { ok: true, id: skillKey(skill), name: skill.name, path });
        } catch (error) {
          writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
    {
      kind: 'exact',
      path: ROUTES.remove,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return;
        try {
          const body = await readJsonBody(req);
          if (body === undefined || cardKeyOf(body) === '') {
            writeJson(res, 400, { error: 'expected { id | name }' });
            return;
          }
          const options = await collectOptions(undefined);
          const { skills } = await collectSkills(options);
          const skill = findSkill(skills, body);
          if (skill === undefined) {
            writeJson(res, 404, { error: '找不到技能：' + (body.id || body.name) });
            return;
          }
          // 可删除的技能必须落在本次扫描覆盖的目录里：项目里发现的所有 skills 目录
          // （含 .agents/bm2-skills/skills 这类嵌套目录）与两个用户技能根，否则列表里能看到、删除却会被拒绝。
          const projectSkillDirs = [];
          for (const root of options.projectRoots) {
            for (const rel of await findSkillDirs(root)) projectSkillDirs.push(join(root, rel));
          }
          const roots = normalizeSkillRoots([
            ...projectSkillDirs,
            join(deps.dshHome, 'skills'),
            join(deps.agentsHome, 'skills'),
            ...options.customSkillDirs,
          ]);
          const result = await deleteSkill(skill, roots);
          writeJson(res, 200, { ok: true, id: skillKey(skill), name: skill.name, ...result });
        } catch (error) {
          writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
    {
      kind: 'exact',
      path: ROUTES.create,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return;
        try {
          const body = await readJsonBody(req);
          if (body === undefined || typeof body.name !== 'string' || typeof body.description !== 'string') {
            writeJson(res, 400, { error: 'expected { name, description, root }' });
            return;
          }
          const options = await collectOptions(undefined);
          const roots = await createRoots(options.cwd);
          const target = typeof body.root === 'string' && body.root !== ''
            ? roots.find((item) => item.path === resolve(body.root))
            : roots[0];
          if (target === undefined) {
            writeJson(res, 400, { error: '目标技能目录不在允许列表中' });
            return;
          }
          if (!target.writable) {
            writeJson(res, 400, { error: target.reason || '目标技能目录不可写' });
            return;
          }
          const path = await createSkill(target.path, body.name.trim(), body.description);
          writeJson(res, 200, { ok: true, name: body.name.trim(), path });
        } catch (error) {
          writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
    {
      kind: 'exact',
      path: ROUTES.refresh,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return;
        try {
          const body = await readJsonBody(req);
          if (body !== undefined && body.reart === true && cardKeyOf(body) !== '') {
            const options = await collectOptions(undefined);
            const { skills } = await collectSkills(options);
            const skill = findSkill(skills, body);
            if (skill !== undefined) {
              await patchCard(skillKey(skill), { artTries: 0 });
              scheduleArt(skill, { artTries: 0 });
            }
          }
          writeJson(res, 200, await buildList(undefined));
        } catch (error) {
          logger.warn(error);
          writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
    {
      kind: 'exact',
      path: ROUTES.health,
      handler: async (req, res) => {
        if (!guard(req, res, 'GET')) return;
        try {
          const options = await collectOptions(undefined);
          const { skills } = await collectSkills(options);
          const stored = await readCards();
          const withArt = Object.values(stored).filter((card) => card?.art === 'model').length;
          writeJson(res, 200, {
            ok: true,
            plugin: 'skill-card',
            skills: skills.length,
            generated: withArt,
            pending: artInFlight.size + artQueue.length,
            artVersion: ART_VERSION,
          });
        } catch (error) {
          writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
  ];
}

/**
 * 把来源标识翻译成界面上的中文分组名。
 *
 * 界面按这个文案分组做「来源」筛选，所以同一组内的来源必须返回同一文案
 * （项目 .dsh / .agents、用户 .dsh / .agents 各自合并成一组）；其它 Agent 自带的
 * 技能目录没有中文名，直接用产品名，否则筛选行上会出现 agent-claude 这种原始标识。
 *
 * @param level 来源标识
 * @returns 界面上的来源分组名
 */
export function levelLabel(level) {
  switch (level) {
    case 'project-dsh': return '项目技能';
    case 'project-agents': return '项目技能';
    case 'runtime': return '运行时';
    case 'custom': return '自定义目录';
    case 'user-dsh': return '公共技能';
    case 'user-agents': return '公共技能';
    case 'bundled': return '系统内置';
    case 'agent-claude': return 'Claude Code';
    case 'agent-codex': return 'Codex';
    case 'agent-workbuddy': return 'WorkBuddy';
    default: break;
  }
  const text = String(level ?? '');
  if (text.startsWith('agent-') && text.length > 'agent-'.length) {
    const tail = text.slice('agent-'.length);
    return tail.charAt(0).toUpperCase() + tail.slice(1);
  }
  return text === '' ? '其它' : text;
}
