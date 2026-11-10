/**
 * 生成自包含的测试页 panel-test.html：内联卡片渲染器 + 面板控制器 + 假 api，
 * 供 headless Chrome 跑断言（--dump-dom）与截图。
 *
 * 用法：node src/make-test.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeBody } from "../lib/scan.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const partsDir = join(here, "client", "parts");
const sample = "F:\\DeepSeek\\skillcard-preview\\cards.js";
const bodySample = "F:\\DeepSeek\\skillcard-preview\\bodies.js";

// 从预览样张 bodies.js 载入真实 SKILL.md 正文；normalizeBody 保证测试值与 host 下发值逐字一致
const docWin = {};
new Function("window", readFileSync(bodySample, "utf8"))(docWin);
const docs = docWin.SKILL_DOC;

// 从样张 cards.js 取 13 条美术配方，映射成 host list 的字段形状
const win = {};
new Function("window", readFileSync(sample, "utf8"))(win);
const recipes = win.CardFace.RECIPES;
const READONLY = [10, 11, 12];
// 来源标识 → 界面分组名（与 host 的 levelLabel 一致）；前 3 条当项目技能，最后 1 条当「其它来源」验证下拉
const SRC_LABEL = { 'project-dsh': '项目技能', 'project-agents': '项目技能', 'user-dsh': '公共技能', 'user-agents': '公共技能', custom: '自定义目录', runtime: '运行时', bundled: '系统内置', 'agent-codex': 'Codex' };
const skills = recipes.map((r, i) => {
  const ro = READONLY.indexOf(i) >= 0;
  const doc = docs[r.name];
  const body = doc && typeof doc.body === "string" ? normalizeBody(doc.body) : undefined;
  const level = i < 3 ? 'project-dsh' : (i < 7 ? 'bundled' : (i < 12 ? 'user-agents' : 'agent-codex'));
  return {
    id: "id-" + r.name, name: r.name, cn: r.cn, title: r.title, category: r.cat, rarity: r.rarity, stars: r.stars,
    stats: r.stats, tags: r.tags.slice(), motif: r.motif, glyph: r.glyph, palette: r.pal,
    art: "model", artPending: false, artTries: 0, description: r.name + " 的中文描述：用于测试搜索与展示。",
    body: body,
    level: level, levelLabel: SRC_LABEL[level],
    project: level === 'project-dsh' ? (i < 2 ? 'BasketballServer' : 'bm2_server') : '',
    dir: level === 'project-dsh' ? (i === 1 ? '.agents/bm2-skills/skills' : '.agents/skills') : '',
    path: "C:\\Users\\WIN10\\.agents\\skills\\" + r.name + "\\SKILL.md",
    directory: "C:\\Users\\WIN10\\.agents\\skills\\" + r.name,
    linked: false, canWrite: !ro, canDelete: !ro,
    readonlyReason: ro ? "该技能打包在 DSH 应用内置资源（app.asar）中，应用目录只读，无法删除。" : "",
    deleteTarget: ro ? "" : "C:\\Users\\WIN10\\.agents\\skills\\" + r.name,
    deleteFiles: ro ? 0 : 2
  };
});
const payload = {
  ok: true, skills: skills,
  categories: ["全部", "办公", "开发", "AI 智能体", "分析", "文档", "流程", "未分类"],
  statKeys: ["能力", "效率", "通用", "稳定", "命中"],
  rarities: ["N", "R", "SR", "SSR", "UR"],
  pending: 0, complete: true, storePath: "C:\\Users\\WIN10\\.dsh\\storages\\skill-card",
  createRoots: [
    { key: "user-agents", label: "公共技能", path: "C:\\Users\\WIN10\\.agents\\skills", writable: true, reason: "" },
    { key: "bundled", label: "应用内置（只读）", path: "D:\\DSH\\...\\app.asar\\dsh", writable: false, reason: "打包在 app.asar 内，只读" }
  ]
};

const cards = readFileSync(join(partsDir, "10-cards.js"), "utf8");
const fx = readFileSync(join(partsDir, "15-fx.js"), "utf8");
const style = readFileSync(join(partsDir, "20-style.js"), "utf8");
const panel = readFileSync(join(partsDir, "40-panel.js"), "utf8");
// 第二个参数为 measure 时改用尺寸量测脚本，产出 panel-measure.html
const measure = process.argv.indexOf("measure") >= 0;
const asserts = readFileSync(join(here, "test", measure ? "measure.js" : "asserts.js"), "utf8");

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>skill-card panel test</title>
<style>html,body{margin:0;height:100%;background:#070a10;color:#e6edf7;font-family:system-ui,"Microsoft YaHei",sans-serif}
#host{position:relative;height:100vh;overflow:hidden}</style>
</head><body>
<div id="host"></div>
<pre id="TESTOUT" style="position:fixed;left:-9999px;top:0"></pre>
<script>
${cards}
</script>
<script>
${fx}
</script>
<script>
${style}
</script>
<script>
${panel}
</script>
<script>
window.__payload = ${JSON.stringify(payload)};
window.__calls = [];
window.__errors = [];
window.onerror = function (m, f, l) { window.__errors.push(String(m) + " @" + l); };
(function () {
  var api = { request: function (path, body) {
    window.__calls.push({ path: path, body: body || null });
    var P = window.__payload;
    function find(key) { for (var i = 0; i < P.skills.length; i++) if (P.skills[i].id === key) return P.skills[i]; return null; }
    function byName(name) { for (var i = 0; i < P.skills.length; i++) if (P.skills[i].name === name) return P.skills[i]; return null; }
    function target(body) { return find(body.id) || byName(body.name); }
    if (path === "list") return Promise.resolve(JSON.parse(JSON.stringify(P)));
    if (path === "update") {
      var s = target(body);
      if (!s) { s = JSON.parse(JSON.stringify(P.skills[0])); s.name = body.name; s.cn = body.name; P.skills.push(s); }
      if (body.category) s.category = body.category;
      if (body.rarity) s.rarity = body.rarity;
      if (body.stars) s.stars = body.stars;
      if (body.stats) s.stats = body.stats;
      if (body.tags) s.tags = body.tags;
      return Promise.resolve({ ok: true });
    }
    if (path === "set-description") { var s2 = target(body); if (s2) s2.description = body.description; return Promise.resolve({ ok: true }); }
    if (path === "set-body") { var s3 = target(body); if (s3) s3.body = body.body; return Promise.resolve({ ok: true }); }
    if (path === "delete") { var del = target(body); P.skills = P.skills.filter(function (x) { return x !== del; }); return Promise.resolve({ ok: true }); }
    if (path === "create") {
      if (byName(body.name)) return Promise.reject(new Error("技能已存在：" + body.name));
      P.skills.push(Object.assign(JSON.parse(JSON.stringify(P.skills[0])), { id: "id-" + body.name, name: body.name, cn: body.name, description: body.description, tags: [] }));
      return Promise.resolve({ ok: true, created: body.name });
    }
    return Promise.resolve({ ok: true });
  } };
  window.__api = api;
  window.__ctl = createSkillCardController(api);
  try { window.__ctl.mount(document.getElementById("host")); } catch (e) { window.__errors.push("mount: " + (e && e.message)); }
})();
</script>
<script>
${asserts}
</script>
</body></html>
`;
const page = measure ? "panel-measure.html" : "panel-test.html";
writeFileSync(join(root, page), html, "utf8");
console.log("test page: " + page + " (" + html.length + " bytes)");
