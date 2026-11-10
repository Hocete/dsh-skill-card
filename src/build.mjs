/**
 * 把 src/client/parts/ 下的片段按文件名顺序拼成 lib/client.js。
 *
 * parts 里是纯语句（没有 import/export），它们共享同一个 lazy-CJS 工厂作用域，
 * 因此片段之间不能出现重名声明。头尾模板见 SPEC.md 4.2。
 *
 * 用法：node src/build.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const partsDir = join(here, "client", "parts");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const parts = readdirSync(partsDir).filter((f) => f.endsWith(".js")).sort();
if (!parts.length) {
  console.error("build: src/client/parts 下没有片段");
  process.exit(1);
}

const header = [
  "/* 由 src/build.mjs 生成，请勿直接编辑；改 src/client/parts/*.js 后重新构建。 */",
  "window.__ModuleLoader__.load({",
  '  id: "' + pkg.name + '",',
  "  factory: (require) => {",
  "    var module = { exports: {} };",
  "    var exports = module.exports;",
  '    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
  '    let react = require("react");',
  "    const React = react;",
  "    const h = React.createElement;",
  "",
].join("\n");

const footer = [
  "",
  "    exports.apply = apply;",
  "    exports.inject = inject;",
  "    return module.exports;",
  "  }",
  "});",
  "",
].join("\n");

const body = parts
  .map((f) => "    /* ── " + f + " ─────────────────────────────── */\n" + readFileSync(join(partsDir, f), "utf8").replace(/\s+$/, ""))
  .join("\n\n");

const out = header + body + footer;
const target = join(root, "lib", "client.js");
writeFileSync(target, out, "utf8");
console.log("build: " + parts.join(" + ") + " -> lib/client.js (" + out.length + " bytes)");
