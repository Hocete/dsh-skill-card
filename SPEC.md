# SPEC —— dsh-skill-card 技能卡库插件（交接文档）

> 本文件是**自解释**的交接文档：一个完全没有上下文的新会话，读完本文件就能接手继续开发。
> 不要问"之前的方案是什么"——本文档就是全部上下文。

## 0. 任务目标

为 DSH（DeepSeek Harness，Electron 桌面应用，Web GUI 在 http://127.0.0.1:19387）
开发一个**客户端插件**，把本机安装的所有 skill 渲染成「游戏卡牌」，做成一个技能卡库面板：

- 左侧栏入口（排在「技能中心」下面），点击打开全屏主面板
- 顶部分类栏 + 来源栏 + 自由标签行 + 搜索框
- 中部横向卡牌流，无滚动条，**4 种滑动模式**，选中卡放大居中、其余卡扇形/环形排布
- 点击已选中的卡 → 卡飞到左侧、右侧展开游戏风详情面板，支持**修改 / 删除**
- 新增技能后自动出现、自动生成卡面（全自动，禁止手动上传封面）

**验收标准**：装进 DSH 后重启应用，左侧栏出现「技能卡库」入口；打开能列出本机 13 个技能；
4 种滑动模式都能用；能改属性、能改描述、能删技能、能新建技能；新技能自动出卡面。

## 1. 需求定案（已与用户 100% 确认，不要再问）

| 项 | 定案 |
|---|---|
| 交付形态 | **本地 profile 直装**（代码按可发布 npm 包标准写） |
| 数据存储 | **side-car**：`C:\Users\WIN10\.dsh\storages\skill-card\cards.json`；**卡片属性绝不写进 SKILL.md** |
| 卡面风格 | **方案 A：矢量纹章**（本地算图画 SVG，零外部依赖），已获用户验收 |
| 数值 | **五维**：能力 / 效率 / 通用 / 稳定 / **命中**，详情页可逐个改 |
| 等级 | 稀有度（N/R/SR/SSR/UR）+ 星数（1-5），详情页可改 |
| 标签 | **全手动添加**（详情页「＋」号），**无数量上限**，可删；不做模型自动生成标签 |
| 筛选 | 分类行 + 来源行 + 标签行**叠加（交集）** + 搜索框（技能名 / 描述 / 标签） |
| 增删改 | 详情页支持改属性、**改描述（写回 SKILL.md）**、删除技能（二次确认）、顶栏/卡片流新建技能 |
| 与旧插件关系 | **全新独立插件**，不复用也不依赖 skill-explorer |

### 1.1 关键澄清（容易搞错）

- **「不动 skill 文件」的准确含义**：只是指卡片属性（分类/稀有度/星数/五维/标签/配色）不写进 SKILL.md。
  **技能描述是例外——用户明确要求可以改，并写回 SKILL.md 的 frontmatter**。
- **不可写技能的处理**：13 个技能里有 7 个不可写（4 个打包在 app.asar 内置资源里，3 个由
  `@openviking/dsh-memory-plugin` 提供、位于 node_modules）。
  - 这类技能的**卡片属性全部照常可改**（都在 side-car）。
  - 只有**描述不可改**（输入框置灰 + 小字说明原因）。
  - 「✎ 修改」按钮**保持常亮**；只有删除按钮变化：可写 = `🗑 删除技能`（红色，二次确认）；
    不可写 = `🔒 只读技能`（**置灰**）。
  - ⚠️ 置灰必须用 `aria-disabled` + CSS，**不能用原生 `disabled`**——原生 disabled 不触发 click，
    而用户要求「点击时弹提示说明不能删的具体原因」。三类原因文案：
    1. `🔒 该技能打包在 DSH 应用内置资源（app.asar）中，应用目录只读，无法删除。`
    2. `🔒 该技能由已安装的插件包 @openviking/dsh-memory-plugin 提供，属于插件内容，删除会破坏该插件；如需移除请卸载该插件。`
    3. `🔒 当前用户对该路径没有写权限：<绝对路径>`
- **新建技能的位置**：「＋ 新建技能」入口两处都做——
  ① 顶栏右侧按钮（4 种模式下常驻）；
  ② 卡片流里的**虚线「＋」空白卡**，位置**随模式自适应**：
  - 扇形轮播 / 平滑放大 / 环形旋转 → 列表**最前**（索引 0）
  - 叠牌抽卡 → 牌堆**最底**（列表最后一位）
  虚线卡**不参与计数**（底栏仍显示 `1 / 13`）、**不参与筛选**（任何筛选下都在，
  搜索无结果时它是轨道上唯一保留的卡）、点击**直接开新建表单**（不进详情页）、滑到它时底部详情栏隐藏。
  默认建成**目录形态**：`C:\Users\WIN10\.agents\skills\<技能名>\SKILL.md`。

## 2. 架构与文件清单

### 2.1 最终安装位置

- **开发目录（唯一工作目录）**：`F:\DeepSeek\dsh-skill-card\`
- **安装目录**：`C:\Users\WIN10\.dsh\profiles\desktop\node_modules\dsh-skill-card\`（把开发目录整体拷过去）
- 还要改 `C:\Users\WIN10\.dsh\profiles\desktop\package.json`：把 `dsh-skill-card` 加进
  `dependencies` 和 `dsh.profile.bundles` 数组（数组里其它条目原样保留）。
- **改完后必须重启 DeepSeek Harness 应用才生效**（新包不支持热加载；
  只有已加载插件改 `lib/client.js` 才会 500ms 轮询热替换）。
- ⚠️ **不能自己重启应用**：当前会话就跑在这个 Electron 进程里（PID 34268，监听 19387），
  重启会终止会话。必须让用户手动重启（或用户在应用内操作）。
- ⚠️ **不能用 CLI 装**：`dsh plugin --profile desktop ...` 会被拒绝，报
  `error: profile "desktop" is managed exclusively by the Electron application`。
  只能手工拷贝 + 改 package.json。

### 2.2 开发目录已有文件（host 半边，**已完成，除两处待修 bug 外不要再改**）

| 文件 | 职责 |
|---|---|
| `package.json` | 包声明：`type:module`、`main:lib/index.js`、`exports` 含 `./client`、
`dsh.bundle.patch=./cordis.patch.yml`、`dsh.client={platform:'web',immediately:true,inject:[...]}` |
| `cordis.patch.yml` | 两行 insert：`id: ui-skill-card` / `name: 'dsh-skill-card'`（客户端插件的启用靠 profile bundles 列表，此文件是 bundle 层 patch） |
| `icon.svg` | 24x24 描边风两张叠放卡片 |
| `lib/scan.js` (13.3KB) | 扫 6 个技能根 + 合并 registry，出技能列表 |
| `lib/store.js` (4.2KB) | side-car 读写（原子写：临时文件 + rename） |
| `lib/art.js` (12.9KB) | 卡面美术：保底卡面（确定性 hash）+ 模型配方生成 + 合并 |
| `lib/skillfile.js` (8.6KB) | skill 文件操作：可写探测 / 描述写回 / 删除 / 新建 |
| `lib/workspaces.js` (1.6KB) | 读 DSH 工作空间列表（`storages/workspace.json`）作为项目根候选；解析失败一律返回空数组 |
| `lib/routes.js` (19.9KB) | 7 个 HTTP 路由（含回环信任围栏） |
| `lib/index.js` (2.75KB) | 插件入口：`name='skill-card'`、`inject=['webServer','sessions']`、`apply()` 单实例 + 全异常兜底 |
| `.smoke\scan-test.mjs` | 本地自测脚本（node 直跑，验证扫技能） |

### 2.3 ✅ 两处 bug **已修复**（对应 §7 第 0 步）

1. **`lib/scan.js:75` 的 `findProjectRoot(cwd)` 返回错值**：实测 `findProjectRoot('F:\\DeepSeek')` 返回 `'F:\\'`。
   官方 skill-explorer 的实现（`...\@linxin666\dsh-client-ui-skill-explorer\lib\index.js` 312-316 行）是：
   注释 *"Find the nearest ancestor directory containing .git (cwd itself when none)"*，
   循环 `if (existsSync(join(current, ".git"))) return current;`，**走到底没找到就返回传入的 cwd 本身**。
   修法：把"找不到就返回盘根/undefined"改成"返回传入的 cwd"。
2. **`lib/index.js:19` 的 `inject` 缺 `'skills'`**：现在是 `['webServer','sessions']`，
   应改成 `['webServer','skills','sessions']`（对齐 skill-explorer 的 `['webServer','skills','sessions']`），
   否则 `ctx.get('skills', false)` 取不到 registry，列表会少掉 7 个技能（只剩磁盘扫到的 6 个）。

### 2.4 ✅ 已写文件（原「待写」）

| 文件 | 说明 |
|---|---|
| `lib/client.js` | **浏览器半边（核心工作量）**。必须手写 lazy-CJS 包装，不能用 ESM，不需要打包工具 |
| `README.md` | 包的说明文档（`package.json` 的 `files` 里已列出） |

## 3. 接口契约（host 已实现，client 照此对接）

### 3.1 通用

- 所有路由都是 `kind:'exact'`，注册在 `ctx.webServer.register`。
- **前端必须用文档相对 URL**（`api/dsh-skill-card/list`，**不能以 `/` 开头**）：
  GUI 用 `<base href="./">`，根绝对路径到不了路由（issue #1707）。
- 信任围栏 `isLoopbackRequest`：socket 与 Host 都必须回环，且不能是 `sec-fetch-site: cross-site`；
  不通过 → `403 {error:'forbidden: loopback-only'}`。方法不符 → `405 {error:'method not allowed: X'}`。
- 请求体上限 256KB；解析失败 → 400。
- POST 请求头要带 `content-type: application/json`。

### 3.2 路由表

| 方法 | 路径（文档相对写法） | 请求体 | 成功响应 |
|---|---|---|---|
| GET | `api/dsh-skill-card/list`（可带 `?cwd=<路径>`） | — | 见 3.3 |
| POST | `api/dsh-skill-card/update` | `{name, ...卡片字段}` | `{ok:true, name, card}` |
| POST | `api/dsh-skill-card/set-description` | `{name, description}` | `{ok:true, name, path}` |
| POST | `api/dsh-skill-card/delete` | `{name}` | `{ok:true, name, kind:'directory'\|'file', path, files}` |
| POST | `api/dsh-skill-card/create` | `{name, description, root?}` | `{ok:true, name, path}` |
| POST | `api/dsh-skill-card/refresh` | `{reart?:true, name?:string}` | 同 list（`/refresh` 返回 list 结构；见 3.4） |
| GET | `api/dsh-skill-card/health` | — | `{ok:true, plugin:'skill-card', skills, generated, pending, artVersion}` |

### 3.3 list 响应结构

```
{
  ok: true,
  skills: [ 每条见下 ],
  categories: ['开发','AI 智能体','分析','文档','办公','流程','其它'],
  statKeys: ['能力','效率','通用','稳定','命中'],
  rarities: ['N','R','SR','SSR','UR'],
  pending: <正在生成卡面的技能数，客户端轮询到 0 表示全部就绪>,
  complete: <扫描是否完整>,
  storePath: '<side-car 文件绝对路径>',
  createRoots: [ {key,label,path,writable,reason} x4 ]   // 新建技能可选根，第一个是默认
}
```

每条 skill 字段（**26 个，client 全部要用**）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 技能身份：SKILL.md 的真实路径（Windows 下小写）。**卡片数据、写操作都按它走**；不同路径的同名技能是不同的 id |
| `name` | string | 技能名（DSH 的唯一标识，如 `agently-mail`；不同项目里可以重名） |
| `cn` | string | 中文名（卡面大字），如「邮件代理」 |
| `title` | string | 英文/展示副标题 |
| `category` | string | 分类，取值同 `categories`，未分类时为 `'未分类'` |
| `rarity` | string | `N\|R\|SR\|SSR\|UR` |
| `stars` | number | 1-5 |
| `stats` | number[5] | 五维，顺序同 `statKeys` |
| `tags` | string[] | 自由标签（每个 ≤8 字）；**只由用户手动添加**，模型配方不再产出，v1→v2 迁移会清空存量标签 |
| `motif` | string | 纹样标识（16 种：gear/envelope/terminal/graph/waveform/crystal/orbit/compass/search/shield/doc/grid/slide/key/flask/book） |
| `glyph` | string | 卡面水印首字（中文） |
| `palette` | string[4] | `[bg1,bg2,accent,glow]`，`#rrggbb` |
| `art` | `'model'\|'fallback'` | 卡面来源：模型配方 or 确定性保底 |
| `artPending` | boolean | 该卡面是否还在后台生成中（true 时可显示"生成中"动效） |
| `artTries` | number | 已尝试生成次数（上限 3 次后永久保留保底） |
| `description` | string | 技能描述（**可改，写回 SKILL.md**） |
| `level` | string | 来源标识：project-dsh/project-agents/runtime/custom/user-dsh/user-agents/bundled，以及其它 Agent 的 `agent-claude`/`agent-codex`/`agent-workbuddy` |
| `levelLabel` | string | 来源分组名（**界面「来源」筛选行直接按它分组**）：项目技能/公共技能/自定义目录/系统内置/运行时/Claude Code/Codex/WorkBuddy；未知来源原样返回，空值 `其它` |
| `path` | string | SKILL.md（或散文件 .md）绝对路径 |
| `directory` | string\|undefined | 技能目录（散文件形态为 undefined） |
| `linked` | boolean | 是否符号链接 |
| `canWrite` | boolean | 文件是否可写（决定描述能否改） |
| `canDelete` | boolean | 是否可删 |
| `readonlyReason` | string\|undefined | 不可写原因（**弹提示时直接把这段文案展示给用户**） |
| `deleteTarget` | string | 删除目标绝对路径（可删时才有） |
| `deleteFiles` | number | 删除会连带删掉的文件数（二次确认框里显示） |

### 3.4 update 的字段校验规则（`sanitizePatch`，`lib/routes.js:139-190`）

| 字段 | 规则 | 违规响应 |
|---|---|---|
| `category` | 必须是 7 个分类之一，或 `'未分类'`；空串归一为 `'未分类'` | 400 `分类不合法：X` |
| `rarity` | 必须是 `RARITIES` 之一 | 400 `稀有度不合法：X` |
| `stars` | 1-5 的整数 | 400 `星数必须是 1-5 的整数` |
| `stats` | 长度必须为 5 的数字数组；每项会被 clamp 到 1-99 并取整 | 400 `五维数值必须是长度为 5 的数组` / `五维数值必须是数字` |
| `tags` | 字符串数组；每项 trim + 连续空白折叠成单空格 + 截断 8 字；去重；空项丢弃 | 400 `标签必须是数组` |
| `cn` | 非空字符串，截断 12 字 | — |
| `title` | 非空字符串，截断 40 字 | — |
| `palette` | 长度 4 的数组，每项 `#rrggbb`（配色可改） | 400 `配色必须是长度为 4 的数组` / `配色必须是 #rrggbb 形式` |
| （全空） | 至少一个字段 | 400 `没有可写入的字段` |
| `name` 缺失/空 | 必填 | 400 `expected { name, ...fields }` |

→ **客户端提交时只传改动的字段即可**（patch 语义），但为了简单可以整卡提交。
→ 客户端**应该在本地就先做同样的限制**（星数 1-5、五维 1-99、标签 ≤8 字），避免出现 400。

### 3.5 其它写路由的失败码

- `set-description`：找不到技能 → 404 `找不到技能：<name>`；技能不可写 → 400（`saveDescription` 抛出的原因文案）。
- `delete`：找不到技能 → 404 `找不到技能：<name>`；不可写/不在白名单根内 → 400。
- `create`：缺参数 → 400 `expected { name, description, root }`；
  `root` 不在 `createRoots` 列表里 → 400 `目标技能目录不在允许列表中`；
  根不可写 → 400（`reason` 文案）；技能名不合法或已存在 → 400（`createSkill` 抛出的文案）。
- `refresh`：带 `{reart:true, name:'xxx'}` 时会清掉该技能的卡面缓存并重新生成。
- 未捕获异常统一 400/500 `{error: <message>}`。

### 3.6 卡面生成机制（理解它是为了正确显示 artPending）

1. list 时对每个技能算 `fingerprint`（描述等内容的 sha1 前 16 位）；
2. 没有配方 / 描述变了 / 没生成成功 → 记 `artPending=true`，并**自动排队**一次后台生成
   （`MAX_CONCURRENT_ART=2`，同技能去重）；
3. 生成流程：`ctx.llm.stream` 让模型按技能名+描述输出**严格 JSON 美术配方**
   → 校验 → 存进 side-car（`art:'model'`）；
4. 失败/超时（60s）：`artTries+1`，到 **3 次**就永久保留确定性保底卡面（`art:'fallback'`）；
5. **客户端永远都能拿到可渲染的卡面**：`palette/motif/glyph/stats/...` 一定存在（保底算法兜底），
   `art:'fallback'` 与 `'model'` 的差别只是配方来源；渲染器完全一样。
6. 客户端轮询 list 直到 `pending===0` 即可（建议 1.5s 间隔，仅在有 pending 时轮询）。

## 4. client 半边（`lib/client.js`）实现规格

### 4.1 硬约束（违反 = 面板崩溃或整个 web shell 起不来）

1. **必须是手写 lazy-CJS，不能用 ESM**，必须调用 `window.__ModuleLoader__.load(...)`。
   不需要打包工具、不需要 JSX，直接用 `React.createElement`。
2. **只能 `require('react')`**（`practices.md` 规定）。**禁止 require 任何 `@deepseek-ai/*` Harness 包**，
   否则会报 `slot entry crashed in '<slot>'`。（`react/jsx-runtime` 也可用。）
3. **`apply()` 绝不能抛异常**——会让整个 web shell 启动失败。必须整段 try/catch + `console.warn`。
4. **fetch 必须用文档相对 URL**：`fetch('api/dsh-skill-card/list')`。**不能写 `/api/...`**。
5. **没有插件 CSS 管线**：自己把 CSS 字符串拼好，插入 `<style data-plugin-css="dsh-skill-card">`，
   并且**所有选择器都要作用域化**到一个根容器（如 `.skc-root`）——样张里存在
   `*{}`、`html,body{}`、`body{}`、`h1{}`、`.stage{}`、`#toast{}` 这类**全局选择器，直接抄会污染整个 DSH 界面**。
   只使用 `--dsw-alias-*` 主题 token 取色，禁止 iframe。
6. **面板状态不能放 React state**：`main` 面板切回会话时**会被卸载**，
   分类选中、滚动位置、详情开关等必须放在**控制器对象**里（在 `inject:()=>({...})` 中注入，或用模块级对象）。
7. 注册 slot 必须用 `ctx.slots.inject(...)` 包裹（自动 dispose + 顺序无关）。

### 4.2 文件头尾模板（逐字照抄）

```js
window.__ModuleLoader__.load({
  id: "dsh-skill-card",          // 必须与 package.json 的 name 逐字一致
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let react = require("react");
    const React = react;
    const h = React.createElement;

    /* ...全部实现... */

    exports.apply = apply;
    exports.inject = inject;     // 数组：['slots','layout','locale']（见 4.3）
    return module.exports;
  }
});
//# sourceMappingURL=client.js.map   ← 这一行可省（没有 map 文件就别写）
```

### 4.3 两个 slot 的注册（两行定生死，id 字符串必须完全一致）

```js
const PANEL_ID = "skill-card";

function apply(ctx) {
  try {
    ctx.slots.inject("sidebar.panellist", () => ctx.slots.register(
      { name: "sidebar.panellist", id: PANEL_ID, order: 40, label: () => "技能卡库" },
      PanelIcon
    ));
    ctx.slots.inject("main", () => ctx.slots.register(
      { name: "main", key: PANEL_ID, inject: () => ({ controller, api }) },
      PanelPage
    ));
  } catch (error) {
    console.warn("[skill-card] 客户端挂载失败", error);
  }
}
```

- `sidebar.panellist` 是 **list** 型（用 `id`）；`main` 是 **keyed** 型（用 `key`）；两者必须同字符串。
- `order` 升序排列，实测各插件：插件中心 `0`、定时任务 `10`、任务板 `20`、技能中心 `30`
  → **本插件用 `40`，正好排在技能中心下面**（用户要求）。
- 侧栏按钮外壳自己渲染，插件组件只当**图标**，收到 props `{ size, active }`（返回一个 24x24 的 svg 即可）。
- 主面板组件由外壳渲染，点击侧栏时外壳调用 `ctx.layout.selectPanel('skill-card')`。

## 5. 参考素材（**禁止通读，只按行号读**）

### 5.1 样张（已验证过效果，是卡面与交互的权威实现）

| 文件 | 行数/大小 | 说明 |
|---|---|---|
| `F:\DeepSeek\skillcard-preview\cards.js` | 186 行 / 19787B | **卡面 SVG 渲染器**，导出 `window.CardFace = { card, RECIPES }` |
| `F:\DeepSeek\skillcard-preview\carousel.html` | 663 行 / 37130B | 交互式轮播 + 详情页样张（含 4 种滑动模式） |

**carousel.html 结构索引（要什么读什么）**：

| 行号 | 内容 |
|---|---|
| 1-135 | `<style>`（**含全局选择器，移植时必须加 `.skc-root` 前缀**） |
| 136-159 | body 骨架：`<h1>`137 / `.sub`138 / `#tabs`139 / `.tagbar`（`#taglist`+`#search`）140 / `#modes`（4 个 `.mbtn`）141-146 / 灵敏度 `#sens`+`#sensval`147-150 / `.deck#deck`（`.stage#stage > .track#track`、`#dpanel`、`#confirm`）151-155 / `.hud`（`#count`、`#dots`）156 / `#info`157 / `.hint`158 / `#toast`159 |
| 160-161 | `<script src="cards.js">` + `<script>` 开始 |
| 162-189 | 常量与状态：`CATS`162、`CAPS`163、`RARC`164（N #8b95a5 / R #4a9eff / SR #b06bff / SSR #ffb020 / UR #ff4d6d）、`RARS`165、**`DESC`166-180（13 条真实描述——真实插件里删掉，改由 API 提供）**、`state`181、`WHEEL_BASE=600`182、`cards`183、**`var body=document.body`184（要改成面板根元素）** |
| 197-273 | 纯函数：`esc`197 / `passCat`198 / `passQuery`205 / `passes`216（分类+标签交集+搜索）/ `buildTagRow`225 / `tagChips`249 / `buildTabs`257 / `showInfo`265 |
| **276-309** | **`apply()`：4 种滑动模式的位移公式（见 §6.2）** |
| 314-333 | `renderList`314（重建轨道+指示点）/`refreshKeepingDetail`333（**保存后保持详情面板不关**） |
| 347-374 | `render`347 / `step`354 / `openDetail`361 / `closeDetail`367 |
| **376-421** | **`renderDetail()`：详情/编辑面板全部 HTML** |
| 427-494 | `renderConfirm`427（删除二次确认弹层）/ `toast`434 / `renderCardsOnly`475 / `commitTag`484 |
| 504-516 | 删除确认处理器（`data-act="del-yes"`） |
| 519-569 | 指针交互：`pointerdown`519 / `window.pointermove`526 / `release`537 / `tapAt`550 / `pointerup`565 / 全局 `preventDefault`567-569 |
| 571-584 | 滚轮（**累计位移→换算张数、保留余量、单次封顶 ±5 张**） |
| 585-639 | `keydown`585 / `#tabs` click590 / `#taglist` click597 / `#modes` click608 / `#sens`628 / `#search`637 |
| 641-662 | 调试 hash 解析（`#fan+open+edit+t:标签+q:关键词+索引`；**注释强调「先落索引，再开详情」**） |

### 5.2 cards.js 的 `card(rec, i, mode)` 契约

- `window.CardFace.RECIPES` 是数组，每项字段：
  `{ name, title, cn, cat, rarity, stars, tags[], stats[5], glyph, motif, pal[4], src }`
  → **真实插件里这个结构由 list 路由的 skill 对象直接映射**：
  `{name, title, cn, cat:category, rarity, stars, tags, stats, glyph, motif, pal:palette, src:levelLabel}`
- `CardFace.card(rec, i, mode)` 返回 **240x360** 的卡片 HTML 字符串（外层是
  `<div class="c" style="filter:drop-shadow(...)">` 包着 SVG）。
- 卡面构成：顶左稀有度徽章 + 顶右五星 + 中央纹章圆盘 + 首字水印 + 中文名 + 英文名 +
  标签 chips（**最多 3 个，超出折叠成 `+N`**）+ 底部五列数值（能力/效率/通用/稳定/命中）
  + 来源 + 稀有度光条 + SSR/UR 闪膜 + 双层边框。
- 移植要点：样张里 13 个纹样的画法在 `M = { envelope, doc, grid, slide, gear, terminal, graph, search, crystal, orbit, compass, waveform, shield }`，
  真实插件要用 `MOTIFS`（16 种）里的标识，缺失的 3 种（key/flask/book）**需要补画法**，
  并加兜底（未知 motif 时画默认圆盘）。
- **踩过的坑**：SVG 字符串拼接时写过 `s+='<circle r="'+(s=70)+'"...'`，把变量 `s` 覆盖成 70，已修成字面量。
  移植时注意**不要用赋值表达式嵌进字符串拼接**。

## 6. 界面功能规格

### 6.1 面板结构（自上而下）

1. **分类行**（`#tabs`）：`全部`、`办公`、`开发`、`AI 智能体`、`分析`、`文档`、`流程`
   （每个带**计数徽章**；`未分类` 只在真有此类技能时才出现）+ 右侧 **`＋ 新建技能`** 按钮（4 模式下常驻）。
2. **来源行**（`.bar.srcs` → `#srcs`）：`全部` + 固定顺序的 `项目技能`、`公共技能`、`自定义目录`、
   `系统内置`、`运行时`（计数为 0 也保留，保证入口不会消失）；其余来源
   （`Claude Code` / `Codex` / `WorkBuddy` 等，随本机安装的其它 Agent 变化）**不各占一个按钮**，
   统一收进右侧「其它来源 ▾」下拉，选中后按钮上显示当前来源名。
   - 分组依据是 host 下发的 `levelLabel`，因此 `.dsh/skills` 与 `.agents/skills` 自动并成一组。
   - 项目根取两处并集：已打开会话的 cwd（向上找最近的 `.git`）+ DSH 工作空间列表
     （`<dshHome>/storages/workspace.json` 的 `tables.workspaces[*].path`）。
     工作空间只做扫盘、不逐个调注册表快照（`registryRoots` 仅含已打开会话），避免 7 次串行快照。
   - 「项目技能」**本身就是**一个下拉（复用 `.srcdd` 组件），不再是普通 tab + 另一个「项目：全部」下拉：
     默认文案 `项目技能`（= 全部项目），选中具体项目后文案换成项目名；
     项目名取 `levelLabel === '项目技能'` 那批技能的 `project` 字段，host 用工作空间 title、退化为目录名。
     切到别的来源时自动清空项目筛选。
   - 下拉的关闭监听挂在**捕获阶段**：展开时 `#srcs` 会整块重绘，冒泡阶段被点的按钮已脱离文档，
     `closest('#srcs')` 会误判成「点在面板外」，导致刚展开就被自己关掉。
3. **标签行**（`.tagbar`）：`标签` 前缀 + 自由标签 chips（多选，**与分类、来源叠加取交集**）
   + 清除 chip + 搜索框（placeholder：`搜索技能名 / 描述 / 标签`）。
   - 标签 chips 的产生：对**当前分类+来源+搜索**命中的集合做 tally，按出现次数降序排列。
   - 标签**只能手动维护**（详情页「＋ 标签」新增、「×」删除），模型配方不再产出标签。
   - 搜索范围：技能名 + 描述 + 标签（大小写不敏感，子串匹配）。
4. **模式切换行**（`#modes`）：扇形轮播 / 环形旋转 / 平滑放大 / 叠牌抽卡（**默认扇形轮播**）。
5. **滚轮灵敏度**（`#sens` range 1-10，默认 **6**）+ 读数文本
   `每格滚轮 ≈ (100*sens/600).toFixed(1) 张卡`（6 → "1.0 张卡"）。
6. **卡牌舞台**（`.deck > .stage > .track`）+ **详情面板**（`#dpanel`）+ **确认弹层**（`#confirm`）。
7. **HUD**：`#count` 显示 `当前位次 / 总数`（如 `1 / 13`，**虚线新建卡不计入**）+ `#dots` 指示点。
8. **底部信息栏** `#info`（当前卡的中文名/描述摘要）。滑到虚线新建卡时**隐藏**。
9. `#toast` 轻提示。

### 6.2 四种滑动模式（`apply()`，样张 276-309 行）

设 `dd = index - state.index`（当前卡为 0），`ad = Math.abs(dd)`，轨道 `transform` 与每张卡的
`transform/opacity/zIndex` 按下表计算：

| 模式 | 每张卡的位移公式 | 备注 |
|---|---|---|
| `fan`（扇形，**默认**） | `translateX(dd*134) rotate(dd*8.5deg) scale(max(.5, 1-ad*.155)) translateY(ad*24)`；`opacity = ad>4 ? 0 : 1-ad*.14` | 选中卡放大居中，其余向两侧扇形散开 |
| `ring`（环形旋转） | `rotateY(dd*26deg) translateZ(520px)` | `.stage` 必须有 `perspective: 2200px` 才立体 |
| `smooth`（平滑放大） | `translateX(dd*232)` + `scale(dd===0 ? 1.18 : .84)` | 最朴素的居中放大 |
| `deck`（叠牌抽卡） | `e = dd<0 ? 0 : dd`；`translateX(e*16) translateY(-e*9) rotate(e*2.6deg) scale(1-e*.055)`；`dd<0` 的卡**隐藏** | 牌堆式，只能向后抽 |

- 切换模式时给 `.stage` 加/去 `ring` 类（只有环形成立需要 perspective）。
- **详情态位移**：选中卡 `translate(-50%,-50%) translateX(flyX) scale(1.07)`，
  `flyX = -(deck.clientWidth/2 - 210)`；其余卡同位移但 `scale(.86)` + `opacity:0`（藏在后面）。
- `#dpanel` 的 CSS：`left:432px; right:0; top:0; bottom:0; z-index:1500`，`.deck.open .dpanel` 淡入
  （`.stage` 有 perspective 自成 stacking context，所以面板能盖住卡）。

### 6.3 交互（指针 / 滚轮 / 键盘）

- **指针**：`pointerdown` 时 `e.preventDefault()`（阻断文本选中、原生拖拽、中键自动滚动），
  `e.button` 0/1/2 **都接受**（右键也能拖，右键菜单被屏蔽）。**不要用 `setPointerCapture`**
  ——它会把后续鼠标事件（含 click）重定向到舞台，导致卡片点击永远收不到。
  改为在 `window` 上监听 `pointermove/pointerup`，用 `document.elementFromPoint` 做命中测试。
- **点选**：`release` 里 **`if(!moved) tapAt(x,y)` 必须在复位轨道位移之前调用**，否则坐标被位移带偏。
  `tapAt` 从 `elementFromPoint` 结果向上找 `.card3d`：
  - 点到未选中卡 → 跳到该卡；点到**已选中**卡 → 打开详情（再点一次关闭，开关式）。
- **拖拽翻页**：`if(dx < -65) step(1); else if(dx > 65) step(-1)`；拖拽中轨道
  `transform = translateX(dx*.6)`；`.track` 加 `transition:transform .32s` 让回弹有动画。
- **全局屏蔽**：`["contextmenu","selectstart","dragstart","mousedown"]` 全部 `preventDefault()`，
  `.stage` 与 `.stage *` 加 `user-select:none; -webkit-user-drag:none`。
- **滚轮**（`passive:false`）：`deltaMode` 1→`*16`、2→`*400`；横竖取绝对值大的那个；
  累计到 `wheelAcc`，`unit = 600 / sens`，`n = Math.trunc(wheelAcc/unit)`，
  单次事件封顶 `c = clamp(n, -5, 5)`；若被封顶则余量清零，否则
  `wheelAcc -= c*unit`（**保留未满一张的余量**，这是"滚轮走不动/只走一张"的关键修复）。
  详情态下滚轮/拖拽/方向键**全部锁死**。
- **键盘**：`Escape` 关详情；详情态下方向键失效。

### 6.4 详情 / 编辑面板（样张 `renderDetail()` 376-421 行）

**只读态**（`state.detail >= 0 && !state.editing`）自上而下：
1. 稀有度徽章（切角矩形，底色 `RARC[rarity]`）+ 分类 + 星数（★×stars）
2. 中文名（大字）+ 英文名 `title` + 来源 `levelLabel`
3. **五维数值条**（能力 / 效率 / 通用 / 稳定 / 命中，每项一条进度条 + 数字）
4. 技能描述（全文）
5. **标签区**：每个标签一个 chip（带 `×` 可删）+ 一个 **`＋ 标签`** 按钮
6. 按钮行：`✎ 修改`（**始终可用**）、`🗑 删除技能` 或 `🔒 只读技能`（见 §1.1）、`✕ 关闭`

**编辑态**（`state.editing === true`）：
- `#f-cat`：`<select>` 选分类
- `#f-rar`：5 个 `.rpick`（`data-rar`）选稀有度
- `#f-star`：5 个 `data-star` 选星数
- **5 个 `.snum`**（`input[data-stat]`）：五维数值，逐个可改（**这是用户明确要求的"命中也能改"**）
- `#f-desc`：`<textarea>` 改描述
- 标签区同样可增删
- 按钮行：`✓ 保存修改`、`取消`

**保存流程（两步，必须按这个顺序）**：
1. 属性类改动 → `POST api/dsh-skill-card/update`（body = `{name, category, rarity, stars, stats, tags, cn, title, palette}`）
2. 描述变了 → `POST api/dsh-skill-card/set-description`（body = `{name, description}`）
   只读技能（`canWrite === false`）时**跳过第 2 步**，并把 textarea 置灰 + 显示
   `该技能位于只读位置（应用内置包 / 插件包），描述不可修改`。
3. 保存成功后**重新拉一次 list 刷新卡片**，并且**必须保持详情面板打开**
   （样张踩过的坑：保存后调 `render()` 会把详情面板强制关闭 → 应调用 `refreshKeepingDetail()`：
   先记住当前卡对象，重建列表后若它还在列表里就回填 `index/detail` 并加回打开态，否则关闭）。

### 6.5 删除（二次确认）

- 点击 `🗑 删除技能` → 弹 `.confirm` 层，文案要显示**绝对路径 + 该目录文件数**：
  `确认删除技能「<cn>」？
将删除：<deleteTarget>
该目录共 <deleteFiles> 个文件。此操作不可撤销。`
- 确认 → `POST api/dsh-skill-card/delete` `{name}` → 成功后重拉 list 并关闭详情。
- 只读技能点 `🔒 只读技能` → **不弹删除确认**，直接 toast 显示 `readonlyReason`。

### 6.6 新建技能

- 两个入口：顶栏 `＋ 新建技能` 按钮、卡片流里的虚线 `＋` 空白卡（位置见 §1.1）。
- 表单字段：技能名（必填，**必须匹配 `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`**，本地先校验）、
  描述（必填）、分类（下拉，默认 `未分类`）、稀有度（默认 `R`）、目标目录（下拉，用 list 返回的 `createRoots`，
  默认第一个 = `~/.agents/skills`；不可写的根要禁用并显示 `reason`）。
- 提交 → `POST api/dsh-skill-card/create` `{name, description, root}` → 成功后重拉 list，
  让这张卡按 name 自动出现在列表里（卡面走保底算法，随后后台生成）。
- 虚线卡的卡面：虚线描边 + 大 `＋` + 文字「新建技能」，样式自定，但要与卡面同尺寸（240x360）。

### 6.7 提示与状态

- `#toast`：所有写操作成功/失败都 toast 一次（成功如 `已保存对 <cn> 的修改`）。
- `artPending === true` 的卡：可在卡面右上角加一个"生成中"微动效，并在 `pending > 0` 时
  每 `1500ms` 轮询一次 list，直到 `pending === 0` 停止（**没有 pending 时不要轮询**）。

## 7. 执行顺序（按此顺序做，每步都可单独验收）

| 步 | 动作 | 验收方式 |
|---|---|---|
| 0 | 修 `lib/scan.js:75` 的 `findProjectRoot`；`lib/index.js:19` 的 `inject` 加 `'skills'` | `node .smoke/scan-test.mjs` 仍出 6 条；确认 `findProjectRoot('F:\\DeepSeek') === 'F:\\DeepSeek'` |
| 1 | 移植 `cards.js` 的卡面渲染器（16 种纹样 + 兜底） | 在 node 里 require 后能对 13 个技能生成 240x360 SVG 字符串，无异常 |
| 2 | 写 `.skc-root` 作用域化的 CSS（从样张 1-135 行改造） | 生成的 CSS 里**不存在**裸露的 `body`/`h1`/`*` 选择器 |
| 3 | 写 React 组件：面板骨架 + 分类行 + HUD + 卡牌轨道 | 能渲染 13 张卡 |
| 4 | 写 `apply()` + 两个 slot 注册 + 控制器对象 | package.json 校验 + 语法校验通过 |
| 5 | 接 API：list / update / set-description / delete / create / 轮询 pending | 逐路由手测 |
| 6 | 四种滑动模式 + 指针/滚轮/键盘交互 | 对照样张行为 |
| 7 | 详情/编辑/删除/新建表单 + 只读技能处理 | 对照 §6.4-6.6 |
| 8 | 写 `README.md` | — |
| 9 | 拷到 profile + 改 profile package.json + **由用户重启应用** | 侧栏出现「技能卡库」且能列出 13 个技能 |

> **进度**：第 0-8 步**全部完成**；第 9 步的「拷包 + 改 profile package.json」也已完成，
> **只剩用户重启应用**（重启会断掉进行中的会话，所以必须交给用户）。

### 7.1 写作纪律（**非常重要，之前就是这里翻车**）

前任会话反复触发「已达到输出 token 上限回答被截断」——根因是**单次工具调用里塞了 20-35KB 的代码**，
单轮输出额度被打满，生成被截断、那个工具调用可能根本没执行。
**所以必须：单次写文件不超过约 200 行 / 8KB，先 write 骨架，再用 edit 分段补进去。**
写完一段就把已落盘的内容从上下文里压缩掉（磁盘上有，随时能再读）。

⚠️ 不要把大任务整个丢给 `subagent_fork` —— 它会**继承父会话的全部历史**，
再叠加读大文件，很容易上下文爆掉（上次就是这么失败的，一个字都没产出）。
要用**全新上下文的 `subagent`**，并且 prompt 里明确禁止通读样张、只给行号范围。

### 7.2 环境与安装事实（别再去试错）

- 应用：`D:\DSH\DSH\DeepSeek Harness.exe`（Electron），监听 **19387**。
  **重启它会断掉正在进行的会话**，所以最后一步必须交给用户。
- profile：`C:\Users\WIN10\.dsh\profiles\desktop\`
  - `package.json`：`dependencies` + `dsh.profile.bundles` 都要加 `"dsh-skill-card"`
  - 现有 bundles：`["@deepseek-ai/dsh-base","@deepseek-ai/dsh-web-app","dshmarket","@linxin666/dsh-client-ui-skill-explorer","@xmanrui/dsh-im","dsh-boot-animation","billion-context","@openviking/dsh-memory-plugin","@linxin666/dsh-remote-web-ui"]`
- **不能用 CLI 安装**（报 `profile "desktop" is managed exclusively by the Electron application`）。
- 本机技能共 **13 个**：6 个在 `C:\Users\WIN10\.agents\skills\<name>\SKILL.md`
  （agently-mail, cosyvoice-tts, graphify, outline-tool-setup, rea-reverse-engineering, server-log-routing），
  7 个来自 registry（4 个 app.asar 内置 office-docx/pptx/xlsx + diagnose-windows-sandbox-acl，
  3 个 `@openviking/dsh-memory-plugin` 的 openviking-memory/openviking-skills/ov-experience-memory）。
- `C:\Users\WIN10\.dsh\skills` **不存在**；`C:\Users\WIN10\.deepseek\skills` 属于**另一个应用，DSH 不读**。
- 调试参照实现（**只读参考，不要改**）：
  `C:\Users\WIN10\.dsh\profiles\desktop\node_modules\@linxin666\dsh-client-ui-skill-explorer\`
  （`lib/client.js` 是 lazy-CJS 的活样板；`lib/index.js` 是 host 路由的活样板，含 `findProjectRoot`）。

### 7.3 已知坑速查

1. **前端 fetch 不能用 `/api/...`**（GUI 有 `<base href="./">`）→ 用 `api/...`。
2. **`setPointerCapture` 会吞掉卡片 click** → 用 `window` 监听 + `elementFromPoint`。
3. **`String.prototype.replace` 传字符串只替换第一处匹配** → 打补丁要用 `indexOf`/`lastIndexOf` + 校验唯一。
4. **在模板字符串里写正则要写 `\\s`**，否则反斜杠被吞（曾把 `/\s+/` 写成 `/s+/`）。
5. **Markdown 里路径带下划线会被当转义** → 发给用户的路径尽量用正斜杠或放在不含下划线的目录。
6. **headless Chrome 截图必须用旧版 `--headless`**，`--headless=new` 配 `--screenshot` 不产出文件；
   断言用 `--dump-dom` + `--window-size=1600,900`（否则 `elementFromPoint` 对屏幕外卡片返回 null）。
7. **`main` 面板切走会被卸载** → 状态放控制器对象，不放 React state。
8. **改 `package.json` / 加新包必须重启应用**；只有已加载插件的 `lib/client.js` 支持 500ms 热替换。
9. `apply()` 抛异常会让**整个 web shell 起不来** → 必须 try/catch。
10. **z-index 跨 stacking context 无效**：`.track` 一旦被 `style.transform`（哪怕只是
    `translateX(0px)`）赋值，就会自成一层 stacking context，卡片的 `z-index:200` 只在
    这层内比较；原本挂在 `.stage` 下、`z-index:199` 的虚线「＋」卡因此压在**整棵轨道**之上，
    点卡片会命中虚线卡（症状：点卡没反应、反而弹出新建表单，详情面板始终为空）。
    修法：**虚线卡必须和真卡一起写进 `#track`**（`NEW_CARD_HTML` 随 `track.innerHTML` 一起写），
    共享同一个 stacking context；采集卡片时用 `filter(className 含 card3d)` 把它排除。

## 8. 当前状态（交接更新）

> **host 半边 + client 半边全部写完，并已装进 profile —— 只等用户重启应用验收。**
>
> - `lib/`（scan / store / art / skillfile / routes / index）语法全绿；`node .smoke/scan-test.mjs`
>   通过（`complete=true count=6`，`projectRoot=F:\DeepSeek`）。
> - `lib/client.js`（约 85KB）由 `src/client/parts/*.js` 经 `node src/build.mjs` 拼出，**不要手改**。
> - 本地断言：`node src/make-test.mjs` 生成的 `panel-test.html` 在 headless Chrome 里 **165/165 PASS**；
>   截图模式：`panel-test.html#shot=ro|roedit|detail|create|tags|ring|del`。
> - 尺寸量测：`node src/make-test.mjs measure` 生成 `panel-measure.html`（6/6 PASS），
>   对比四种模式居中卡宽度：扇形 240 / 环形 240 / 平滑放大 283 / 叠牌 240 px。
> - 已装到 `C:\Users\WIN10\.dsh\profiles\desktop\node_modules\dsh-skill-card`；profile 的
>   `package.json` 里 `dependencies` 与 `dsh.profile.bundles` 都已加 `dsh-skill-card`
>   （备份：同目录 `package.json.bak-skillcard`）。
> - **下一步（只能由用户做）**：重启 DeepSeek Harness，左侧栏应出现「技能卡库」。
>   回滚：删 profile `package.json` 里的两处 `dsh-skill-card` + 删 `node_modules\dsh-skill-card`，重启。
> - 改 `lib/client.js` **不用重启**（500ms 轮询热替换）；改 `package.json` / 新增文件**必须重启**。
>
> **变更记录**
> - 环形旋转模式卡牌尺寸修复：`40-panel.js` 里环形分支原为
>   `rotateY(dd*26deg) translateZ(520px)`，被 `.stage` 的 `perspective:2200px` 放大
>   2200/(2200-520)≈1.31 倍，居中卡渲染 314px（扇形/叠牌 240px、平滑放大 283px），
>   视觉上明显偏大。现在两处（真卡与虚线卡）都在变换末尾乘补偿系数
>   `RING_K=(RING_PERSPECTIVE-RING_DEPTH)/RING_PERSPECTIVE`（随半径自动重算），居中卡回到 240px；
>   平移与旋转不受影响，环的纵深与前后遮挡保留。**改 CSS 的 perspective 时必须同步改
>   `RING_PERSPECTIVE`**，否则补偿系数失配。
> - 环形旋转间距定稿：`RING_DEPTH` 从 520 → **420**，相邻卡边缘**刚好挨到、互不穿插**。
>   判据（解析投影，透视原点即卡心，卡半宽 120px）：
>   `X(u,dd) = (k·u·cosφ + r·sinφ)·P / (P - (r·cosφ - k·u·sinφ))`，φ=dd·26°，k=(P-r)/P，P=2200。
>   dd=1 的左缘落在 120px 处解出 r≈420.5，取 **420** 时各对相邻卡边缘间隙 ≤1px。
>   对照：r=520 间隙 69px（像平铺的宽扇形）、r=340 重叠 51px（卡片互相穿插）。
>   补偿系数随半径自动重算（0.7636 → 0.8091），居中卡仍是 240px、虚线卡 200px。
> - 尺寸量测现在覆盖这两点：`panel-measure.html` 6/6 PASS；交互断言 56/56 PASS。
> - 来源筛选 + 标签改为全手动（2026-10-21）：
>   - 新增「来源」筛选行（`#srcs`，样式常量 `SKC_CSS_FILTER`）。tab 文案直接取 host 的 `levelLabel`，
>     固定列出 项目技能/用户技能/自定义目录/系统内置/运行时，其它来源按首次出现顺序追加；
>     与分类、标签、搜索叠加取交集，标签 tally 的基数也把来源算进去。
>   - host 改为扫描**所有打开过的会话**各自的项目根（`activeProjectRoots()`），删除/写回的白名单同步扩展。
>     实测：同时打开插件目录会话 + `BasketballServer` 会话时，32 个项目技能全部可见。
>   - `agent-claude` / `agent-codex` / `agent-workbuddy` 的 `levelLabel` 改为产品名，来源 tab 不再出现原始标识。
>   - 标签彻底改为手动：`buildPrompt` 不再要求 `tags`、`parseRecipe` 不再返回 `tags`
>     （否则重新生成卡面时会把手工标签覆盖成空）；`store.js` 版本 1 → 2，首次加载把存量标签一次性清空，
>     其余卡片属性原样保留。
>   - 回归：新增 `.smoke/tags-test.mjs`（16 项）；`panel-test.html` 165/165 PASS（新增 15 项来源筛选断言）。
> - 来源行改为「固定 tab + 其它来源下拉」（2026-10-21 追加）：
>   `项目技能 / 用户技能 / 自定义目录 / 系统内置 / 运行时` 保留为固定 tab，
>   `Claude Code / Codex / WorkBuddy` 等其它来源不再各占一个按钮，收进「其它来源 ▾」下拉；
>   选中后按钮显示当前来源名，点面板外或按 Esc 收起。
>   踩坑：下拉的「点外部关闭」必须挂在捕获阶段 —— 展开时 `#srcs` 整块重绘，冒泡阶段
>   被点的按钮已脱离文档，`closest('#srcs')` 为 null，会把自己关掉。
> - 项目技能改从 DSH 工作空间列表取项目（2026-10-22 追加）：
>   新增 `lib/workspaces.js`，读 `<dshHome>/storages/workspace.json` 的 `tables.workspaces[*].path`，
>   与已打开会话的项目根取并集。之前只认已打开会话，用户没在项目里开会话时「项目技能」恒为 0。
>   - `collectOptions` 变 async（工作空间列表每次请求重读，新增工作空间不用重启）。
>   - `collectSkills` 新增 `registryRoots`：只对已打开会话做注册表快照。工作空间可能有好几个，
>     而它们的技能就在 `.dsh/skills`、`.agents/skills` 里，扫盘已覆盖，不必每个都串行问一次注册表。
>   - 删除白名单改用 `options.projectRoots`（含工作空间），否则工作空间里的项目技能看得见删不掉。
>   - 实测（本机 6 个工作空间）：列表 48 个技能，项目技能 43（BasketballServer 32 + bm2_server 11）、
>     用户技能 5，标签 0 张；单次 list 约 1.2s（48 个技能逐个可写探测 + 删前文件计数，原设计如此）。
>   - 回归：新增 `.smoke/workspaces-test.mjs`（11 项，覆盖正常 / 缺失 / 损坏 / 无 path / 重复）。
> - 修复「卡片反复跳动」（2026-10-22）：
>   首次进入时 43 张新卡面的生成会让 host 报 pending>0，客户端每 1.5s 静默刷新一次并**整条轨道重建**；
>   重建出的新 .card3d 节点会把「初始 transform → apply() 写入的目标 transform」当成一次状态变化，
>   于是每张卡重播一遍入场过渡（实测一次静默刷新触发 127 次 `transitionrun`），退出重进时 pending=0、
>   不再轮询，所以不跳。
>   - 修法一：`refresh(silent)` 先算载荷指纹（`payloadSignature`，只取影响界面的字段，不含 `artTries`），
>     指纹相同就只更新顶栏计数与轮询，不重建轨道。
>   - 修法二：`renderList()` 重建时给 `.deck` 加 `.skc-rebind`（`SKC_CSS_REBIND` 里 `transition:none!important`），
>     60ms 后用定时器摘掉；首次填充（还没有卡）不加重建标记，入场动画保留。
>     用定时器而不是 rAF，是因为面板在后台标签页时 rAF 可能长期不触发。
>   - 回归：`panel-test.html` 新增 4 项（静默刷新不重建、不重置当前卡、重建期间挂/摘过渡开关），131/131 PASS。
> - 项目技能按项目筛选（2026-10-22 追加）：
>   host 侧 `scanSkillRoot` 多收一个 `projectRoot`（注意是**项目根**，不是 `.agents/skills` 技能根，
>   早期写成技能根会让所有项目名退化成 `skills`），`mergeCard` 不搬运它，所以 `buildList` 直接用
>   `skill.projectRoot`；`projectNameOf(root, titles)` 用工作空间 title，未知退回 `basename`。
>   列表每条技能新增 `project` 字段；客户端把它作为「项目技能」下的二级筛选。
>   同名技能同时存在于两个项目时按扫描顺序取第一个（与 DSH 优先级规则一致）。
>   - 回归：`panel-test.html` 新增 8 项（下拉出现、项目计数、切项目、切来源后隐藏），139/139 PASS。
> - 「用户技能」改名「公共技能」+ 默认来源（2026-10-22 追加）：
>   host 的 `levelLabel('user-dsh'|'user-agents')` 改为 `公共技能`（卡片/详情上的来源文字同步变），
>   `createRoots` 的目录标签也改成「公共技能目录」；客户端 `SRC_ORDER` 同步改名，
>   `state.src` 初值由 `null` 改为 `公共技能` —— **打开面板默认只看公共技能**。
>   - 空结果处理：不再用 `.nonefound` 覆盖整条轨道（那段 CSS 一并删掉），
>     虚线 `＋ 新建技能` 始终可见，提示文案改到 `#info` 底栏 —— 一张公共技能都没有时也能直接新建。
>   - 回归：`panel-test.html` 新增 4 项（默认选中公共技能、默认 5 张、无匹配保留 ＋ 卡、底栏提示），143/143 PASS。
> - 「项目技能」与「项目：全部」去重（2026-10-22）：
>   两个控件表达的是同一件事（全部项目技能），合并成一个下拉：`项目技能 ▾`。
>   - `buildSrcs()` 在遍历 `SRC_ORDER` 时，命中 `项目技能` 且本机存在项目技能就渲染下拉（`data-act="projdd"`），
>     默认文案 `项目技能`、计数为全部项目技能数；选中项目后文案换成项目名、计数换成该项目的数量。
>   - 下拉项 `[data-proj]` 同时把 `state.src` 设成 `项目技能`，所以「全部项目」就是原来的「项目技能」tab。
>   - 本机一个项目技能都没有时退回普通 tab（计数 0），不会出现空菜单。
>   - 回归：`panel-test.html` 165/165 PASS（相关断言改成「点项目技能 → 展开下拉 → 选全部项目」这条路径）。
> - 编辑态可改中文名 + 操作栏固定（2026-10-22）：
>   - 编辑表单新增「中文名」输入框（`#f-cn`，`maxlength=12`，带出当前 `cn`）。
>     保存时与其它字段一起走 `update`（`patch.cn`）；**空名字直接拦在提交前**（toast「中文名不能为空」、留在编辑态），
>     因为 `sanitizePatch` 对空 `cn` 是静默忽略，前端不拦会出现「点了保存但名字没变」。
>   - `.acts`（修改/删除/关闭，编辑态是保存/取消）改为 `position:sticky;bottom:-18px`（`SKC_CSS_ACTS`），
>     `bottom:-18px` 抵消 `.panel` 下内边距让按钮栏贴住面板底边，渐变遮住从下面滚过的正文；
>     `z-index:15` 低于正文阅读覆盖层（20），阅读态仍由覆盖层自己的「收起」负责。
>   - 回归：`panel-test.html` 新增 9 项（中文名带出/提交/详情与卡面更新/空值拦截 + sticky 位置断言），151/151 PASS。
> - 技能身份改为「真实路径」（2026-10-22）：
>   之前按技能名去重，同名技能只留一份且归属取决于并行扫描谁先完成 —— 于是
>   `BasketballServer`(32) 与 `bm2_server`(39) 的 28 个同名技能被随机分走，项目列表永远不全。
>   - `scan.js`：新增 `idOfPath` / `realPathOf`，记录带 `id`（真实路径，Windows 小写）与 `realPath`；
>     去重键由「技能名」改成 `id`。注册表里没有路径的条目（运行时注册）仍按名字并入扫盘结果，
>     实在没有对应文件的才用 `runtime:<name>` 作身份。
>   - `routes.js`：列表项新增 `id`；`update / delete / set-description / set-body / refresh(reart)`
>     一律先用 `id` 定位（兼容旧 `name`）；卡片数据、美术任务队列也都按 `id` 存。
>   - `store.js`：`STORE_VERSION` 2 → 3，`diskVersion` 记录磁盘真实版本；新增 `migrateCardKeys`
>     把按名字存的旧卡数据复制给每个同名技能的身份（卡面不重生成），并新增 `storeMeta()`。
>   - 客户端：写操作带 `id`；卡片与详情上的来源文字改为「所属项目名」，同名卡一眼能分清。
>   - 实测：本机 76 张卡（BasketballServer 32 + bm2_server 39 + 公共 5），id 全唯一；
>     卡库从 v2 迁到 v3，`agently-mail` 的原卡面（model/邮使令）完整保留。
>   - 回归：新增 `.smoke/identity-test.mjs`（5 项，含 junction 合并），`panel-test.html` 165/165 PASS。
> - 深层技能目录 + 目录筛选（2026-10-22）：
>   - `scan.js` 新增 `findSkillDirs(root)`：项目根下**最多 3 层**里任何名为 `skills` 的目录都算技能根，
>     实测 `bm2_server` 有 4 个（`.agents/skills`、`.agents/bm2-skills/skills`、`.claude/skills`、
>     `.claude/bm2-skills/skills`）。`node_modules`/`dist`/`target`/`bin` 等 26 个目录名跳过，
>     每个项目根最多枚举 800 个目录兜底；`.dsh/skills` 仍归 `project-dsh`，其余归 `project-agents`。
>   - 记录新增 `skillsDir`（相对项目根的目录），列表项下发为 `dir`；删除白名单改为「发现出来的全部目录」，
>     否则深层目录里的技能看得见删不掉。
>   - 客户端新增「目录」筛选：`state.dir` + `passDir()`，只在「项目技能 + 选中具体项目 + 该项目有 ≥2 个目录」时
>     出现「目录：全部 ▾」下拉；切项目/切来源自动清空。
>   - 顺带修掉一个身份归属的竞态：同一份文件同时被真实目录和 junction 扫到时，原来谁先扫完算谁的，
>     会把技能随机算到另一个项目名下；现在同优先级下**优先非链接记录**。
>   - 实测：216 张卡（项目技能 211）；`bm2_server` 119（39 + 22 + 39 + 19），选嵌套目录
>     `.agents/bm2-skills/skills` 后 22 张。回归：`panel-test.html` 165/165 PASS、
>     `identity-test.mjs` 9/9（含第 3 层扫到 / 第 4 层不扫）。
> - 标签与保存按钮的交互修正（2026-10-22）：
>   - 之前标签只能回车提交；点「保存修改」时先触发输入框 focusout，输入被清掉，标签丢失。
>     现在：输入内容实时存进 `state.pendingTag`（失焦/重绘都不丢），`保存修改` 会把还没回车的标签
>     一起写进同一次 `update`（`patch.tags`），按回车仍然即时提交。标签按 host 的规则截到 8 字。
>   - 顺带修掉一个更严重的连带 bug：编辑态点「＋ 标签」原来会整块 `renderDetail()`，**把用户刚改好
>     还没保存的中文名 / 五维 / 描述一起重置**。现在增删标签只走 `renderTagChipsOnly()` /
>     `ensureTagInput()` 局部刷新，不再重建整个表单。
>   - 回归：`panel-test.html` 新增 4 项（编辑态打开输入框、失焦不丢、保存带上未回车的标签、详情即时显示），164/164 PASS。
> - 修复「没改描述却被写回、还多出一行 description」（2026-10-22）：
>   两个问题叠加：
>   1. `rewriteDescription` 的逐行正则写成 `/^description:[ 	]*(.*)$/`，而 JS 的 `.` **不匹配 ``**，
>      Windows 上 CRLF 的 SKILL.md 让这个匹配整体失败，于是走「找不到就插入」分支，
>      在 frontmatter 顶部**新增**一行 description。修法：`/^description:[ 	]*(.*?)?$/`，
>      并在替换时补回该行原本的 ``，避免把一行改成 LF 形成混合换行；补 frontmatter 时也按文件原 EOL 写。
>   2. 客户端每次点「保存修改」都无条件 `pushDescription()`，即使描述没动也会重写文件。
>      修法：先比较再决定，`descDirty` 为真才写回（与「保存只提交改动字段」一致）。
>   实测：CRLF 的 `skill-sql` 反复写回后 description 仍只有 1 行、字节只差两个引号、二次写回幂等。
>   - 事故修复：`BasketballServer/.agents/skills/basketball-review-deploy/SKILL.md` 被这条 bug 插入过一行
>     description（`git diff` 可验证只多了这一行），已按 git 基线删除该行并确认文件与版本库一致。
>   - 回归：新增 `.smoke/skillfile-test.mjs`（15 项：CRLF / LF / 折叠块 / 无 frontmatter / 幂等 / 正文写回），
>     `panel-test.html` 新增「没改描述时不再写回 SKILL.md」，165/165 PASS。
