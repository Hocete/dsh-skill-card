/**
 * skill-card —— 技能卡库（host 半边）。
 *
 * 提供 /api/dsh-skill-card 路由族：把 DSH 的本地技能扫成「游戏卡牌」数据，
 * 并把卡片属性（分类/稀有度/星数/五维/标签/美术配方）存进 side-car 文件，
 * 绝不写进 skill 自身的 frontmatter。浏览器半边（./client）渲染卡库面板。
 *
 * 只依赖官方 SDK 与 Node 内置模块，不改动 DSH 自身源码。
 */
import { homedir } from 'node:os';
import { sep, join } from 'node:path';
import { makeRoutes } from './routes.js';
import { initStore } from './store.js';

/** 稳定的 cordis 插件名。 */
const name = 'skill-card';

/** 挂载路由前必须就绪的服务。 */
const inject = ['webServer', 'skills', 'sessions'];

/** 单实例标记，防止同一进程里重复挂载同一套路由。 */
const MOUNTED = Symbol.for('dsh-skill-card.mounted');

/**
 * 解析 DSH 主目录与技能目录。
 *
 * @param config 插件配置
 * @returns { dshHome, agentsHome }
 */
function resolveHomes(config) {
  const dshHome = typeof config?.dshHome === 'string' && config.dshHome !== ''
    ? config.dshHome
    : (process.env.DSH_HOME ?? homedir() + sep + '.dsh');
  const agentsHome = typeof config?.agentsHome === 'string' && config.agentsHome !== ''
    ? config.agentsHome
    : (process.env.DSH_AGENTS_HOME ?? homedir() + sep + '.agents');
  return { dshHome, agentsHome };
}

/**
 * 挂载技能卡库的 host 路由。
 *
 * @param ctx host 插件上下文（需要 webServer 与 sessions）
 * @param config 插件配置
 * @returns 无
 */
function applyImpl(ctx, config) {
  if (config?.enabled === false) return;
  const homes = resolveHomes(config);
  initStore(homes.dshHome);
  const routes = makeRoutes(ctx, {
    dshHome: homes.dshHome,
    agentsHome: homes.agentsHome,
    artModel: config?.artModel,
    logger: {
      warn: (message, error) => {
        try {
          ctx.logger.warn(error === undefined ? message : message + ': ' + (error instanceof Error ? error.message : String(error)));
        } catch {
          /* 日志失败不能影响插件运行 */
        }
      },
    },
  });
  ctx.effect(() => {
    const disposers = routes.map((route) => ctx.webServer.register(route));
    return () => {
      for (const dispose of disposers) {
        try {
          dispose();
        } catch {
          /* 卸载期的释放失败不影响其它路由 */
        }
      }
    };
  }, 'skill-card: routes');
}

/**
 * 插件入口（单实例保护 + 异常隔离）。
 *
 * apply 抛异常会让整个 web shell 启动失败，因此这里必须兜住所有异常。
 *
 * @param ctx host 插件上下文
 * @param config 插件配置
 * @returns 无
 */
function apply(ctx, config) {
  if (globalThis[MOUNTED] === true) return;
  globalThis[MOUNTED] = true;
  try {
    applyImpl(ctx, config);
  } catch (error) {
    globalThis[MOUNTED] = false;
    try {
      ctx.logger.warn('skill-card: 挂载失败，插件已跳过：' + (error instanceof Error ? error.message : String(error)));
    } catch {
      /* 忽略 */
    }
  }
}

export { apply, inject, name };

/** 供本地自检使用：直接取卡库文件的默认位置。 */
export function defaultStorePath(dshHome) {
  return join(dshHome ?? homedir() + sep + '.dsh', 'storages', 'skill-card', 'cards.json');
}
