# dsh-skill-card · 技能卡库

把 DSH 的技能渲染成**游戏卡牌**：横向轮播浏览、按分类与标签筛选、可视化修改稀有度 / 星数 /
五维数值 / 标签 / 卡面配色，并支持新建与删除技能。

- 侧栏入口：DSH 左上角（排在「插件中心」「技能中心」下面），图标 + 标签「技能卡库」
- 面板：全屏主面板，`main` seat，key = `skill-card`
- 存储：**side-car**，卡片属性写在 `~/.dsh/storages/skill-card/`，**不改动 skill 文件本身**
  （唯一例外：详情页手改「技能描述」时会写回该技能的 SKILL.md，且只替换 description 一行）

## 安装 / 卸载

从 GitHub 直装（推荐）：

    dsh plugin --profile desktop add github:Hocete/dsh-skill-card

也可以在各家插件市场（例如 dsh-market 的 Discover）里搜 `dsh-skill-card` 一键装。
装完重启一次 DeepSeek Harness。

要求 **DSH >= 0.2.0-rc.2**、Node 22+。插件只依赖 Node 内置模块，`lib/` 已预构建，
从源码安装不需要跑构建。

卸载：`dsh plugin --profile <name> remove dsh-skill-card`，重启。卡片数据留在
`~/.dsh/storages/skill-card/`，可自行删除。

## 功能一览

| 区域 | 说明 |
|---|---|
| 顶栏 | 标题 + 技能数、`＋ 新建技能`、`↻ 刷新` |
| 分类行 | 全部 / 办公 / 开发 / AI 智能体 / 分析 / 文档 / 流程 / 未分类，带计数徽章 |
| 来源行 | 全部 / 项目技能 ▾ / 公共技能 / 自定义目录 / 系统内置 / 运行时，带计数徽章；**进入面板默认选中「公共技能」**；「项目技能」本身就是项目下拉（默认文案「项目技能」= 全部项目，选中某个项目后文案变成项目名），选中项目后若该项目有多个技能目录，还会出现「目录：全部 ▾」下拉；Claude Code / Codex / WorkBuddy 等其它来源收进一个「其它来源 ▾」下拉 |
| 刷新 | 卡面在后台生成时每 1.5s 静默轮询一次；载荷没变化就不重建轨道，重建期间关掉过渡，卡片不会反复重播入场动画 |
| 自适应 | 面板高度跟着窗口走：舞台吃掉顶栏剩下的高度，窗口矮时卡牌按舞台等比缩小，详情面板与底部 `修改 / 删除 / 关闭` 不会被挤出可视区；窗口缩放（含侧栏折叠）会重算卡片位置，已打开的详情停在原来那张卡上 |
| 标签行 | 自由标签 chips（多选取交集）+ 搜索框（技能名 / 描述 / 标签）；**标签只能手动添加，模型不再自动生成** |
| 模式 | 扇形轮播、环形旋转、平滑放大、叠牌抽卡；滚轮灵敏度 1-10 |
| 卡片 | 稀有度徽章、星数、纹章卡面、五维数值（能力 / 效率 / 通用 / 稳定 / 命中）、标签、来源 |
| 详情 | 点当前卡展开；`✎ 修改` 编辑属性（**含中文名**）、`🗑 删除技能`（可写）或 `🔒 只读技能`（只读） |
| 标签 | 编辑态输入标签后**按回车或直接点「保存修改」都会保存**；点标签按钮不会重置其它已改的字段 |
| 固定操作栏 | `修改 / 删除 / 关闭`（编辑态是 `保存修改 / 取消`）钉在详情面板底部，正文再长也不用滚到底 |
| 新建 | 顶栏按钮，或卡片流里的虚线 `＋` 卡（四种模式下位置自适应） |

只读技能（内置在 app.asar、或由插件包提供的）**卡片属性照样能改**（数据在 side-car），
只有「删除」被禁用；点删除按钮会 toast 说明具体原因（内置资源 / 插件包 / 无写权限）。

**一张卡 = 一个真实路径**：不同项目里的同名技能是两张卡（各自能改），只有符号链接 / junction
指向同一份真实文件时才合成一张。卡片数据（卡面、稀有度、标签…）按真实路径存，卡库文件
`version: 3` 起生效；从旧版本升级时会把按「技能名」存的旧数据复制给每个同名技能，卡面不会重生成。

「公共技能」= 用户级技能目录（`~/.agents/skills`、`~/.dsh/skills`），面板打开时默认只看这一栏。
如果当前筛选一张卡都没有，卡片区仍保留中间的虚线 `＋ 新建技能`，提示文案显示在底部信息栏。

**技能目录不止 `.dsh/skills` / `.agents/skills`**：项目根下 **3 层内任何名为 `skills` 的目录**都会被扫，
例如 `.agents/bm2-skills/skills`、`.claude/skills`、`.claude/bm2-skills/skills`（`node_modules`、`dist`、
`target` 等依赖/构建目录直接跳过，最多枚举 800 个目录兜底）。选中某个项目后，若该项目有多个技能目录，
来源行会多出「目录：全部 ▾」下拉，默认全部，可单独看某个目录的技能。

「项目技能」的项目根有两处来源，取并集：**已打开会话**的工作目录（向上找最近的 `.git`）与
**DSH 工作空间列表**（`~/.dsh/storages/workspace.json`）。所以即使这次没在某个项目里开会话，
只要它是你建过的工作空间，它的 `.dsh/skills` 与 `.agents/skills` 也会被扫进来；项目名用工作空间的
title（`BasketballServer`、`bm2_server`…），没登记成工作空间的会话目录用目录名。

「项目技能」不是一个普通 tab 而是一个下拉：不选具体项目时文案就是「项目技能」（等于全部项目），
选中某个项目后文案变成项目名，只显示那个项目的卡 —— 这样不会出现「项目技能 / 项目：全部」
两个表达同一件事的按钮。
同名技能同时存在于两个项目时，按扫描顺序取第一个（和 DSH 自己的优先级规则一致）。

写回 SKILL.md 的两条保证：**只有真的改过的字段才写回**（保存卡片属性不会再顺手重写描述），
且 `description` 一律**原地替换**——CRLF 文件、折叠块标量、重复保存都只动那一行，不会多出行。

标签改版说明：旧版本的标签是模型生成配方时顺带写的，从「全手动」版起模型不再产出标签；
卡库文件首次加载会做一次 v1 → v2 迁移，把存量标签清空（其余属性原样保留），之后自己加的
标签会一直留着。

## 卡面

卡面是**纯 SVG 矢量纹章**，零素材、全自动：

1. 每次拿到技能列表，先用**确定性算法**（技能名哈希）生成保底卡面 —— 永不空白；
2. 需要重新生成时后台调 `ctx.llm.stream`，让模型按技能名 + 描述输出一份美术配方 JSON
   （配色 / 纹样 / 符号 / 构图 / 稀有度 / 分类）；
3. 插件在本地把配方画成 SVG 淡入替换保底卡面，配方落盘缓存；
4. 模型失败，或重试 3 次仍不成 → **永久保留保底卡面**（不影响使用）。

新增技能（自己拷 SKILL.md 进技能目录也一样）打开面板就会自动出现并自动出卡面。

## 接口（host，全部只允许回环访问）

| 方法 + 路径 | 说明 |
|---|---|
| GET `/api/dsh-skill-card/list` | 技能列表 + 卡片属性 + 分类/来源/标签/稀有度枚举 + 待生成数量 |
| POST `/api/dsh-skill-card/update` | 改卡片属性 `{name, category?, rarity?, stars?, stats?, tags?, cn?, title?, palette?}` |
| POST `/api/dsh-skill-card/set-description` | 改技能描述并写回 SKILL.md（只替换 description 一行） |
| POST `/api/dsh-skill-card/delete` | 删除技能目录（仅可写技能） |
| POST `/api/dsh-skill-card/create` | 新建技能目录 `<root>/<name>/SKILL.md` |
| POST `/api/dsh-skill-card/refresh` | 让 host 重扫技能根 |
| GET `/api/dsh-skill-card/health` | 健康检查 |

请求体上限 256KB；非回环来源返回 `403 {"error":"forbidden: loopback-only"}`。

## 开发

源码分片在 `src/`，构建脚本把分片拼成 `lib/client.js`：

    node src/build.mjs          # src/client/parts/*.js -> lib/client.js
    node src/make-test.mjs      # 生成自包含的 panel-test.html（假 host 数据，含 165 项断言）
    node src/make-test.mjs measure   # 生成 panel-measure.html（四种模式卡牌尺寸量测，6 项断言）
    node .smoke/make-layout.mjs && node .smoke/layout-test.mjs  # 布局回归：详情不被载荷刷新顶掉、窗口缩放重排（18 项断言）
    node .smoke/scan-test.mjs   # host 侧技能扫描冒烟测试
    node .smoke/tags-test.mjs   # host 侧标签（不再自动生成 / v1→v2 迁移）与来源分组测试
    node .smoke/workspaces-test.mjs  # 工作空间列表解析（正常 / 缺失 / 损坏 / 无 path / 重复）
    node .smoke/identity-test.mjs    # 技能身份：同名不同路径算两个，junction 指向同一份算一个
    node .smoke/skillfile-test.mjs   # SKILL.md 写回：CRLF/LF、折叠块、幂等、正文不影响 frontmatter

`src/client/parts/` 里的分片是**纯语句**（无 import/export），按文件名顺序拼进 lazy-CJS
工厂函数里，共享同一层作用域，所以分片之间不要重名：

- `10-cards.js`：卡面渲染器（16 种纹样 + 兜底 gear）
- `20-style.js`：面板 CSS（全部选择器都限定在 `.skc-root` 内）
- `40-panel.js`：面板控制器（DOM 构建、四种模式、详情/编辑/删除/新建、API 调用）
- `50-apply.js`：React 壳 + `ctx.slots` 注册

已装好的插件，改 `lib/client.js` 会被 500ms 文件轮询自动热替换（不用刷新）；
改 `package.json` 或新增包必须重启应用。

## 已知限制

- 内置在 `app.asar` 里的技能（office-docx / office-pptx / office-xlsx、
  diagnose-windows-sandbox-acl）与插件包提供的技能（`@openviking/dsh-memory-plugin` 的 3 个）
  **不可删除、描述不可改**，其余卡片属性正常。
- 卡面配色 / 纹样由模型一次性生成后缓存；技能改名等于新技能，会重新生成。
- 面板切到别的页面会卸载组件，但滚动位置 / 当前卡 / 筛选状态保存在控制器里，切回来不丢。
