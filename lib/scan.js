/**
 * 技能扫描：复刻 DSH 官方的技能根约定、frontmatter 语法与同名优先级。
 *
 * 为什么独立实现而不是读 ctx.skills：Web profile 把 skill-filesystem provider
 * 挂在 agent preset 作用域层，host 平面的 ctx.skills 看不到项目级/用户级技能，
 * 因此卡库必须自己扫盘，才能拿到每个技能的真实文件路径 —— 写回描述、删除、
 * 新建三处都依赖这个路径。
 */
import { existsSync } from 'node:fs';
import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

/** 官方技能名语法：小写字母数字段、单连字符连接，不允许首尾或连续连字符。 */
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** 一个技能根在一层目录里最多被扫描的子项数，防御异常大目录。 */
const MAX_ROOT_ENTRIES = 2000;

/** 在项目里找 `skills` 目录时最多下探的层数（项目根算第 0 层）。 */
const SKILL_DIR_MAX_DEPTH = 3;

/** 每个项目根最多枚举的子目录数，防御异常庞大的目录树。 */
const MAX_WALK_DIRS = 800;

/**
 * 找 `skills` 目录时跳过的目录名。
 *
 * 这些都是依赖/构建产物/元数据目录，里面即使有 skills 也不是项目技能，
 * 而且会把一次列表请求拖成几万次 readdir。
 */
const SKIP_WALK_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', '.idea', '.gradle', '.vscode', '.cache',
  'dist', 'build', 'out', 'target', 'bin', 'obj', 'coverage', 'vendor', 'tmp', 'temp',
  '__pycache__', '.venv', 'venv', 'env', '.tox', '.next', '.nuxt', '.output',
]);

/** frontmatter 首尾分隔与键值行识别。 */
const FRONTMATTER_BLOCK = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---/;
const FRONTMATTER_LINE = /^([A-Za-z][A-Za-z0-9_-]*):[ \t]*(.*)$/;
const FRONTMATTER_SUB = /^[ \t]+([A-Za-z][A-Za-z0-9_-]*):[ \t]*(.*)$/;

/**
 * 技能身份：按「实际路径」认技能，而不是按技能名。
 *
 * 不同项目里可以各有一份同名技能 —— 它们是两个技能，各自一张卡；
 * 只有指向同一个真实文件的（符号链接 / junction 指向同一份）才算同一个。
 * Windows 盘符不区分大小写，统一小写，避免同一文件出现两个身份。
 *
 * @param filePath 技能文件的绝对路径
 * @returns 身份字符串
 */
function idOfPath(filePath) {
  const text = String(filePath ?? '');
  return process.platform === 'win32' ? text.toLowerCase() : text;
}

/**
 * 求路径的真实位置（解开符号链接与 junction）。
 *
 * @param target 绝对路径
 * @returns 真实路径；解析失败（文件不存在、权限不足）时退回原路径
 */
async function realPathOf(target) {
  try {
    return await realpath(target);
  } catch {
    return target;
  }
}

/** 七个来源分组（与官方 roots 的 source 取值一一对应）。 */
export const SOURCE_GROUPS = [
  { key: 'project-dsh', title: '项目技能 (.dsh/skills)' },
  { key: 'project-agents', title: '项目技能 (.agents/skills)' },
  { key: 'runtime', title: '运行时注册' },
  { key: 'custom', title: '自定义目录' },
  { key: 'user-dsh', title: '公共技能 (~/.dsh/skills)' },
  { key: 'user-agents', title: '公共技能 (~/.agents/skills)' },
  { key: 'bundled', title: '系统内置' },
];

/** 来源优先级（数字越小越近，同名时近的胜出），与官方 roots rank 完全一致。 */
export const SKILL_SOURCE_RANK = new Map([
  ['project-dsh', 100],
  ['project-agents', 200],
  ['runtime', 250],
  ['custom', 300],
  ['user-dsh', 400],
  ['user-agents', 500],
  ['bundled', 600],
]);

/** 未知来源的优先级（排在所有已知来源之后）。 */
const UNKNOWN_RANK = 999;

/**
 * 判断字符串是否是官方注册表接受的技能名。
 *
 * @param name 候选技能名
 * @returns 是否符合官方技能名语法
 */
export function isSkillName(name) {
  return typeof name === 'string' && SKILL_NAME_PATTERN.test(name);
}

/**
 * 计算某一来源的优先级。
 *
 * @param level 来源标识（SOURCE_GROUPS 的 key，或 other:<source>）
 * @returns 优先级数字，未知来源返回 999
 */
export function rankOf(level) {
  return SKILL_SOURCE_RANK.get(level) ?? UNKNOWN_RANK;
}

/**
 * 从 cwd 向上找最近的、含 .git 的祖先目录；找不到时返回 cwd 本身。
 *
 * @param cwd 会话工作目录
 * @returns 项目根目录绝对路径
 */
export function findProjectRoot(cwd) {
  // 起点即「找不到 .git 时的返回值」：官方语义是 cwd 本身，而不是文件系统根。
  const start = resolve(cwd ?? process.cwd());
  let current = start;
  for (;;) {
    try {
      if (existsSync(join(current, '.git'))) return current;
    } catch {
      return start;
    }
    const parent = dirname(current);
    if (parent === current) return start;
    current = parent;
  }
}

/**
 * 规范化自定义技能根列表：丢弃空值、解析为绝对路径、去重。
 *
 * @param dirs 配置里的自定义技能根
 * @returns 绝对路径、去重后的技能根列表
 */
export function normalizeSkillRoots(dirs) {
  const seen = new Set();
  const out = [];
  for (const dir of Array.isArray(dirs) ? dirs : []) {
    if (typeof dir !== 'string' || dir.trim() === '') continue;
    const root = resolve(dir.trim());
    if (seen.has(root)) continue;
    seen.add(root);
    out.push(root);
  }
  return out;
}

/**
 * 从一条 loader row 的 config 中取 customSkillDirs。
 *
 * @param config loader row 的配置对象
 * @returns 声明的自定义技能根（未规范化）
 */
function customSkillDirsOf(config) {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) return [];
  const value = config.customSkillDirs;
  if (!Array.isArray(value)) return [];
  return value.filter((dir) => typeof dir === 'string');
}

/**
 * 判断一条 loader row 是否是 skill-filesystem provider。
 *
 * @param entry loader 条目
 * @returns 是否为技能文件系统 provider 行
 */
function isSkillFilesystemRow(entry) {
  const candidates = [entry?.options?.id, entry?.options?.name, entry?.id, entry?.name];
  return candidates.some((id) => typeof id === 'string' && id.includes('dsh-skill-filesystem'));
}

/**
 * 收集所有存活 loader row 声明的自定义技能根。
 *
 * 官方文档把 provider 挂成 profile row，customSkillDirs 写在那条 row 上而不是
 * 本插件上；只读本插件自己的 config 会让这些技能出现在「自定义目录」分组里却
 * 没有可写路径。row 的原始 options.config 与解析后的 fiber.config 都要读 ——
 * loader 会把 !!js 表达式插值进后者，内置技能目录就写在那种表达式里。
 *
 * @param entries loader 条目可迭代对象
 * @returns 声明的自定义技能根（未规范化）
 */
export function customSkillDirsFromLoader(entries) {
  if (entries === undefined || entries === null) return [];
  const dirs = [];
  try {
    for (const entry of entries) {
      if (!isSkillFilesystemRow(entry)) continue;
      dirs.push(...customSkillDirsOf(entry.options?.config));
      dirs.push(...customSkillDirsOf(entry.fiber?.config));
    }
  } catch {
    return dirs;
  }
  return dirs;
}

/**
 * 去掉 YAML 标量两侧的单引号或双引号。
 *
 * @param value 原始标量文本
 * @returns 去引号后的文本
 */
function unquote(value) {
  if (value.length >= 2) {
    const head = value[0];
    const tail = value[value.length - 1];
    if ((head === '"' && tail === '"') || (head === "'" && tail === "'")) {
      const inner = value.slice(1, -1);
      return head === "'" ? inner.replace(/''/g, "'") : inner;
    }
  }
  return value;
}

/**
 * 解析 YAML 布尔字面量。
 *
 * @param value 原始标量文本
 * @returns true/false；不是布尔字面量时返回 undefined
 */
function parseYamlBool(value) {
  const text = String(value).trim().toLowerCase();
  if (['true', 'yes', 'on', '1'].includes(text)) return true;
  if (['false', 'no', 'off', '0'].includes(text)) return false;
  return undefined;
}

/**
 * 把一个 SKILL.md 拆成 frontmatter 块与正文两部分。
 *
 * frontmatter 块含开头与结尾的两条 `---` 分隔线（不含结尾换行），正文是分隔线之后的全部内容；
 * 没有 frontmatter 时 frontmatter 为空串、正文退回全文。写入端的 rewriteBody 依赖这一对纯粹的分界，
 * 以保证「改正文不动 frontmatter」。
 *
 * @param content SKILL.md 全文
 * @returns { frontmatter, body } 拆分结果
 */
export function splitSkillDocument(content) {
  const text = String(content ?? '');
  const open = /^---[ \t]*\r?\n/.exec(text);
  if (open === null) return { frontmatter: '', body: text };
  const bodyStart = open[0].length;
  const close = /^---[ \t]*\r?$/m.exec(text.slice(bodyStart));
  if (close === null) return { frontmatter: '', body: text };
  const frontmatterEnd = bodyStart + close.index + close[0].length;
  return { frontmatter: text.slice(0, frontmatterEnd), body: text.slice(frontmatterEnd) };
}

/**
 * 归一化技能正文：统一换行符为 \n、去掉与 frontmatter 之间的空行与行尾空白，
 * 并保证非空正文以单个换行结尾。
 *
 * 归一化让「读出来的正文」与界面上文本框里的内容完全一致：用户没改正文时，
 * 客户端提交的文本与读取值相等，因而不会触发写盘，SKILL.md 一个字节都不会变。
 *
 * @param text 原始正文（frontmatter 之后的内容）
 * @returns 归一化后的正文；正文为空时返回空串
 */
export function normalizeBody(text) {
  const clean = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/^[\n]+/, '')
    .replace(/[ \t\n]+$/, '');
  return clean === '' ? '' : clean + '\n';
}

/**
 * 解析 SKILL.md 的 frontmatter 块（零依赖的轻量实现）。
 *
 * 只认卡库真正需要的字段：name / description / whenToUse 以及两个调用开关。
 * 支持折叠块标量（| 与 >），未知键静默忽略 —— 与官方 provider 的行为一致，
 * 因为官方也是逐字透传、不认识的键不影响加载。
 *
 * @param content SKILL.md 全文
 * @returns 解析出的字段对象；没有 frontmatter 时返回空对象
 */
export function parseFrontmatter(content) {
  const match = FRONTMATTER_BLOCK.exec(String(content ?? ''));
  if (match === null) return {};
  const out = {};
  const lines = match[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const kv = FRONTMATTER_LINE.exec(lines[i]);
    if (kv === null) continue;
    const key = kv[1];
    const rawRest = kv[2];
    const rest = rawRest.trim();
    if ((rest.startsWith('|') || rest.startsWith('>')) && rest.length <= 3) {
      const folded = rest.startsWith('>');
      const chunk = [];
      let j = i + 1;
      for (; j < lines.length; j += 1) {
        const line = lines[j];
        if (line.trim() === '') {
          chunk.push('');
          continue;
        }
        if (!/^[ \t]/.test(line)) break;
        chunk.push(line.replace(/^[ \t]{1,}/, ''));
      }
      i = j - 1;
      while (chunk.length > 0 && chunk[chunk.length - 1] === '') chunk.pop();
      out[key] = folded ? chunk.join(' ').trim() : chunk.join('\n');
      continue;
    }
    if (key === 'description' || key === 'name' || key === 'whenToUse') {
      out[key] = unquote(rest);
      continue;
    }
    if (key === 'user-invocable' || key === 'disable-model-invocation') {
      const bool = parseYamlBool(rest);
      if (bool !== undefined) out[key] = bool;
    }
  }
  return out;
}

/**
 * 找出项目根下所有名为 `skills` 的目录（最多下探 SKILL_DIR_MAX_DEPTH 层）。
 *
 * 项目里的技能目录不止 `.dsh/skills`、`.agents/skills` 这两种：实际见过
 * `.agents/bm2-skills/skills`、`.claude/skills`、`.claude/bm2-skills/skills`。
 * 所以改成「3 层内任何叫 skills 的目录都算」，找到即收，不再往里下探
 * （技能目录里不会再有技能目录）。
 *
 * @param root 项目根绝对路径
 * @returns 相对项目根的目录（`/` 分隔，例如 `.agents/bm2-skills/skills`），已排序
 */
export async function findSkillDirs(root) {
  if (typeof root !== 'string' || root === '') return [];
  const found = [];
  let level = [''];
  let walked = 0;
  for (let depth = 1; depth <= SKILL_DIR_MAX_DEPTH && level.length > 0; depth += 1) {
    const next = [];
    for (const rel of level) {
      let entries;
      try {
        entries = await readdir(rel === '' ? root : join(root, rel), { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
        const name = entry.name;
        if (SKIP_WALK_DIRS.has(name)) continue;
        walked += 1;
        if (walked > MAX_WALK_DIRS) {
          level = [];
          next.length = 0;
          break;
        }
        const childRel = rel === '' ? name : rel + '/' + name;
        if (name === 'skills') {
          found.push(childRel);
          continue;
        }
        next.push(childRel);
      }
    }
    level = next;
  }
  return found.sort();
}

/**
 * 读取单个技能文件的 frontmatter，并组装成一条技能记录。
 *
 * @param filePath SKILL.md（或顶层 <name>.md）的绝对路径
 * @param level 该文件所属技能根的来源标识
 * @param directory 该技能所在的资源目录（目录形态为技能目录本身，散文件形态为其所在技能根）
 * @param linked 该条目是否是符号链接
 * @returns 技能记录；frontmatter 不合法时返回 undefined
 */
async function readSkillFile(filePath, level, directory, linked) {
  let content;
  try {
    content = await readFile(filePath, 'utf8');
  } catch {
    return undefined;
  }
  const fields = parseFrontmatter(content);
  const name = typeof fields.name === 'string' ? fields.name.trim() : '';
  const description = typeof fields.description === 'string' ? fields.description.trim() : '';
  if (name === '' || description === '' || !isSkillName(name)) return undefined;
  const realPath = await realPathOf(filePath);
  return {
    name,
    description,
    whenToUse: fields.whenToUse,
    body: normalizeBody(splitSkillDocument(content).body),
    id: idOfPath(realPath),
    realPath,
    level,
    path: filePath,
    directory,
    linked: linked === true,
    modelInvocable: fields['disable-model-invocation'] !== true,
    userInvocable: fields['user-invocable'] !== false,
  };
}

/**
 * 扫描一个技能根（只扫一层：<name>/SKILL.md 或顶层的 <name>.md）。
 *
 * @param root 技能根绝对路径
 * @param level 来源标识
 * @param into 结果 Map（以技能名为键）
 * @param skipSystem 是否跳过 .system 目录
 * @param projectRoot 项目技能所属的项目根（非项目技能不传）
 * @param skillsDir 该技能根相对项目根的目录（用于「目录」筛选）
 * @returns 无
 */
async function scanSkillRoot(root, level, into, skipSystem, projectRoot, skillsDir) {
  if (typeof root !== 'string' || root === '') return;
  let entries;
  try {
    if (!existsSync(root)) return;
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  let count = 0;
  for (const entry of entries) {
    count += 1;
    if (count > MAX_ROOT_ENTRIES) break;
    if (skipSystem === true && entry.name === '.system') continue;
    let file;
    let directory = root;
    let linked = false;
    if (entry.isDirectory()) {
      file = join(root, entry.name, 'SKILL.md');
      directory = join(root, entry.name);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      file = join(root, entry.name);
    } else if (entry.isSymbolicLink()) {
      linked = true;
      try {
        const target = await stat(join(root, entry.name));
        if (target.isDirectory()) file = join(root, entry.name, 'SKILL.md');
        else if (target.isFile() && entry.name.endsWith('.md')) file = join(root, entry.name);
        else continue;
        directory = join(root, entry.name);
      } catch {
        continue;
      }
    } else {
      continue;
    }
    const record = await readSkillFile(file, level, directory, linked);
    if (record === undefined) continue;
    // 项目技能记住它属于哪个项目根，界面「项目技能」下的项目下拉要靠它分组
    if (typeof projectRoot === 'string' && projectRoot !== '') record.projectRoot = projectRoot;
    if (typeof skillsDir === 'string' && skillsDir !== '') record.skillsDir = skillsDir;
    // 按「真实路径」去重：同名但不同路径算两个技能；符号链接指向同一份才合并。
    // 同一份文件既被真实目录扫到、又被 junction 扫到时，保留非链接的那条 —— 否则
    // 并行扫描的先后顺序会让这个技能随机「搬到」另一个项目名下。
    const key = record.id;
    const existing = into.get(key);
    const sameRank = existing !== undefined && rankOf(record.level) === rankOf(existing.level);
    if (
      existing === undefined
      || rankOf(record.level) < rankOf(existing.level)
      || (sameRank && existing.linked === true && record.linked === false)
    ) {
      into.set(key, record);
    }
  }
}

/**
 * 把注册表（ctx.skills.snapshot）里的一条技能转换成扫描记录的形状。
 *
 * @param skill 注册表技能摘要
 * @returns 扫描记录形状的对象；缺少可用路径时 path 为 undefined
 */
async function fromRegistry(skill) {
  const source = typeof skill.source === 'string' ? skill.source : 'runtime';
  const path = typeof skill.path === 'string' && skill.path !== '' ? skill.path : undefined;
  const realPath = path === undefined ? undefined : await realPathOf(path);
  return {
    name: skill.name,
    description: typeof skill.description === 'string' ? skill.description : '',
    whenToUse: skill.whenToUse,
    // 注册表里的技能可能没有可定位的文件（运行时注册），此时用名字做身份
    id: realPath === undefined ? 'runtime:' + String(skill.name ?? '') : idOfPath(realPath),
    realPath,
    level: source,
    path,
    directory: skill.resourceBase?.kind === 'directory' ? skill.resourceBase.path : undefined,
    linked: false,
    modelInvocable: skill.invocation?.modelInvocable !== false,
    userInvocable: skill.invocation?.userInvocable !== false,
  };
}

/**
 * 收集全部技能：文件系统扫盘为主，注册表按名合并补充。
 *
 * @param options cwd / projectRoots / registryRoots / customSkillDirs / dshHome / agentsHome / registry
 * @returns { skills, complete } —— skills 为技能记录数组，complete 表示注册表是否完整
 */
export async function collectSkills(options) {
  const opts = options ?? {};
  const cwd = resolve(opts.cwd ?? process.cwd());
  const byId = new Map();
  const activeProjectRoot = findProjectRoot(cwd);
  const roots = new Set(
    Array.isArray(opts.projectRoots) && opts.projectRoots.length > 0
      ? [activeProjectRoot].concat(opts.projectRoots.map((root) => resolve(root)))
      : [activeProjectRoot],
  );
  // 注册表快照是逐个 cwd 串行调的，代价远高于扫盘；工作空间列表可能有好几个项目，
  // 但它们的技能就在 .dsh/skills、.agents/skills 里，扫盘已经覆盖，不必每个都问一次注册表。
  const registryRoots = new Set(
    (Array.isArray(opts.registryRoots) ? opts.registryRoots.map((root) => resolve(root)) : [...roots]).concat([cwd]),
  );
  const tasks = [];
  for (const root of roots) {
    // 每个项目根先找出它所有的 skills 目录，再逐个扫（`skills` 目录名保持不变，
    // `.dsh/skills` 单独归类，其余统一算项目技能）
    tasks.push((async () => {
      const dirs = await findSkillDirs(root);
      for (const rel of dirs) {
        const level = rel === '.dsh/skills' ? 'project-dsh' : 'project-agents';
        await scanSkillRoot(join(root, rel), level, byId, false, root, rel);
      }
    })());
  }
  for (const dir of normalizeSkillRoots(opts.customSkillDirs)) {
    tasks.push(scanSkillRoot(dir, 'custom', byId, false));
  }
  if (typeof opts.dshHome === 'string' && opts.dshHome !== '') {
    tasks.push(scanSkillRoot(join(opts.dshHome, 'skills'), 'user-dsh', byId, true));
  }
  if (typeof opts.agentsHome === 'string' && opts.agentsHome !== '') {
    tasks.push(scanSkillRoot(join(opts.agentsHome, 'skills'), 'user-agents', byId, false));
  }
  await Promise.all(tasks);

  let complete = true;
  const registry = opts.registry;
  if (registry !== undefined && registry !== null && typeof registry.snapshot === 'function') {
    for (const snapshotCwd of registryRoots) {
      try {
        const snapshot = await registry.snapshot({ cwd: snapshotCwd });
        if (snapshot?.complete !== true) complete = false;
        for (const skill of snapshot?.skills ?? []) {
          const record = await fromRegistry(skill);
          if (record.name === undefined || record.name === '') continue;
          let key = record.id;
          let existing = byId.get(key);
          if (existing === undefined && record.path === undefined) {
            // 注册表没给路径（运行时注册）：并入扫盘结果里同名的那条，别凭空多出一张卡
            const sameName = [...byId.values()].filter((item) => item.name === record.name);
            if (sameName.length > 0) {
              existing = sameName[0];
              key = existing.id;
            }
          }
          if (existing === undefined) {
            byId.set(key, record);
            continue;
          }
          if (rankOf(record.level) < rankOf(existing.level)) {
            // 同一份技能由更高优先级的来源提供：换记录但保住已探到的路径与身份
            byId.set(key, {
              ...record,
              id: key,
              path: record.path ?? existing.path,
              realPath: record.realPath ?? existing.realPath,
              directory: record.directory ?? existing.directory,
            });
            continue;
          }
          if (rankOf(record.level) > rankOf(existing.level)) continue;
          if (existing.path === undefined && record.path !== undefined) {
            existing.path = record.path;
            existing.realPath = record.realPath;
          }
          if (existing.directory === undefined && record.directory !== undefined) {
            existing.directory = record.directory;
          }
        }
      } catch {
        complete = false;
      }
    }
  }

  const skills = [...byId.values()].sort((a, b) => {
    const diff = rankOf(a.level) - rankOf(b.level);
    if (diff !== 0) return diff;
    const byName = a.name.localeCompare(b.name);
    // 同名技能来自不同项目时，按路径排一下，保证每次刷新顺序一致
    return byName !== 0 ? byName : String(a.path ?? '').localeCompare(String(b.path ?? ''));
  });
  return { skills, complete };
}

/**
 * 生成技能在界面上的展示名（无中文名时退化为技能名）。
 *
 * @param skill 技能记录
 * @returns 展示用名称
 */
export function displayNameOf(skill) {
  return skill?.name ?? '';
}

/**
 * 取该技能文件所在目录的展示路径。
 *
 * @param skill 技能记录
 * @returns 目录绝对路径；未知时返回空串
 */
export function directoryOf(skill) {
  if (typeof skill?.directory === 'string' && skill.directory !== '') return skill.directory;
  if (typeof skill?.path === 'string' && skill.path !== '') return dirname(skill.path);
  return '';
}

/**
 * 判断技能的展示根目录名（用于判断技能是目录形态还是散文件形态）。
 *
 * @param skill 技能记录
 * @returns 根目录名
 */
export function rootBaseName(skill) {
  const dir = directoryOf(skill);
  return dir === '' ? '' : basename(dir);
}
