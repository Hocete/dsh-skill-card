/* 由 src/build.mjs 生成，请勿直接编辑；改 src/client/parts/*.js 后重新构建。 */
window.__ModuleLoader__.load({
  id: "dsh-skill-card",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let react = require("react");
    const React = react;
    const h = React.createElement;
    /* ── 10-cards.js ─────────────────────────────── */
/**
 * 卡面渲染器：把一张技能卡的数据画成 240x360 的 SVG 卡片。
 *
 * 本文件是「拼接源」，不含 import/export —— 由 src/build.mjs 按顺序拼进 lib/client.js
 * 的 factory 作用域里，与其它 part 共享同一层作用域。
 * 纹样全部是纯几何图形，不依赖任何外部素材。
 */

/** 稀有度配色表。 */
const RARITY_COLOR = { N: '#8b95a5', R: '#4a9eff', SR: '#b06bff', SSR: '#ffb020', UR: '#ff4d6d' };

/** 五维名称，顺序与后端 statKeys 一致。 */
const STAT_CAPS = ['能力', '效率', '通用', '稳定', '命中'];

/**
 * FNV-1a 32 位哈希，用来把技能名映射成稳定的随机种子。
 *
 * 同一个技能名永远得到同一张保底卡面（配色、纹样分布都不变）。
 *
 * @param s 输入字符串
 * @returns 32 位无符号整数
 */
function hash32(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * 以种子构造确定性伪随机数发生器（xorshift32）。
 *
 * @param seed 初始种子
 * @returns 每次调用返回 [0,1) 的函数
 */
function makeRng(seed) {
  let x = seed || 1;
  return function next() {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

/**
 * 保留两位小数的数值格式化，避免 SVG 里出现超长浮点数。
 *
 * @param v 原始数值
 * @returns 取整到两位小数的数值
 */
function num2(v) {
  return Math.round(v * 100) / 100;
}

/**
 * 转义会被写进 SVG 文本节点的字符，避免用户自定义标签里的 & < > 破坏卡面。
 *
 * @param x 原始文本
 * @returns 转义后的文本
 */
function escapeSvgText(x) {
  return String(x === undefined || x === null ? '' : x)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 纹样画法表：每个函数接收 (尺寸 s, 主色 A, 亮色 G, rng)，返回 SVG 片段。 */
const MOTIF_DRAW = {
  envelope: function (s, A, G) {
    const w = s * 0.74, h = s * 0.5;
    return '<rect x="' + num2(-w) + '" y="' + num2(-h) + '" width="' + num2(2 * w) + '" height="' + num2(2 * h) + '" rx="' + num2(s * 0.11) + '" fill="rgba(255,255,255,.07)" stroke="' + A + '" stroke-width="2"/>'
      + '<path d="M ' + num2(-w) + ' ' + num2(-h) + ' L 0 ' + num2(h * 0.42) + ' L ' + num2(w) + ' ' + num2(-h) + '" fill="none" stroke="' + A + '" stroke-width="2.4" stroke-linejoin="round"/>'
      + '<path d="M ' + num2(-w) + ' ' + num2(h) + ' L ' + num2(-w * 0.3) + ' ' + num2(h * 0.05) + ' M ' + num2(w) + ' ' + num2(h) + ' L ' + num2(w * 0.3) + ' ' + num2(h * 0.05) + '" fill="none" stroke="' + A + '" stroke-opacity=".45" stroke-width="1.8"/>'
      + '<path d="M ' + num2(s * 0.5) + ' ' + num2(-h * 1.5) + ' L ' + num2(s * 1.05) + ' ' + num2(-h * 1.15) + ' L ' + num2(s * 0.72) + ' ' + num2(-h * 1.02) + ' Z" fill="' + G + '" fill-opacity=".85"/>';
  },
  doc: function (s, A, G) {
    const w = s * 0.62, h = s * 0.8;
    return '<path d="M ' + num2(-w) + ' ' + num2(-h) + ' L ' + num2(w * 0.42) + ' ' + num2(-h) + ' L ' + num2(w) + ' ' + num2(-h * 0.5) + ' L ' + num2(w) + ' ' + num2(h) + ' L ' + num2(-w) + ' ' + num2(h) + ' Z" fill="rgba(255,255,255,.07)" stroke="' + A + '" stroke-width="2" stroke-linejoin="round"/>'
      + '<path d="M ' + num2(w * 0.42) + ' ' + num2(-h) + ' L ' + num2(w * 0.42) + ' ' + num2(-h * 0.5) + ' L ' + num2(w) + ' ' + num2(-h * 0.5) + '" fill="none" stroke="' + A + '" stroke-width="1.6" stroke-opacity=".7"/>'
      + '<g stroke="' + G + '" stroke-opacity=".75" stroke-width="2" stroke-linecap="round">'
      + '<path d="M ' + num2(-w * 0.62) + ' ' + num2(-h * 0.2) + ' L ' + num2(w * 0.5) + ' ' + num2(-h * 0.2) + '"/><path d="M ' + num2(-w * 0.62) + ' ' + num2(h * 0.1) + ' L ' + num2(w * 0.5) + ' ' + num2(h * 0.1) + '"/><path d="M ' + num2(-w * 0.62) + ' ' + num2(h * 0.4) + ' L ' + num2(w * 0.05) + ' ' + num2(h * 0.4) + '"/></g>';
  },
  grid: function (s, A, G) {
    const w = s * 0.7, h = s * 0.8, cols = 4, rows = 5;
    let out = '<rect x="' + num2(-w) + '" y="' + num2(-h) + '" width="' + num2(2 * w) + '" height="' + num2(2 * h) + '" rx="6" fill="rgba(255,255,255,.06)" stroke="' + A + '" stroke-width="2"/>';
    for (let i = 1; i < cols; i++) out += '<path d="M ' + num2(-w + 2 * w * i / cols) + ' ' + num2(-h) + ' L ' + num2(-w + 2 * w * i / cols) + ' ' + num2(h) + '" stroke="' + A + '" stroke-opacity=".35" stroke-width="1"/>';
    for (let j = 1; j < rows; j++) out += '<path d="M ' + num2(-w) + ' ' + num2(-h + 2 * h * j / rows) + ' L ' + num2(w) + ' ' + num2(-h + 2 * h * j / rows) + '" stroke="' + A + '" stroke-opacity=".35" stroke-width="1"/>';
    out += '<rect x="' + num2(-w) + '" y="' + num2(-h) + '" width="' + num2(2 * w / cols) + '" height="' + num2(2 * h / rows) + '" fill="' + G + '" fill-opacity=".55"/>';
    out += '<rect x="' + num2(-w + 2 * w / cols) + '" y="' + num2(-h + 4 * h / rows) + '" width="' + num2(2 * w / cols) + '" height="' + num2(2 * h / rows) + '" fill="' + G + '" fill-opacity=".3"/>';
    return out;
  },
  slide: function (s, A, G) {
    const w = s * 0.82, h = s * 0.62;
    return '<rect x="' + num2(-w) + '" y="' + num2(-h) + '" width="' + num2(2 * w) + '" height="' + num2(2 * h) + '" rx="8" fill="rgba(255,255,255,.07)" stroke="' + A + '" stroke-width="2"/>'
      + '<path d="M ' + num2(-w) + ' ' + num2(-h * 0.42) + ' L ' + num2(w) + ' ' + num2(-h * 0.42) + '" stroke="' + A + '" stroke-opacity=".5" stroke-width="1.6"/>'
      + '<rect x="' + num2(-w * 0.78) + '" y="' + num2(-h * 0.1) + '" width="' + num2(w * 0.34) + '" height="' + num2(h * 0.5) + '" rx="3" fill="' + G + '" fill-opacity=".9"/>'
      + '<rect x="' + num2(-w * 0.3) + '" y="' + num2(h * 0.14) + '" width="' + num2(w * 0.34) + '" height="' + num2(h * 0.26) + '" rx="3" fill="' + G + '" fill-opacity=".6"/>'
      + '<rect x="' + num2(w * 0.18) + '" y="' + num2(-h * 0.05) + '" width="' + num2(w * 0.6) + '" height="' + num2(h * 0.45) + '" rx="3" fill="' + G + '" fill-opacity=".35"/>'
      + '<circle cx="' + num2(w * 0.62) + '" cy="' + num2(h * 0.5) + '" r="' + num2(s * 0.2) + '" fill="none" stroke="' + G + '" stroke-width="2" stroke-opacity=".8"/>';
  },
  gear: function (s, A, G) {
    let out = '';
    const teeth = 10, ro = s * 0.92, ri = s * 0.68, r2 = s * 0.34;
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2, a1 = a0 + (Math.PI * 2 / teeth) * 0.5, a2 = a0 + (Math.PI * 2 / teeth);
      out += '<path d="M ' + num2(Math.cos(a0) * ri) + ' ' + num2(Math.sin(a0) * ri) + ' L ' + num2(Math.cos(a0) * ro) + ' ' + num2(Math.sin(a0) * ro) + ' L ' + num2(Math.cos(a1) * ro) + ' ' + num2(Math.sin(a1) * ro) + ' L ' + num2(Math.cos(a1) * ri) + ' ' + num2(Math.sin(a1) * ri) + ' A ' + num2(ri) + ' ' + num2(ri) + ' 0 0 1 ' + num2(Math.cos(a2) * ri) + ' ' + num2(Math.sin(a2) * ri) + ' Z" fill="rgba(255,255,255,.09)" stroke="' + A + '" stroke-width="1.6" stroke-linejoin="round"/>';
    }
    out += '<circle r="' + num2(r2) + '" fill="none" stroke="' + A + '" stroke-width="2.2"/><circle r="' + num2(r2 * 0.42) + '" fill="' + G + '" fill-opacity=".9"/>';
    out += '<g transform="translate(' + num2(s * 0.72) + ',' + num2(s * 0.72) + ')"><circle r="' + num2(s * 0.4) + '" fill="rgba(10,14,18,.85)" stroke="' + G + '" stroke-width="2.4"/><path d="M ' + num2(s * 0.28) + ' ' + num2(s * 0.28) + ' L ' + num2(s * 0.62) + ' ' + num2(s * 0.62) + '" stroke="' + G + '" stroke-width="3.4" stroke-linecap="round"/></g>';
    return out;
  },
  terminal: function (s, A, G) {
    const w = s * 0.92, h = s * 0.66;
    let out = '<rect x="' + num2(-w) + '" y="' + num2(-h) + '" width="' + num2(2 * w) + '" height="' + num2(2 * h) + '" rx="9" fill="rgba(6,16,12,.85)" stroke="' + A + '" stroke-width="2"/>';
    out += '<path d="M ' + num2(-w) + ' ' + num2(-h * 0.52) + ' L ' + num2(w) + ' ' + num2(-h * 0.52) + '" stroke="' + A + '" stroke-opacity=".5" stroke-width="1.6"/>';
    out += '<g fill="' + A + '" fill-opacity=".7"><circle cx="' + num2(-w * 0.78) + '" cy="' + num2(-h * 0.76) + '" r="' + num2(s * 0.06) + '"/><circle cx="' + num2(-w * 0.58) + '" cy="' + num2(-h * 0.76) + '" r="' + num2(s * 0.06) + '"/><circle cx="' + num2(-w * 0.38) + '" cy="' + num2(-h * 0.76) + '" r="' + num2(s * 0.06) + '"/></g>';
    out += '<path d="M ' + num2(-w * 0.72) + ' ' + num2(-h * 0.06) + ' L ' + num2(-w * 0.34) + ' ' + num2(h * 0.22) + ' L ' + num2(-w * 0.72) + ' ' + num2(h * 0.5) + '" fill="none" stroke="' + G + '" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>';
    out += '<path d="M ' + num2(-w * 0.08) + ' ' + num2(h * 0.5) + ' L ' + num2(w * 0.72) + ' ' + num2(h * 0.5) + '" stroke="' + G + '" stroke-width="2.8" stroke-linecap="round"/>';
    out += '<path d="M ' + num2(w * 0.1) + ' ' + num2(h * 0.02) + ' L ' + num2(w * 0.5) + ' ' + num2(h * 0.02) + '" stroke="' + G + '" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>';
    return out;
  },
  graph: function (s, A, G) {
    const r = makeRng(7), pts = [];
    let out = '';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.35, rad = s * (0.42 + r() * 0.62);
      pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
    }
    const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [0, 3], [2, 5], [1, 6]];
    for (let k = 0; k < edges.length; k++) out += '<path d="M ' + num2(pts[edges[k][0]][0]) + ' ' + num2(pts[edges[k][0]][1]) + ' L ' + num2(pts[edges[k][1]][0]) + ' ' + num2(pts[edges[k][1]][1]) + '" stroke="' + A + '" stroke-opacity=".42" stroke-width="1.4"/>';
    for (let m = 0; m < pts.length; m++) out += '<circle cx="' + num2(pts[m][0]) + '" cy="' + num2(pts[m][1]) + '" r="' + num2(s * (m % 3 === 0 ? 0.2 : 0.13)) + '" fill="' + G + '" fill-opacity=".92"/>';
    out += '<circle r="' + num2(s * 1.02) + '" fill="none" stroke="' + A + '" stroke-opacity=".3" stroke-width="1" stroke-dasharray="3 7"/>';
    return out;
  },
  search: function (s, A, G) {
    const w = s * 0.56, h = s * 0.72;
    let out = '<rect x="' + num2(-w) + '" y="' + num2(-h) + '" width="' + num2(2 * w) + '" height="' + num2(2 * h) + '" rx="6" fill="rgba(255,255,255,.06)" stroke="' + A + '" stroke-opacity=".8" stroke-width="1.8"/>';
    out += '<g stroke="' + A + '" stroke-opacity=".45" stroke-width="1.8" stroke-linecap="round"><path d="M ' + num2(-w * 0.6) + ' ' + num2(-h * 0.45) + ' L ' + num2(w * 0.35) + ' ' + num2(-h * 0.45) + '"/><path d="M ' + num2(-w * 0.6) + ' ' + num2(-h * 0.1) + ' L ' + num2(w * 0.6) + ' ' + num2(-h * 0.1) + '"/><path d="M ' + num2(-w * 0.6) + ' ' + num2(h * 0.25) + ' L ' + num2(w * 0.1) + ' ' + num2(h * 0.25) + '"/><path d="M ' + num2(-w * 0.6) + ' ' + num2(h * 0.6) + ' L ' + num2(w * 0.4) + ' ' + num2(h * 0.6) + '"/></g>';
    out += '<g transform="translate(' + num2(s * 0.46) + ',' + num2(s * 0.46) + ')"><circle r="' + num2(s * 0.5) + '" fill="rgba(8,14,24,.9)" stroke="' + G + '" stroke-width="2.8"/><path d="M ' + num2(s * 0.36) + ' ' + num2(s * 0.36) + ' L ' + num2(s * 0.85) + ' ' + num2(s * 0.85) + '" stroke="' + G + '" stroke-width="4" stroke-linecap="round"/></g>';
    return out;
  },
  crystal: function (s, A, G) {
    const w = s * 0.72, h = s * 0.98;
    let out = '<path d="M 0 ' + num2(-h) + ' L ' + num2(w) + ' 0 L 0 ' + num2(h) + ' L ' + num2(-w) + ' 0 Z" fill="rgba(255,255,255,.08)" stroke="' + A + '" stroke-width="2" stroke-linejoin="round"/>';
    out += '<path d="M 0 ' + num2(-h) + ' L 0 ' + num2(h) + ' M ' + num2(-w) + ' 0 L ' + num2(w) + ' 0" stroke="' + A + '" stroke-opacity=".5" stroke-width="1.4"/>';
    out += '<path d="M 0 ' + num2(-h) + ' L ' + num2(w * 0.5) + ' ' + num2(h * 0.5) + ' L 0 ' + num2(h) + ' L ' + num2(-w * 0.5) + ' ' + num2(h * 0.5) + ' Z" fill="' + G + '" fill-opacity=".28"/>';
    out += '<path d="M 0 ' + num2(-h) + ' L ' + num2(w * 0.5) + ' ' + num2(h * 0.5) + ' L ' + num2(-w * 0.5) + ' ' + num2(h * 0.5) + ' Z" fill="' + G + '" fill-opacity=".2" stroke="' + G + '" stroke-opacity=".5" stroke-width="1"/>';
    out += '<circle r="' + num2(s * 1.22) + '" fill="none" stroke="' + A + '" stroke-opacity=".28" stroke-width="1" stroke-dasharray="2 6"/>';
    return out;
  },
  orbit: function (s, A, G) {
    let out = '<circle r="' + num2(s * 0.28) + '" fill="' + G + '" fill-opacity=".9"/><circle r="' + num2(s * 0.5) + '" fill="none" stroke="' + A + '" stroke-opacity=".35" stroke-width="1.2"/>';
    out += '<ellipse rx="' + num2(s * 1.05) + '" ry="' + num2(s * 0.42) + '" fill="none" stroke="' + A + '" stroke-width="1.8" transform="rotate(-24)"/>';
    out += '<ellipse rx="' + num2(s * 1.05) + '" ry="' + num2(s * 0.42) + '" fill="none" stroke="' + A + '" stroke-opacity=".6" stroke-width="1.4" transform="rotate(56)"/>';
    out += '<circle cx="' + num2(Math.cos(-0.42) * s * 1.05) + '" cy="' + num2(Math.sin(-0.42) * s * 0.42) + '" r="' + num2(s * 0.15) + '" fill="' + A + '"/>';
    out += '<circle cx="' + num2(s * 0.62) + '" cy="' + num2(-s * 0.42) + '" r="' + num2(s * 0.13) + '" fill="' + A + '" fill-opacity=".9"/>';
    out += '<circle cx="' + num2(-s * 0.72) + '" cy="' + num2(s * 0.5) + '" r="' + num2(s * 0.1) + '" fill="' + A + '" fill-opacity=".7"/>';
    return out;
  },
  compass: function (s, A, G) {
    let out = '';
    const ticks = 24, r = s * 0.98;
    for (let i = 0; i < ticks; i++) {
      const a = i / ticks * Math.PI * 2, isLong = i % 6 === 0;
      const r1 = isLong ? r * 0.82 : r * 0.88;
      out += '<path d="M ' + num2(Math.cos(a) * r1) + ' ' + num2(Math.sin(a) * r1) + ' L ' + num2(Math.cos(a) * r) + ' ' + num2(Math.sin(a) * r) + '" stroke="' + A + '" stroke-opacity="' + (isLong ? 0.8 : 0.4) + '" stroke-width="' + (isLong ? 2 : 1.2) + '"/>';
    }
    out += '<circle r="' + num2(r * 0.7) + '" fill="none" stroke="' + A + '" stroke-opacity=".5" stroke-width="1.4"/>';
    out += '<path d="M 0 ' + num2(-r * 0.62) + ' L ' + num2(r * 0.2) + ' 0 L 0 ' + num2(r * 0.62) + ' L ' + num2(-r * 0.2) + ' 0 Z" fill="' + G + '" fill-opacity=".9"/>';
    out += '<path d="M 0 ' + num2(-r * 0.62) + ' L 0 ' + num2(r * 0.62) + '" stroke="' + A + '" stroke-width="1" stroke-opacity=".6"/>';
    out += '<circle r="' + num2(r * 0.13) + '" fill="#0b0f14" stroke="' + G + '" stroke-width="2"/>';
    return out;
  },
  waveform: function (s, A, G) {
    const r = makeRng(23);
    let out = '';
    const bars = 11, bw = s * 0.13, gap = s * 0.055, total = bars * (bw + gap) - gap;
    for (let i = 0; i < bars; i++) {
      const hgt = s * (0.22 + r() * 0.78), x = -total / 2 + i * (bw + gap);
      out += '<rect x="' + num2(x) + '" y="' + num2(-hgt / 2) + '" width="' + num2(bw) + '" height="' + num2(hgt) + '" rx="' + num2(bw / 2) + '" fill="' + G + '" fill-opacity="' + num2(0.35 + (hgt / s) * 0.6) + '"/>';
    }
    out += '<path d="M ' + num2(-total / 2 - s * 0.22) + ' 0 L ' + num2(total / 2 + s * 0.22) + ' 0" stroke="' + A + '" stroke-opacity=".45" stroke-width="1.4"/>';
    out += '<g transform="translate(' + num2(total / 2 + s * 0.68) + ',0)"><rect x="' + num2(-s * 0.17) + '" y="' + num2(-s * 0.42) + '" width="' + num2(s * 0.34) + '" height="' + num2(s * 0.62) + '" rx="' + num2(s * 0.17) + '" fill="rgba(255,255,255,.1)" stroke="' + A + '" stroke-width="1.8"/><path d="M ' + num2(-s * 0.17) + ' ' + num2(s * 0.34) + ' L ' + num2(s * 0.17) + ' ' + num2(s * 0.34) + '" stroke="' + A + '" stroke-width="1.8"/></g>';
    return out;
  },
  shield: function (s, A, G) {
    const w = s * 0.82, h = s * 0.98;
    let out = '<path d="M 0 ' + num2(-h) + ' L ' + num2(w) + ' ' + num2(-h * 0.66) + ' L ' + num2(w * 0.9) + ' ' + num2(h * 0.34) + ' Q 0 ' + num2(h * 1.16) + ' ' + num2(-w * 0.9) + ' ' + num2(h * 0.34) + ' L ' + num2(-w) + ' ' + num2(-h * 0.66) + ' Z" fill="rgba(255,255,255,.07)" stroke="' + A + '" stroke-width="2.2" stroke-linejoin="round"/>';
    out += '<path d="M 0 ' + num2(-h * 0.82) + ' L ' + num2(w * 0.8) + ' ' + num2(-h * 0.54) + ' L ' + num2(w * 0.72) + ' ' + num2(h * 0.28) + ' Q 0 ' + num2(h) + ' ' + num2(-w * 0.72) + ' ' + num2(h * 0.28) + ' L ' + num2(-w * 0.8) + ' ' + num2(-h * 0.54) + ' Z" fill="none" stroke="' + A + '" stroke-opacity=".3" stroke-width="1"/>';
    out += '<circle cy="' + num2(-h * 0.12) + '" r="' + num2(s * 0.2) + '" fill="' + G + '" fill-opacity=".9"/>';
    out += '<path d="M ' + num2(-s * 0.1) + ' ' + num2(-h * 0.12) + ' L ' + num2(s * 0.1) + ' ' + num2(-h * 0.12) + ' L ' + num2(s * 0.17) + ' ' + num2(h * 0.36) + ' L ' + num2(-s * 0.17) + ' ' + num2(h * 0.36) + ' Z" fill="' + G + '" fill-opacity=".9"/>';
    return out;
  },
  key: function (s, A, G) {
    const r = s * 0.34;
    let out = '<g transform="translate(' + num2(-s * 0.3) + ',' + num2(-s * 0.34) + ')">';
    out += '<circle r="' + num2(r) + '" fill="rgba(255,255,255,.08)" stroke="' + A + '" stroke-width="2.4"/>';
    out += '<circle r="' + num2(r * 0.34) + '" fill="' + G + '" fill-opacity=".9"/>';
    out += '</g>';
    out += '<path d="M ' + num2(-s * 0.3 + r * 0.95) + ' ' + num2(-s * 0.34 + r * 0.95) + ' L ' + num2(s * 0.62) + ' ' + num2(s * 0.66) + '" stroke="' + A + '" stroke-width="4.4" stroke-linecap="round"/>';
    out += '<path d="M ' + num2(s * 0.36) + ' ' + num2(s * 0.4) + ' L ' + num2(s * 0.6) + ' ' + num2(s * 0.16) + ' M ' + num2(s * 0.52) + ' ' + num2(s * 0.56) + ' L ' + num2(s * 0.74) + ' ' + num2(s * 0.32) + '" stroke="' + G + '" stroke-width="3" stroke-linecap="round"/>';
    return out;
  },
  flask: function (s, A, G) {
    const w = s * 0.62, h = s * 0.86;
    let out = '<path d="M ' + num2(-w * 0.34) + ' ' + num2(-h) + ' L ' + num2(w * 0.34) + ' ' + num2(-h) + ' L ' + num2(w * 0.34) + ' ' + num2(-h * 0.42) + ' L ' + num2(w) + ' ' + num2(h * 0.72) + ' Q ' + num2(w * 1.1) + ' ' + num2(h) + ' ' + num2(w * 0.6) + ' ' + num2(h) + ' L ' + num2(-w * 0.6) + ' ' + num2(h) + ' Q ' + num2(-w * 1.1) + ' ' + num2(h) + ' ' + num2(-w) + ' ' + num2(h * 0.72) + ' L ' + num2(-w * 0.34) + ' ' + num2(-h * 0.42) + ' Z" fill="rgba(255,255,255,.07)" stroke="' + A + '" stroke-width="2.2" stroke-linejoin="round"/>';
    out += '<path d="M ' + num2(-w * 0.86) + ' ' + num2(h * 0.3) + ' L ' + num2(w * 0.86) + ' ' + num2(h * 0.3) + ' L ' + num2(w) + ' ' + num2(h * 0.72) + ' Q ' + num2(w * 1.1) + ' ' + num2(h) + ' ' + num2(w * 0.6) + ' ' + num2(h) + ' L ' + num2(-w * 0.6) + ' ' + num2(h) + ' Q ' + num2(-w * 1.1) + ' ' + num2(h) + ' ' + num2(-w) + ' ' + num2(h * 0.72) + ' Z" fill="' + G + '" fill-opacity=".38"/>';
    out += '<circle cx="' + num2(-s * 0.14) + '" cy="' + num2(h * 0.58) + '" r="' + num2(s * 0.07) + '" fill="' + G + '" fill-opacity=".8"/>';
    out += '<circle cx="' + num2(s * 0.16) + '" cy="' + num2(h * 0.74) + '" r="' + num2(s * 0.05) + '" fill="' + G + '" fill-opacity=".7"/>';
    out += '<path d="M ' + num2(-w * 0.46) + ' ' + num2(-h * 0.72) + ' L ' + num2(w * 0.46) + ' ' + num2(-h * 0.72) + '" stroke="' + A + '" stroke-opacity=".6" stroke-width="2"/>';
    return out;
  },
  book: function (s, A, G) {
    const w = s * 0.72, h = s * 0.86;
    let out = '<path d="M ' + num2(-w) + ' ' + num2(-h) + ' L ' + num2(w) + ' ' + num2(-h) + ' L ' + num2(w) + ' ' + num2(h) + ' L ' + num2(-w) + ' ' + num2(h) + ' Z" fill="rgba(255,255,255,.07)" stroke="' + A + '" stroke-width="2" stroke-linejoin="round"/>';
    out += '<path d="M 0 ' + num2(-h) + ' L 0 ' + num2(h) + '" stroke="' + A + '" stroke-opacity=".55" stroke-width="1.8"/>';
    out += '<g stroke="' + G + '" stroke-opacity=".7" stroke-width="1.8" stroke-linecap="round">';
    out += '<path d="M ' + num2(-w * 0.74) + ' ' + num2(-h * 0.5) + ' L ' + num2(-w * 0.16) + ' ' + num2(-h * 0.5) + '"/><path d="M ' + num2(-w * 0.74) + ' ' + num2(-h * 0.2) + ' L ' + num2(-w * 0.16) + ' ' + num2(-h * 0.2) + '"/><path d="M ' + num2(-w * 0.74) + ' ' + num2(h * 0.1) + ' L ' + num2(-w * 0.16) + ' ' + num2(h * 0.1) + '"/>';
    out += '<path d="M ' + num2(w * 0.16) + ' ' + num2(-h * 0.5) + ' L ' + num2(w * 0.74) + ' ' + num2(-h * 0.5) + '"/><path d="M ' + num2(w * 0.16) + ' ' + num2(-h * 0.2) + ' L ' + num2(w * 0.74) + ' ' + num2(-h * 0.2) + '"/><path d="M ' + num2(w * 0.16) + ' ' + num2(h * 0.1) + ' L ' + num2(w * 0.5) + ' ' + num2(h * 0.1) + '"/>';
    out += '</g>';
    out += '<path d="M ' + num2(-w) + ' ' + num2(h) + ' L 0 ' + num2(h * 0.86) + ' L ' + num2(w) + ' ' + num2(h) + '" fill="none" stroke="' + A + '" stroke-opacity=".4" stroke-width="1.6"/>';
    return out;
  },
};/**
 * 把一张技能卡的数据渲染成 240x360 的 SVG 卡片（外层包一层投影 div）。
 *
 * 注意：真实数据里的字段名与样张不同 —— 配色数组叫 palette（不是 pal）、
 * 分类叫 category、来源文案叫 levelLabel；纹样缺失或未知时回退到齿轮纹样，
 * 任何字段缺失都不会让卡面变成空白。
 *
 * @param rec 技能卡数据对象（含 name/cn/rarity/stars/stats/tags/palette/motif/glyph/levelLabel）
 * @param i 该卡在列表中的序号，用于隔离 SVG 内部渐变 id
 * @return 一段 HTML 字符串，可直接塞进容器的 innerHTML
 */
function renderCard(rec, i) {
  const name = String(rec.name || '');
  const pal = (Array.isArray(rec.palette) && rec.palette.length === 4)
    ? rec.palette : ['#111722', '#223046', '#5b8cff', '#bcd6ff'];
  const A = pal[2], G = pal[3];
  const rarity = RARITY_COLOR[rec.rarity] ? rec.rarity : 'N';
  const RC = RARITY_COLOR[rarity];
  const stats = Array.isArray(rec.stats) ? rec.stats : [];
  const tags = Array.isArray(rec.tags) ? rec.tags.filter(function (t) { return String(t).length; }) : [];
  const glyph = rec.glyph || String(rec.cn || name).slice(0, 1);
  const drawMotif = MOTIF_DRAW[rec.motif] || MOTIF_DRAW.gear;
  const stars = Math.max(0, Math.min(5, Math.round(Number(rec.stars) || 0)));
  const r = makeRng(hash32(name));
  const uid = (name.replace(/[^a-z0-9]/gi, '') || 'x') + i;
  const hi = rarity === 'SSR' || rarity === 'UR';
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360" width="240" height="360">';
  s += '<defs>'
    + '<linearGradient id="bg' + uid + '" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="' + pal[0] + '"/><stop offset="1" stop-color="' + pal[1] + '"/></linearGradient>'
    + '<radialGradient id="pl' + uid + '"><stop offset="0" stop-color="#ffffff" stop-opacity=".16"/><stop offset=".65" stop-color="' + A + '" stop-opacity=".07"/><stop offset="1" stop-color="' + A + '" stop-opacity="0"/></radialGradient>'
    + '<linearGradient id="hol' + uid + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".14"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
    + '<linearGradient id="fb' + uid + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + RC + '" stop-opacity="0"/><stop offset=".5" stop-color="' + RC + '" stop-opacity=".95"/><stop offset="1" stop-color="' + RC + '" stop-opacity="0"/></linearGradient>'
    + '</defs>';
  s += '<rect width="240" height="360" rx="16" fill="url(#bg' + uid + ')"/>';
  s += '<g opacity=".5">';
  s += '<circle cx="' + (200 + Math.round(r() * 20)) + '" cy="' + (60 + Math.round(r() * 30)) + '" r="' + (110 + Math.round(r() * 40)) + '" fill="none" stroke="' + A + '" stroke-opacity=".13" stroke-width="1"/>';
  s += '<circle cx="' + (200 + Math.round(r() * 20)) + '" cy="' + (60 + Math.round(r() * 30)) + '" r="' + (70 + Math.round(r() * 20)) + '" fill="none" stroke="' + A + '" stroke-opacity=".1" stroke-width="1"/>';
  const dx = Math.round(r() * 160), dy = Math.round(r() * 160);
  s += '<g stroke="' + A + '" stroke-opacity=".09" stroke-width="1">';
  for (let q = -6; q < 14; q++) s += '<path d="M ' + (-60 + q * 22 + dx) + ' ' + (-30 + dy) + ' L ' + (30 + q * 22 + dx) + ' ' + (210 + dy) + '"/>';
  s += '</g><g fill="' + A + '" fill-opacity=".13">';
  for (let gx = 0; gx < 7; gx++) for (let gy = 0; gy < 4; gy++) s += '<circle cx="' + (178 + gx * 10) + '" cy="' + (300 + gy * 10) + '" r="1.3"/>';
  s += '</g></g>';
  s += '<text x="120" y="182" text-anchor="middle" font-family="Microsoft YaHei,Segoe UI,sans-serif" font-size="200" font-weight="700" fill="#ffffff" fill-opacity=".055" letter-spacing="-6">' + escapeSvgText(glyph) + '</text>';
  s += '<rect x="12" y="12" width="42" height="20" rx="6" fill="' + RC + '" fill-opacity=".22" stroke="' + RC + '" stroke-width="1" stroke-opacity=".8"/>';
  s += '<text x="33" y="26.5" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="11" font-weight="700" fill="' + RC + '">' + rarity + '</text>';
  let st = '';
  for (let k = 0; k < 5; k++) st += (k < stars ? '★' : '☆');
  s += '<text x="228" y="27" text-anchor="end" font-family="Segoe UI,sans-serif" font-size="12.5" fill="' + RC + '" letter-spacing="0.5" fill-opacity="' + (stars >= 4 ? 1 : .9) + '">' + st + '</text>';
  s += '<g transform="translate(120,104)"><circle r="70" fill="url(#pl' + uid + ')"/>'
    + '<circle r="56" fill="none" stroke="' + A + '" stroke-opacity=".55" stroke-width="1.5"/>'
    + '<circle r="65" fill="none" stroke="' + A + '" stroke-opacity=".25" stroke-width="1" stroke-dasharray="3 7"/>'
    + '<g>' + drawMotif(40, A, G, r) + '</g></g>';
  s += '<text x="120" y="192" text-anchor="middle" font-family="Microsoft YaHei,Segoe UI,sans-serif" font-size="16.5" font-weight="700" fill="#ffffff">' + escapeSvgText(rec.cn || name) + '</text>';
  s += '<text x="120" y="208" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="9" fill="#ffffff" fill-opacity=".45" letter-spacing="0.3">' + escapeSvgText(name) + '</text>';
  const tglist = tags.slice(0, 3);
  if (tags.length > 3) tglist.push('+' + (tags.length - 3));
  const widths = [], labels = [];
  for (let t = 0; t < tglist.length; t++) {
    labels.push(escapeSvgText(tglist[t]));
    widths.push(Math.min(9, String(tglist[t]).length) * 8 + 16);
  }
  let total = 0;
  for (let w2 = 0; w2 < widths.length; w2++) total += widths[w2] + 6;
  total -= 6;
  let cx2 = 120 - total / 2;
  for (let c2 = 0; c2 < labels.length; c2++) {
    const w3 = widths[c2];
    s += '<rect x="' + num2(cx2) + '" y="222" width="' + num2(w3) + '" height="16" rx="8" fill="#ffffff" fill-opacity=".07" stroke="' + A + '" stroke-opacity=".28"/>';
    s += '<text x="' + num2(cx2 + w3 / 2) + '" y="233.5" text-anchor="middle" font-family="Microsoft YaHei,Segoe UI,sans-serif" font-size="9.5" fill="#ffffff" fill-opacity=".72">' + labels[c2] + '</text>';
    cx2 += w3 + 6;
  }
  s += '<path d="M 20 250 L 220 250" stroke="#ffffff" stroke-opacity=".12" stroke-width="1"/>';
  for (let d = 0; d < 5; d++) {
    const x = 40 + d * 40;
    const v = stats[d] === undefined || stats[d] === null ? '-' : String(stats[d]);
    s += '<text x="' + x + '" y="278" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="14" font-weight="700" fill="' + G + '">' + escapeSvgText(v) + '</text>';
    s += '<text x="' + x + '" y="292" text-anchor="middle" font-family="Microsoft YaHei,Segoe UI,sans-serif" font-size="7.5" fill="#ffffff" fill-opacity=".5">' + STAT_CAPS[d] + '</text>';
    if (d < 4) s += '<path d="M ' + (60 + d * 40) + ' 264 L ' + (60 + d * 40) + ' 296" stroke="#ffffff" stroke-opacity=".1" stroke-width="1"/>';
  }
  s += '<text x="120" y="318" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="8" fill="#ffffff" fill-opacity=".32" letter-spacing="0.4">' + escapeSvgText(rec.project || rec.levelLabel || '') + '</text>';
  s += '<path d="M 20 338 L 220 338" stroke="url(#fb' + uid + ')" stroke-width="3" stroke-linecap="round"/>';
  if (hi) s += '<rect width="240" height="360" rx="16" fill="url(#hol' + uid + ')"/>';
  s += '<rect x="3" y="3" width="234" height="354" rx="14" fill="none" stroke="' + RC + '" stroke-opacity=".85" stroke-width="2"/>';
  s += '<rect x="8" y="8" width="224" height="344" rx="11" fill="none" stroke="#ffffff" stroke-opacity=".1" stroke-width="1"/>';
  s += '</svg>';
  return '<div class="c" style="filter:drop-shadow(0 0 ' + (hi ? 14 : 8) + 'px ' + RC + '55)">' + s + '</div>';
}

    /* ── 15-fx.js ─────────────────────────────── */
/* ── 稀有度特效引擎 2.0：档位越高，叠加的特效层越多 ─────────────
   与样张 F:\DeepSeek\skillcard-preview\carousel.html 里的引擎同源（该版已定稿）：
   下层画布画在卡面之外（柔光 / 光柱 / 光轮 / 光粒 / 冲击波），上层画布裁剪在卡面圆角
   之内（全息虹彩 / 高光扫过 / 星芒）。只有居中那张卡跑 rAF，其余卡图层透明度归零、
   完全不绘制；特效开关关闭时立刻停帧并整体隐藏。
   ──────────────────────────────────────────────────────────── */
var FXW=640,FXH=800,FCX=320,FCY=400,FCW=240,FCH=360,FXR=16;
/* 各档主题色（与稀有度同色，保证卡牌配色体系不被打乱） */
var FXCOL={N:"#8b95a5",R:"#4a9eff",SR:"#b06bff",SSR:"#ffb020",UR:"#ff4d6d"};
/*
 * 各档解锁的特效层。设计口径：低档只做静态柔光，档位越高叠加的层越多，
 * 视觉强度由「层数」自然堆出梯度，而不是让同一套特效换五种颜色。
 * anim=0 表示该档完全静态（连逐帧循环都不跑，省性能）。
 */
var FXLV={
 N:{glow:.06},
 R:{glow:.10,sweep:1,glare:1,anim:1},
 SR:{glow:.14,sweep:1,glare:1,holo:1,anim:1},
 SSR:{glow:.18,sweep:1,glare:1,holo:2,orbit:1,star:1,anim:1},
 UR:{glow:.23,sweep:1,glare:1,holo:2,orbit:1,star:1,rays:1,motes:1,burst:1,anim:1}
};
var FXcvA=null,FXctxA=null,FXcvB=null,FXctxB=null,FXr="",FXt=0,FXdt=0,FXlast=0,FXraf=0;
var FXmotes=[],FXorbit=[],FXstar=[],FXstarNext=0,FXburst=0;
/* 特效开关：true 表示用户关掉了特效，fxSync 需要停帧且不绑定画布 */
var FXOFF=false;
/**
 * 取一条技能卡的合法稀有度：任何脏值都退回 N 档，保证特效层永远有配色可用。
 *
 * @param rec 技能卡数据
 * @return 五档之一的稀有度字符串
 */
function fxRarity(rec){
 var r=rec&&rec.rarity;
 return FXCOL[r]?r:"N";
}
/**
 * 生成卡面下方的特效容器（柔光、光轮、光粒都画在卡牌背后）。
 *
 * @param rec 技能卡数据
 * @return 特效容器 HTML 片段
 */
function fxHTML(rec){
 var ra=fxRarity(rec);
 return '<div class="fx" data-r="'+ra+'" style="--fx:'+FXCOL[ra]+'">'
  +'<canvas width="'+FXW+'" height="'+FXH+'"></canvas>'
  +'<i class="fxrim"></i><i class="fxrim b"></i></div>';
}
/**
 * 生成卡面上方的特效画布：全息虹彩、高光扫过、星芒这些必须盖在卡面之上才像闪卡。
 *
 * @param rec 技能卡数据
 * @return 顶部画布的 HTML 片段
 */
function fxUpHTML(rec){
 return '<canvas class="fxup" data-r="'+fxRarity(rec)+'" width="'+FXW+'" height="'+FXH+'"></canvas>';
}
/**
 * 把 #rrggbb 转成带透明度的 rgba 字符串。
 *
 * @param hex 十六进制颜色
 * @param a 透明度 0~1
 * @return rgba() 颜色字符串
 */
function fxRGBA(hex,a){
 var n=parseInt(hex.slice(1),16);
 return "rgba("+(n>>16&255)+","+(n>>8&255)+","+(n&255)+","+a+")";
}
/**
 * 追加一个圆角矩形路径（不 beginPath，方便与整块画布组成 even-odd 裁剪区）。
 *
 * @param c 画布上下文
 * @param x 左上角 X
 * @param y 左上角 Y
 * @param w 宽度
 * @param h 高度
 * @param r 圆角半径
 */
function fxRR(c,x,y,w,h,r){
 c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);
 c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();
}
/**
 * 求「卡框外扩 off 像素后的圆角矩形」上比例位置 s 的坐标，供边框扫光与环绕光粒取点。
 *
 * @param s 沿周长比例 0~1（自动循环）
 * @param off 外扩像素
 * @return [x,y] 画布坐标
 */
function fxFrame(s,off){
 var w=FCW+2*off,h=FCH+2*off,r=FXR+off;
 var sw=w-2*r,sh=h-2*r,q=Math.PI*r/2,P=2*sw+2*sh+4*q;
 var d=((s%1)+1)%1*P,x0=FCX-w/2,y0=FCY-h/2,a;
 if(d<sw)return [x0+r+d,y0];d-=sw;
 if(d<q){a=-Math.PI/2+d/r;return [x0+w-r+r*Math.cos(a),y0+r+r*Math.sin(a)];}d-=q;
 if(d<sh)return [x0+w,y0+r+d];d-=sh;
 if(d<q){a=d/r;return [x0+w-r+r*Math.cos(a),y0+h-r+r*Math.sin(a)];}d-=q;
 if(d<sw)return [x0+w-r-d,y0+h];d-=sw;
 if(d<q){a=Math.PI/2+d/r;return [x0+r+r*Math.cos(a),y0+h-r+r*Math.sin(a)];}d-=q;
 if(d<sh)return [x0,y0+h-r-d];d-=sh;
 a=Math.PI+d/r;return [x0+r+r*Math.cos(a),y0+r+r*Math.sin(a)];
}
/**
 * 按档位重置粒子与动画状态。切档或重建卡片时调用。
 *
 * @param r 稀有度
 */
function fxInit(r){
 var L=FXLV[r]||FXLV.N,i;
 FXr=r;FXmotes=[];FXorbit=[];FXstar=[];FXstarNext=.3;FXburst=0;FXt=0;
 if(L.orbit){for(i=0;i<46;i++)FXorbit.push({s:Math.random(),sp:.085+Math.random()*.10,off:1+Math.random()*10});}
 if(L.motes){for(i=0;i<44;i++)FXmotes.push({x:FCX+(Math.random()-.5)*380,y:120+Math.random()*480,
  vy:-22-Math.random()*54,r:.7+Math.random()*1.7,a:.25+Math.random()*.55,ph:Math.random()*6.28});}
}
/**
 * 卡牌背后的柔光：所有档位都有，强度按档位递增并轻微呼吸。
 *
 * @param c 画布上下文
 * @param col 主题色
 * @param L 当前档位的特效配置
 */
function fxGlowA(c,col,L){
 var k=L.glow,s=k*3.4,i,br;
 /* ① 环境晕：范围大但极淡，只负责把卡从背景里托起来，不承担细节（否则就是一团色雾） */
 var g=c.createRadialGradient(FCX,FCY,110,FCX,FCY,270);
 g.addColorStop(0,fxRGBA(col,k*.40));g.addColorStop(.46,fxRGBA(col,k*.17));g.addColorStop(.74,fxRGBA(col,k*.05));g.addColorStop(1,fxRGBA(col,0));
 c.fillStyle=g;c.fillRect(0,0,FXW,FXH);
 /* ② 贴边光：沿卡框描边叠三层阴影，光紧贴轮廓走——这才是「实体卡被灯照亮」的观感来源 */
 c.save();
 for(i=2;i>=0;i--){
  br=7+i*13;
  c.beginPath();fxRR(c,FCX-FCW/2,FCY-FCH/2,FCW,FCH,FXR);
  c.lineWidth=1.6+i*2.2;
  c.strokeStyle=fxRGBA(col,s*(1-i*.26));
  c.shadowColor=fxRGBA(col,s*(1-i*.22));c.shadowBlur=br;
  c.stroke();
 }
 /* ③ 外沿金属亮线（R 起）：一圈极细高光边，让边框看起来是金属条而不是发光塑料 */
 if(L.sweep){
  c.shadowBlur=0;
  c.beginPath();fxRR(c,FCX-FCW/2-.6,FCY-FCH/2-.6,FCW+1.2,FCH+1.2,FXR);
  c.lineWidth=1.5;c.strokeStyle=fxRGBA("#ffffff",.30+.10*Math.sin(FXt*1.1));c.stroke();
 }
 c.restore();
}
/**
 * UR 的放射光轮：18 道光柱缓慢旋转，整块裁掉卡面区域，光只出现在卡外，
 * 因此不会把卡面洗白。
 *
 * @param c 画布上下文
 * @param col 主题色
 */
function fxRaysA(c,col){
 c.save();
 c.beginPath();c.rect(0,0,FXW,FXH);fxRR(c,FCX-FCW/2,FCY-FCH/2,FCW,FCH,FXR);c.clip("evenodd");
 var NB=18,rot=FXt*.32,i,an,g;
 for(i=0;i<NB;i++){
  an=rot+i*(6.283/NB);
  g=c.createLinearGradient(FCX,FCY,FCX+Math.cos(an)*300,FCY+Math.sin(an)*300);
  g.addColorStop(0,fxRGBA(col,.34));g.addColorStop(.40,fxRGBA("#ff8a3d",.12));g.addColorStop(.72,fxRGBA("#ff7a1e",.04));g.addColorStop(1,fxRGBA("#ff7a1e",0));
  c.fillStyle=g;c.beginPath();c.moveTo(FCX,FCY);
  c.lineTo(FCX+Math.cos(an-.012)*300,FCY+Math.sin(an-.012)*300);
  c.lineTo(FCX+Math.cos(an+.012)*300,FCY+Math.sin(an+.012)*300);
  c.closePath();c.fill();
 }
 c.restore();
}
/**
 * 边框金属扫光：一个高光头沿卡框跑一圈，身后拖一条逐渐变细的尾巴，
 * 模拟实体卡的金边被灯扫到的反光（卡牌游戏最常见的高级感来源）。
 *
 * @param c 画布上下文
 * @param col 主题色
 */
function fxSweepA(c,col){
 var head=(FXt*.19)%1,i,pt,al;
 for(i=0;i<34;i++){
  al=Math.pow(1-i/34,2.2);
  pt=fxFrame(head-i*.0042,1.5);
  c.fillStyle=fxRGBA(i<3?"#ffffff":col,al*.8);
  c.beginPath();c.arc(pt[0],pt[1],1.4+2.5*al,0,6.283);c.fill();
 }
 pt=fxFrame(head,1.5);
 c.save();c.shadowColor="#ffffff";c.shadowBlur=16;
 c.fillStyle=fxRGBA("#ffffff",.95);c.beginPath();c.arc(pt[0],pt[1],3.1,0,6.283);c.fill();c.restore();
}
/**
 * 环绕光粒（SSR 起）：一队光点沿卡框外侧循环流动，每颗拖一小段彗尾。
 *
 * @param c 画布上下文
 * @param col 主题色
 */
function fxOrbitA(c,col){
 var i,j,o,pt;
 for(i=0;i<FXorbit.length;i++){
  o=FXorbit[i];o.s=(o.s+o.sp*FXdt)%1;
  for(j=5;j>=0;j--){
   pt=fxFrame(o.s-j*.0055,o.off+Math.sin(FXt*2+o.s*9)*1.6);
   c.fillStyle=(j===0)?fxRGBA("#ffffff",.9):fxRGBA(col,.5*(1-j/6));
   c.beginPath();c.arc(pt[0],pt[1],j===0?2.1:1.9*(1-j/8),0,6.283);c.fill();
  }
 }
}
/**
 * UR 的冲击波：一圈圆角矩形从卡框向外扩散淡出，扩散起点伴随一次中心白闪，
 * 起到「抽到最高稀有度」的爆发感。周期 3.2 秒。
 *
 * @param c 画布上下文
 * @param col 主题色
 */
function fxBurstA(c,col){
 FXburst+=FXdt/3.2;if(FXburst>1)FXburst-=1;
 var e=FXburst,al=Math.pow(1-e,2.6),off=2+e*e*110;
 if(e<.16){
  var f=(1-e/.16),fg=c.createRadialGradient(FCX,FCY,20,FCX,FCY,300);
  fg.addColorStop(0,fxRGBA("#ffffff",.42*f));fg.addColorStop(.4,fxRGBA(col,.16*f));fg.addColorStop(.75,fxRGBA(col,.04*f));fg.addColorStop(1,fxRGBA(col,0));
  c.fillStyle=fg;c.fillRect(0,0,FXW,FXH);
 }
 if(al<.02)return;
 c.save();c.globalAlpha=al;c.shadowColor=col;c.shadowBlur=24;
 c.strokeStyle=fxRGBA("#ffd79a",1);c.lineWidth=2.4+6*(1-e);
 c.beginPath();fxRR(c,FCX-FCW/2-off,FCY-FCH/2-off,FCW+2*off,FCH+2*off,FXR+off);c.stroke();c.restore();
}
/**
 * UR 的上升光尘：颗粒自卡下方浮起、逐渐变暗并随机闪烁。
 *
 * @param c 画布上下文
 * @param col 主题色
 */
function fxMotesA(c,col){
 var i,p,al;
 for(i=0;i<FXmotes.length;i++){
  p=FXmotes[i];p.y+=p.vy*FXdt;p.x+=Math.sin(FXt*1.3+p.ph)*22*FXdt;
  if(p.y<120){p.y=610;p.x=FCX+(Math.random()-.5)*380;}
  al=p.a*(.45+.55*Math.abs(Math.sin(FXt*2.4+p.ph)));
  c.fillStyle=fxRGBA("#ffe3a8",al);c.beginPath();c.arc(p.x,p.y,p.r,0,6.283);c.fill();
  c.fillStyle=fxRGBA(col,al*.28);c.beginPath();c.arc(p.x,p.y,p.r*2.8,0,6.283);c.fill();
 }
}
/**
 * 卡面受光：左上角一层极淡白色斜光、右下角压一点暗边。
 * 有了统一的光向，卡面才会被看成「一块有厚度的实体」，而不是贴在屏幕上的平面图。
 *
 * @param c 画布上下文
 * @param k 光照强度 0~1（按档位递增）
 */
function fxLightB(c,k){
 var g=c.createLinearGradient(FCX-FCW/2,FCY-FCH/2,FCX+FCW/2,FCY+FCH/2);
 g.addColorStop(0,"rgba(255,255,255,"+(.17*k)+")");
 g.addColorStop(.32,"rgba(255,255,255,"+(.055*k)+")");
 g.addColorStop(.62,"rgba(255,255,255,0)");
 g.addColorStop(1,"rgba(0,0,0,"+(.17*k)+")");
 c.fillStyle=g;c.fillRect(FCX-FCW/2,FCY-FCH/2,FCW,FCH);
}
/**
 * 卡面常驻全息底纹：整张卡面铺一层极淡的彩虹渐变，方向随时间缓慢摆动。
 * 这一层保证任何时刻卡面都带「闪卡」质感，而不是只有光带扫过时才有。
 *
 * @param c 画布上下文
 * @param base 基础透明度
 */
function fxSheenB(c,base){
 var ang=-.38+.26*Math.sin(FXt*.22),shift=Math.sin(FXt*.31)*48;
 c.save();c.translate(FCX,FCY);c.rotate(ang);
 var g=c.createLinearGradient(-150+shift,-260,150+shift,260);
 g.addColorStop(0,fxRGBA("#ff4d6d",1));g.addColorStop(.25,fxRGBA("#ffb020",1));
 g.addColorStop(.5,fxRGBA("#7cff8a",1));g.addColorStop(.75,fxRGBA("#4ad4ff",1));
 g.addColorStop(1,fxRGBA("#b06bff",1));
 c.globalAlpha=base;c.fillStyle=g;c.fillRect(-300,-300,600,600);
 c.restore();c.globalAlpha=1;
}
/**
 * 卡面全息衍射带：一条边缘柔和的彩虹光带在卡面内来回摆动（摆幅由正弦控制，
 * 不会整条跑出卡外），所以任何时刻都能看到它在卡面上流动。
 *
 * @param c 画布上下文
 * @param ph 相位偏移 0~1
 * @param sp 摆动速度（正负决定方向，用于做双向双带）
 * @param base 基础透明度
 */
function fxHoloBand(c,ph,sp,base){
 var T=130,M=15,ang=-.38,i,al,off,g;
 var travel=Math.sin((FXt*sp+ph)*6.283)*250;
 c.save();c.translate(FCX,FCY);c.rotate(ang);
 for(i=0;i<M;i++){
  off=(i/(M-1)-.5)*T;
  al=Math.exp(-Math.pow(off/(T*.34),2))*base;
  if(al<.006)continue;
  c.globalAlpha=al;
  g=c.createLinearGradient(0,-380,0,380);
  g.addColorStop(0,fxRGBA("#ff4d6d",1));g.addColorStop(.2,fxRGBA("#ffb020",1));
  g.addColorStop(.4,fxRGBA("#7cff8a",1));g.addColorStop(.6,fxRGBA("#4ad4ff",1));
  g.addColorStop(.8,fxRGBA("#b06bff",1));g.addColorStop(1,fxRGBA("#ff4d6d",1));
  c.fillStyle=g;c.fillRect(travel+off-T/M/2,-380,T/M+1,760);
 }
 c.restore();c.globalAlpha=1;
}
/**
 * 卡面高光扫过：一条宽而柔的白色光带斜向掠过，模拟亮面卡纸的反光。
 * 摆幅收窄到 ±320px，保证一轮里大部分时间都能扫到卡面，否则等于没有。
 *
 * @param c 画布上下文
 * @param sp 扫描速度
 * @param base 峰值透明度
 */
function fxGlareB(c,sp,base){
 var p=((FXt*sp)%1+1)%1,env=Math.pow(Math.sin(Math.PI*p),1.6)*base,T=200,M=13,i,al,off;
 if(env<.004)return;
 var travel=(p*2-1)*320;
 c.save();c.translate(FCX,FCY);c.rotate(-.38);
 for(i=0;i<M;i++){
  off=(i/(M-1)-.5)*T;
  al=Math.exp(-Math.pow(off/(T*.3),2))*env;
  if(al<.004)continue;
  c.globalAlpha=al;c.fillStyle="#ffffff";c.fillRect(travel+off-T/M/2,-380,T/M+1,760);
 }
 c.restore();c.globalAlpha=1;
}
/**
 * 卡面星芒（SSR 起）：随机位置闪出的十字星点，出现即亮起、随后淡出。
 *
 * @param c 画布上下文
 */
function fxStarB(c){
 FXstarNext-=FXdt;
 if(FXstarNext<=0){
  FXstarNext=.3+Math.random()*.45;
  FXstar.push({x:FCX+(Math.random()-.5)*190,y:FCY+(Math.random()-.5)*310,a:0,life:.55+Math.random()*.5,sz:8+Math.random()*14});
 }
 var i,s,t,al,r,g;
 for(i=FXstar.length-1;i>=0;i--){
  s=FXstar[i];s.a+=FXdt;
  if(s.a>s.life){FXstar.splice(i,1);continue;}
  t=s.a/s.life;al=Math.sin(Math.PI*t);r=s.sz*(.45+.55*al);
  c.globalAlpha=al;c.strokeStyle=fxRGBA("#ffffff",.92);c.lineWidth=1.1;
  c.beginPath();
  c.moveTo(s.x-r,s.y);c.lineTo(s.x+r,s.y);c.moveTo(s.x,s.y-r);c.lineTo(s.x,s.y+r);
  c.moveTo(s.x-r*.6,s.y-r*.6);c.lineTo(s.x+r*.6,s.y+r*.6);
  c.moveTo(s.x-r*.6,s.y+r*.6);c.lineTo(s.x+r*.6,s.y-r*.6);
  c.stroke();
  g=c.createRadialGradient(s.x,s.y,0,s.x,s.y,r*.55);
  g.addColorStop(0,fxRGBA("#ffffff",.9));g.addColorStop(1,fxRGBA("#ffffff",0));
  c.fillStyle=g;c.beginPath();c.arc(s.x,s.y,r*.55,0,6.283);c.fill();c.globalAlpha=1;
 }
}
/**
 * 绘制卡牌下方的整层特效。
 *
 * @param dt 距上一帧的秒数
 */
function fxDrawA(dt){
 var c=FXctxA,L=FXLV[FXr]||FXLV.N,col=FXCOL[FXr]||"#8b95a5";
 if(!c)return;
 c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,FXW,FXH);c.globalCompositeOperation="source-over";
 fxGlowA(c,col,L);
 c.globalCompositeOperation="lighter";
 if(L.rays)fxRaysA(c,col);
 if(L.burst)fxBurstA(c,col);
 if(L.orbit)fxOrbitA(c,col);
 if(L.motes)fxMotesA(c,col);
 if(L.sweep)fxSweepA(c,col);
 c.globalCompositeOperation="source-over";
}
/**
 * 绘制卡牌上方的整层特效：整层裁剪在卡面圆角矩形内，绝不溢出卡外。
 *
 * @param dt 距上一帧的秒数
 */
function fxDrawB(dt){
 var c=FXctxB,L=FXLV[FXr]||FXLV.N;
 if(!c)return;
 c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,FXW,FXH);
 if(!L.holo&&!L.glare&&!L.star)return;
 c.save();c.beginPath();fxRR(c,FCX-FCW/2,FCY-FCH/2,FCW,FCH,FXR);c.clip();
 fxLightB(c,Math.min(1,L.glow*4.6));
 c.globalCompositeOperation="lighter";
 if(L.holo)fxSheenB(c,L.holo>1?.11:.08);
 if(L.holo)fxHoloBand(c,0,.09,.085);
 if(L.holo>1)fxHoloBand(c,.45,-.07,.075);
 if(L.glare)fxGlareB(c,.24,.085);
 if(L.star)fxStarB(c);
 c.restore();c.globalCompositeOperation="source-over";
}
/**
 * 逐帧回调：先算 dt，再依次画上下两层；静态档位（N）画完一帧即停，不再占用 rAF。
 *
 * @param ts requestAnimationFrame 传入的时间戳
 */
function fxLoop(ts){
 FXraf=0;if(!FXctxA&&!FXctxB)return;
 FXdt=FXlast?Math.min(.05,(ts-FXlast)/1000):.016;FXlast=ts;FXt+=FXdt;
 try{fxDrawA(FXdt);fxDrawB(FXdt);}catch(e){window.__fxerr=String(e&&e.message||e);}
 if(((FXLV[FXr]||FXLV.N).anim)&&(FXctxA||FXctxB))FXraf=requestAnimationFrame(fxLoop);
}
/**
 * 让特效只跟随当前居中的卡片：换卡或换档时重新绑定两块画布并重置粒子；
 * 两侧的卡片特效透明度归零、完全不绘制，避免十几张卡同时 60fps 重绘。
 *
 * 卡片节点数组与当前索引由面板传入：引擎本身不认识面板的状态，方便单独复用与测试。
 *
 * @param list 当前轨道上的卡牌节点数组
 * @param curIndex 居中那张卡在数组里的下标
 */
function fxSync(list,curIndex){
 var i,act=null;
 if(!list)list=[];
 for(i=0;i<list.length;i++){
  var on=(i===curIndex)&&!FXOFF;
  if(on)act=list[i];
  var fxi=list[i].querySelector(".fx");
  if(fxi)fxi.parentNode.classList[on?"add":"remove"]("fx-on");
 }
 if(!act){if(FXraf){cancelAnimationFrame(FXraf);FXraf=0;}FXctxA=FXctxB=null;FXcvA=FXcvB=null;FXr="";return;}
 var fx=act.querySelector(".fx"),up=act.querySelector("canvas.fxup"),ra=fx?fx.getAttribute("data-r"):"N";
 if(!fx)return;
 var ca=fx.querySelector("canvas");
 if(ca!==FXcvA||up!==FXcvB||ra!==FXr){
  FXcvA=ca;FXcvB=up;FXctxA=ca?ca.getContext("2d"):null;FXctxB=up?up.getContext("2d"):null;
  if(FXctxA||FXctxB)fxInit(ra);
 }
 if((FXctxA||FXctxB)&&!FXraf){FXlast=0;FXraf=requestAnimationFrame(fxLoop);}
}

    /* ── 20-style.js ─────────────────────────────── */
/**
 * 面板作用域内的全部 CSS（由样张 carousel.html 的 style 块改造而来）。
 *
 * 每条选择器都挂在 .skc-root 之下，避免污染宿主应用；
 * 两个 id（#taglist / #toast）已改名为 class（.skc-taglist / .skc-toast）防止与宿主冲突。
 */
const SKC_CSS = ".skc-root,.skc-root *{box-sizing:border-box}\n.skc-root{background:#070a10;color:#e6edf7;font-family:\"Microsoft YaHei\",\"Segoe UI\",sans-serif;margin:0;padding:20px 26px 24px; background-image:radial-gradient(1200px 600px at 20% -10%,rgba(59,130,246,.12),transparent),radial-gradient(900px 500px at 90% 0%,rgba(139,92,246,.10),transparent)}\n.skc-root h1{font-size:18px;margin:0 0 4px}\n.skc-root .sub{opacity:.5;font-size:11.5px}\n.skc-root .bar{display:flex;align-items:center;gap:8px;margin:14px 0 10px;flex-wrap:wrap}\n.skc-root .tab{padding:5px 13px;border-radius:999px;background:rgba(255,255,255,.055);font-size:12.5px;border:1px solid rgba(255,255,255,.08);white-space:nowrap;cursor:pointer}\n.skc-root .tab.on{background:linear-gradient(135deg,#3b82f6,#8b5cf6);border-color:transparent;font-weight:600}\n.skc-root .tab b{opacity:.6;font-weight:600;margin-left:5px;font-size:10.5px}\n.skc-root .tagbar{display:flex;align-items:center;gap:9px;margin:2px 0 10px;flex-wrap:wrap}\n.skc-root .tagbar .lbl{font-size:11px;opacity:.45;letter-spacing:1px;flex:0 0 auto}\n.skc-root .skc-taglist{display:flex;gap:6px;flex-wrap:wrap;flex:1;min-width:0}\n.skc-root .tchip{padding:3px 11px;border-radius:999px;font-size:11.5px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.1);color:#b9c5d6;cursor:pointer;white-space:nowrap;user-select:none}\n.skc-root .tchip:hover{border-color:rgba(139,92,246,.65);color:#e6edf7}\n.skc-root .tchip.on{background:linear-gradient(135deg,#8b5cf6,#6366f1);border-color:transparent;color:#fff;font-weight:600;box-shadow:0 0 14px rgba(139,92,246,.45)}\n.skc-root .tchip b{opacity:.45;font-weight:600;margin-left:4px;font-size:9.5px}\n.skc-root .tchip.on b{opacity:.85}\n.skc-root .tchip.clear{background:transparent;border-style:dashed;color:#a8b4c6}\n.skc-root .search{width:232px;flex:0 0 auto;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.14);color:#e6edf7;font-family:inherit;font-size:12px;padding:6px 13px;border-radius:999px;outline:none}\n.skc-root .search:focus{border-color:#8b5cf6;box-shadow:0 0 0 2px rgba(139,92,246,.18)}\n.skc-root .search::placeholder{color:rgba(230,237,247,.3)}\n.skc-root .modes{display:flex;gap:8px}\n.skc-root .mbtn{padding:7px 16px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#cfd8e6;font-size:12.5px;cursor:pointer;font-family:inherit}\n.skc-root .mbtn.on{background:linear-gradient(135deg,rgba(59,130,246,.9),rgba(139,92,246,.9));border-color:transparent;color:#fff;font-weight:600;box-shadow:0 0 18px rgba(99,102,241,.45)}\n.skc-root .setting{display:flex;align-items:center;gap:12px;margin:12px 0 2px;font-size:12px;color:#cfd8e6}\n.skc-root .setting .lbl{opacity:.6;letter-spacing:.5px;white-space:nowrap}\n.skc-root .setting input[type=range]{width:200px;accent-color:#8b5cf6;cursor:pointer}\n.skc-root .setting .val{font-variant-numeric:tabular-nums;font-weight:700;color:#c4b5fd;min-width:150px}\n.skc-root .setting .tip{opacity:.35;font-size:11px;white-space:nowrap}\n.skc-root .deck{position:relative}\n.skc-root .stage{position:relative;height:500px;overflow:hidden;perspective:2200px;perspective-origin:50% 46%;touch-action:none;cursor:grab; user-select:none;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;-webkit-tap-highlight-color:transparent}\n.skc-root .stage *{user-select:none;-webkit-user-select:none;-webkit-user-drag:none}\n.skc-root .stage.drag{cursor:grabbing}\n.skc-root .stage::before,.skc-root .stage::after{content:'';position:absolute;top:0;bottom:0;width:140px;z-index:900;pointer-events:none}\n.skc-root .stage::before{left:0;background:linear-gradient(90deg,#070a10 12%,rgba(7,10,16,0))}\n.skc-root .stage::after{right:0;background:linear-gradient(270deg,#070a10 12%,rgba(7,10,16,0))}\n.skc-root .track{position:absolute;left:0;right:0;top:0;bottom:0;transition:transform .32s cubic-bezier(.22,1,.36,1)}\n.skc-root .stage.ring .track{transform-style:preserve-3d}\n.skc-root .card3d{position:absolute;left:50%;top:46%;width:240px;height:360px;transform-origin:50% 50%; transition:transform .6s cubic-bezier(.22,1,.36,1),opacity .45s ease;will-change:transform,opacity}\n.skc-root .card3d .c{width:240px}\n.skc-root .card3d svg{display:block;width:240px;height:360px;border-radius:16px}\n.skc-root .card3d svg *{pointer-events:none}\n.skc-root /* ── 详情面板 ─────────────────────────────────────── */ .dpanel{position:absolute;left:432px;right:0;top:0;bottom:0;z-index:1500;overflow:hidden; opacity:0;pointer-events:none;transform:translateX(26px);transition:opacity .34s ease,transform .42s cubic-bezier(.22,1,.36,1)}\n.skc-root .deck.open .dpanel{opacity:1;pointer-events:auto;transform:none}\n.skc-root .panel{position:relative;height:100%;padding:18px 22px 18px 26px; background:linear-gradient(135deg,rgba(18,24,38,.92),rgba(11,15,24,.88)); border:1px solid rgba(255,255,255,.1); clip-path:polygon(18px 0,100% 0,100% calc(100% - 18px),calc(100% - 18px) 100%,0 100%,0 18px); box-shadow:inset 0 0 60px rgba(0,0,0,.45)}\n.skc-root .panel::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--rc,#8b95a5);box-shadow:0 0 22px var(--rc,#8b95a5)}\n.skc-root .phead{display:flex;align-items:center;gap:10px;margin-bottom:8px}\n.skc-root .rbadge{font-size:11px;font-weight:800;letter-spacing:1.2px;padding:3px 11px;color:#0a0d13; clip-path:polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)}\n.skc-root .ptitle{font-size:22px;font-weight:800;letter-spacing:.5px;line-height:1.15}\n.skc-root .pen{font-size:11px;opacity:.4;font-family:Segoe UI,sans-serif;margin-top:2px}\n.skc-root .stars{margin-left:auto;font-size:15px;letter-spacing:2px;color:rgba(255,255,255,.16)}\n.skc-root .stars .on{color:#ffc94d;text-shadow:0 0 10px rgba(255,201,77,.7)}\n.skc-root .pcat{font-size:11px;padding:2px 9px;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1)}\n.skc-root .pdesc{font-size:12.5px;line-height:1.75;opacity:.72;margin:10px 0 12px;height:66px;overflow:hidden}\n.skc-root .stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px}\n.skc-root .stat{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);padding:7px 10px 8px; clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}\n.skc-root .stat .v{font-size:21px;font-weight:800;line-height:1.1}\n.skc-root .stat .l{font-size:10px;opacity:.45;margin-top:1px}\n.skc-root .stat .bar{height:3px;background:rgba(255,255,255,.1);margin-top:6px;border-radius:2px;overflow:hidden}\n.skc-root .stat .bar i{display:block;height:100%;border-radius:2px}\n.skc-root .tagwrap{display:flex;align-items:flex-start;gap:9px;margin:11px 0 12px}\n.skc-root .tags{display:flex;gap:7px;flex-wrap:wrap;flex:1;min-height:26px;max-height:52px;overflow:hidden}\n.skc-root .tag{font-size:11px;padding:3px 10px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);opacity:.85;white-space:nowrap}\n.skc-root .tag.rm{cursor:pointer;border-color:rgba(255,120,140,.45);opacity:1}\n.skc-root .tag.rm:hover{background:rgba(255,90,110,.18)}\n.skc-root .tag.rm i{font-style:normal;margin-left:5px;opacity:.55;font-weight:700}\n.skc-root .tag.rm:hover i{opacity:1}\n.skc-root .tag.empty{opacity:.3;border-style:dashed}\n.skc-root .tagadd{flex:0 0 auto;font-size:11px;color:#c4b5fd;background:rgba(139,92,246,.12);border:1px dashed rgba(139,92,246,.55);padding:4px 11px;border-radius:999px;cursor:pointer;font-family:inherit;letter-spacing:.5px;white-space:nowrap}\n.skc-root .tagadd:hover{background:rgba(139,92,246,.26)}\n.skc-root .newtag{width:136px;padding:4px 11px;font-size:11px;border-radius:999px}\n.skc-root .acts{display:flex;gap:10px;margin-top:14px}\n.skc-root .gbtn{position:relative;padding:9px 24px;font-size:12.5px;font-family:inherit;letter-spacing:1px;color:#dbe6f6;cursor:pointer; background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.03)); border:1px solid rgba(255,255,255,.16); clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px); transition:background .18s,box-shadow .18s}\n.skc-root .gbtn:hover{background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,.07))}\n.skc-root .gbtn.primary{background:linear-gradient(180deg,rgba(59,130,246,.6),rgba(139,92,246,.35));border-color:rgba(139,92,246,.75);box-shadow:0 0 20px rgba(99,102,241,.35)}\n.skc-root .gbtn.danger{background:linear-gradient(180deg,rgba(220,60,80,.45),rgba(150,20,40,.25));border-color:rgba(255,90,110,.6)}\n.skc-root .gbtn.danger:hover{box-shadow:0 0 20px rgba(255,80,100,.4)}\n.skc-root .gbtn.ghost{color:#a8b4c6}\n.skc-root /* 编辑态控件 */ .editrow{display:flex;align-items:center;gap:8px;margin:6px 0;font-size:12px;color:#cfd8e6}\n.skc-root .editrow .k{width:60px;opacity:.5;font-size:11px;flex:0 0 auto}\n.skc-root .sel,.skc-root .tin{background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.16);color:#e6edf7;font-family:inherit;font-size:12px;padding:5px 9px;border-radius:6px;outline:none}\n.skc-root .sel:focus,.skc-root .tin:focus{border-color:#8b5cf6;box-shadow:0 0 0 2px rgba(139,92,246,.2)}\n.skc-root .ta{width:100%;height:84px;resize:none;line-height:1.7;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.16);color:#e6edf7;font-family:inherit;font-size:12.5px;padding:8px 10px;border-radius:6px;outline:none}\n.skc-root .ta:focus{border-color:#8b5cf6;box-shadow:0 0 0 2px rgba(139,92,246,.2)}\n.skc-root .rpicks{display:flex;gap:5px}\n.skc-root .rpick{font-size:10.5px;font-weight:800;letter-spacing:.6px;padding:4px 10px;border-radius:5px;cursor:pointer;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:#c8d3e3}\n.skc-root .rpick.on{color:#0a0d13}\n.skc-root .starpick{font-size:16px;letter-spacing:3px;cursor:pointer;color:rgba(255,255,255,.2)}\n.skc-root .starpick .on{color:#ffc94d;text-shadow:0 0 10px rgba(255,201,77,.7)}\n.skc-root .snum{width:100%;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.18);color:#e6edf7;font-family:inherit;font-size:17px;font-weight:800;padding:2px 4px;border-radius:5px;outline:none}\n.skc-root /* 删除确认 */ .confirm{position:absolute;inset:0;z-index:1900;display:flex;align-items:center;justify-content:center; background:rgba(4,6,11,.72);backdrop-filter:blur(3px);opacity:0;pointer-events:none;transition:opacity .25s}\n.skc-root .confirm.on{opacity:1;pointer-events:auto}\n.skc-root .cbox{width:430px;padding:22px 24px;background:linear-gradient(135deg,rgba(24,28,42,.97),rgba(13,16,26,.97)); border:1px solid rgba(255,90,110,.45);box-shadow:0 0 40px rgba(255,60,90,.22); clip-path:polygon(16px 0,100% 0,100% calc(100% - 16px),calc(100% - 16px) 100%,0 100%,0 16px)}\n.skc-root .cbox h3{margin:0 0 8px;font-size:15px;color:#ff8a9c;letter-spacing:1px}\n.skc-root .cbox p{margin:0 0 16px;font-size:12.5px;line-height:1.8;opacity:.72}\n.skc-root .cbox code{background:rgba(255,255,255,.08);padding:1px 6px;border-radius:4px;font-size:11.5px}\n.skc-root .crow{display:flex;gap:10px;justify-content:flex-end}\n.skc-root .hud{display:flex;align-items:center;justify-content:center;gap:14px;margin:0 0 8px}\n.skc-root .count{font-size:12px;opacity:.55;letter-spacing:1px}\n.skc-root .dots{display:flex;gap:5px}\n.skc-root .dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.18)}\n.skc-root .dot.on{background:#8b5cf6;box-shadow:0 0 10px #8b5cf6;width:16px;border-radius:3px}\n.skc-root .info{border-top:1px solid rgba(255,255,255,.08);padding-top:12px;display:flex;gap:22px;align-items:flex-start;transition:opacity .3s}\n.skc-root .skc-root.detail-open .info{opacity:0;pointer-events:none}\n.skc-root .info .left{flex:0 0 auto;display:flex;flex-direction:column;gap:4px;min-width:210px}\n.skc-root .info .nm{font-size:15px;font-weight:700}\n.skc-root .info .en{font-size:10.5px;opacity:.42;font-family:Segoe UI,sans-serif}\n.skc-root .info .desc{font-size:12.5px;line-height:1.75;opacity:.72;flex:1}\n.skc-root .hint{text-align:center;font-size:11px;opacity:.32;margin-top:12px;letter-spacing:.5px}\n.skc-root .skc-toast{position:fixed;left:50%;bottom:34px;transform:translate(-50%,20px);z-index:3000;opacity:0;transition:.3s; padding:10px 22px;font-size:12.5px;background:linear-gradient(180deg,rgba(59,130,246,.85),rgba(99,102,241,.75)); clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px);pointer-events:none}\n.skc-root .skc-toast.on{opacity:1;transform:translate(-50%,0)}.skc-root .skchead{display:flex;align-items:center;gap:10px;padding:2px 2px 10px}\n.skc-root .skctitle{font-size:16px;font-weight:800;letter-spacing:2px;background:linear-gradient(90deg,#8fd0ff,#c9a2ff);-webkit-background-clip:text;background-clip:text;color:transparent}\n.skc-root .skcmark{flex:1;font-size:11.5px;opacity:.5}\n.skc-root .skchead .gbtn{padding:7px 16px;font-size:12px}\n.skc-root .gbtn.ro{opacity:.45;filter:grayscale(1);cursor:not-allowed}\n.skc-root .rohint{margin:6px 0 0;font-size:11.5px;opacity:.55}\n.skc-root .newcard{position:absolute;left:50%;top:46%;width:240px;height:360px;transform-origin:50% 50%;transition:transform .6s cubic-bezier(.22,1,.36,1),opacity .45s ease;will-change:transform,opacity;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;border:2px dashed rgba(140,170,220,.45);border-radius:16px;background:radial-gradient(circle at 50% 42%,rgba(90,130,200,.16),rgba(10,14,22,.4));box-shadow:inset 0 0 40px rgba(90,130,200,.12)}\n.skc-root .newcard:hover{border-color:rgba(170,200,255,.8);box-shadow:inset 0 0 50px rgba(120,170,255,.22),0 0 24px rgba(90,140,255,.25)}\n.skc-root .newcard .dash{font-size:52px;line-height:1;opacity:.55;color:#bcd6ff}\n.skc-root .newcard .dashlbl{font-size:12px;letter-spacing:2px;opacity:.6;color:#cfe0ff}\n.skc-root .cbox.create{border-color:rgba(99,140,255,.5);box-shadow:0 0 40px rgba(80,120,255,.22);width:470px;max-height:min(84vh,560px);overflow-y:auto;text-align:left}\n.skc-root .cbox.create h3{color:#9fc4ff}\n.skc-root .cbox .fl{display:block;margin:0 0 10px;font-size:11.5px;letter-spacing:.5px;opacity:.72}\n.skc-root .cbox .fin{display:block;width:100%;margin-top:5px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.16);color:#e6edf7;font-family:inherit;font-size:12.5px;padding:7px 10px;border-radius:6px;outline:none}\n.skc-root .cbox .fin:focus{border-color:rgba(120,170,255,.7);box-shadow:0 0 14px rgba(90,140,255,.25)}\n.skc-root .cbox .fin.ta{height:70px;resize:vertical;line-height:1.7}\n.skc-root .cbox .cerr{min-height:16px;font-size:11.5px;color:#ff8a9c;line-height:1.6;margin:2px 0 8px}\n.skc-root{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden}";

/**
 * 技能正文区（入口行 / 整屏阅读覆盖层 / 自动增高的正文编辑框）的样式。
 *
 * 追加在主样式之后：用同等特异性的后置规则把详情面板改成可滚动的纵向 flex 容器，
 * 这样正文很长时由面板自身滚动，正文框不需要嵌套滚动条。
 */
const SKC_CSS_BODY = ".skc-root .panel{display:flex;flex-direction:column;overflow-y:auto}\n.skc-root .skc-inline{display:flex;flex-direction:column;flex:0 0 auto;margin-top:10px;border-top:1px solid rgba(255,255,255,.08);padding-top:10px}\n.skc-root .brow{display:flex;align-items:center;gap:9px}\n.skc-root .brow .bt{font-size:11.5px;font-weight:700;letter-spacing:1.2px;opacity:.62}\n.skc-root .brow .bmeta{font-size:10.5px;opacity:.36}\n.skc-root .brow .bspace{margin-left:auto}\n.skc-root .skc-body.exp{position:absolute;left:3px;right:0;top:0;bottom:0;z-index:20;display:flex;flex-direction:column;margin:0;padding:18px 22px 18px 26px;border-top:0;background:linear-gradient(135deg,#121826,#0b0f18)}\n.skc-root .bhead{display:flex;align-items:center;gap:9px;margin-bottom:6px;flex:0 0 auto}\n.skc-root .bhead .bt{font-size:11.5px;font-weight:700;letter-spacing:1.2px;opacity:.62}\n.skc-root .bhead .bmeta{font-size:10.5px;opacity:.36}\n.skc-root .bhead .bspace{margin-left:auto}\n.skc-root .btext{flex:1 1 auto;min-height:0;overflow:auto;white-space:pre-wrap;word-break:break-word;font-family:Consolas,\"Segoe UI\",monospace;font-size:12px;line-height:1.75;color:#cdd8e8;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.08);border-radius:5px;padding:9px 12px}\n.skc-root .bta{flex:0 0 auto;min-height:110px;width:100%;resize:none;outline:none;white-space:pre-wrap;overflow:hidden;font-family:Consolas,\"Segoe UI\",monospace;font-size:11.5px;line-height:1.7;color:#e6edf7;background:rgba(0,0,0,.42);border:1px solid rgba(139,92,246,.55);border-radius:5px;padding:9px 12px}\n.skc-root .bhint{font-size:10.5px;opacity:.42;line-height:1.5}\n.skc-root .bbtn{font-family:inherit;font-size:11px;letter-spacing:.6px;padding:5px 13px;border-radius:5px;cursor:pointer;white-space:nowrap;color:#dbe6f6;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16)}\n.skc-root .bbtn:hover{background:rgba(255,255,255,.15)}\n.skc-root .bbtn.p{background:rgba(139,92,246,.28);border-color:rgba(139,92,246,.6)}\n.skc-root .btext::-webkit-scrollbar{width:8px;height:8px}\n.skc-root .btext::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16);border-radius:4px}\n.skc-root .panel::-webkit-scrollbar{width:8px}\n.skc-root .panel::-webkit-scrollbar-track{background:transparent}\n.skc-root .panel::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16);border-radius:4px}\n.skc-root .panel::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.28)}";

/**
 * 稀有度特效与特效开关样式。
 *
 * 单独成常量并追加在主样式之后：特效只依赖 .card3d 的伪元素与 data-rarity/cur/--rc 三个
 * 由脚本写入的标记，关闭开关时靠 SKC_CSS_FX 末尾的 [data-fx=off] 规则整体去掉伪元素。
 */
/**
 * 稀有度特效与特效开关样式。
 *
 * 单独成常量并追加在主样式之后：特效只依赖 .card3d 的伪元素与 data-rarity/cur/--rc 三个
 * 由脚本写入的标记，关闭开关时靠末尾的 [data-fx=off] 规则整体去掉伪元素。
 */
/**
 * 稀有度特效与特效开关样式。
 *
 * 单独成常量并追加在主样式之后：特效只依赖 .card3d 的伪元素与 data-rarity/cur/--rc 三个
 * 由脚本写入的标记，关闭开关时靠末尾的 [data-fx=off] 规则整体去掉伪元素。
 */
/**
 * 稀有度特效与特效开关样式。
 *
 * 单独成常量并追加在主样式之后：画布位置、卡面层级与那圈贴边柔光全靠这里的规则，
 * 开关关闭时末尾两条规则把两块画布整体隐藏。特效本身由 15-fx.js 逐帧绘制，CSS 不参与。
 */
/**
 * 来源筛选行的样式（紧跟分类行，与标签行的 chip 区分开）。
 *
 * 复用 .bar / .tab 的视觉语言，只把尺寸收小一档、选中色换成青蓝色，
 * 让用户一眼看出「分类」与「来源」是两个正交维度。
 * 其它来源（Claude Code / Codex / WorkBuddy…）收进一个下拉按钮，样式见 .srcdd / .ddmenu。
 */
const SKC_CSS_FILTER = ".skc-root .bar.srcs{margin:0 0 10px}\n.skc-root .bar.srcs .lbl{font-size:11px;opacity:.45;letter-spacing:1px;flex:0 0 auto}\n.skc-root .srctabs{display:flex;gap:8px;flex-wrap:wrap;flex:1;min-width:0}\n.skc-root .srctabs .tab{padding:4px 11px;font-size:11.5px}\n.skc-root .srctabs .tab.on{background:linear-gradient(135deg,#0ea5e9,#6366f1)}\n.skc-root .srcdd{position:relative}\n.skc-root .srctabs .tab.ddtog{border-style:dashed}\n.skc-root .srctabs .tab .caret{margin-left:5px;opacity:.55;font-size:9.5px}\n.skc-root .ddmenu{position:absolute;left:0;top:calc(100% + 6px);min-width:150px;padding:4px;z-index:1400;background:#111722;border:1px solid rgba(255,255,255,.14);border-radius:10px;box-shadow:0 14px 34px rgba(0,0,0,.55)}\n.skc-root .dditem{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 10px;border-radius:7px;font-size:11.5px;color:#cfd8e6;cursor:pointer;white-space:nowrap}\n.skc-root .dditem:hover{background:rgba(139,92,246,.2)}\n.skc-root .dditem.on{background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;font-weight:600}\n.skc-root .dditem b{opacity:.55;font-weight:600;font-size:10.5px}\n";
/**
 * 轨道重建期间禁用卡片过渡。
 *
 * 重建会造出全新的 .card3d 节点，浏览器会把「初始 transform → apply() 写入的目标 transform」
 * 当成一次状态变化，于是每张卡都重播一遍入场过渡（实测静默刷新一次触发 127 次过渡），
 * 表现为卡片反复跳动。重建时给 .deck 加上 .skc-rebind、两帧后移除，即可只保留首次入场动画。
 */
const SKC_CSS_REBIND = ".skc-root .deck.skc-rebind .card3d,.skc-root .deck.skc-rebind .newcard{transition:none!important}\n";
/**
 * 编辑态控件与「固定操作栏」的样式。
 *
 * `.acts`（修改 / 删除 / 关闭，编辑态是保存 / 取消）钉在详情面板底部：面板本身是滚动容器，
 * 正文展开或正文框自动增高后，按钮不再被推到内容末尾，用户不用滚到底就能关掉面板。
 * `bottom:-18px` 抵消 `.panel` 的下内边距，让按钮栏真正贴住面板底边；渐变负责遮住
 * 从下面滚过去的正文。z-index 低于正文阅读覆盖层（20），阅读态仍由覆盖层自己的「收起」按钮负责。
 */
const SKC_CSS_ACTS = ".skc-root .tin.cnin{width:190px}\n.skc-root .panel .acts{position:sticky;bottom:-18px;z-index:15;margin-top:16px;padding:12px 0 18px;background:linear-gradient(180deg,rgba(11,15,24,0) 0,rgba(11,15,24,.94) 30%,#0b0f18 100%)}\n";
/**
 * 面板竖向自适应：让舞台吃掉窗口剩下的高度。
 *
 * 以前 `.stage` 固定 500px，面板总高度与窗口无关 —— 窗口一缩小，详情面板底部连同
 * 「修改 / 删除 / 关闭」就被挤出可视区，只能先滚动整个面板外层才点得到。
 * 这里改成三层：根容器纵向 flex（顶栏各行保持自然高度，不许被压缩）、`.deck` 吃掉剩余高度、
 * `.stage` 再撑满 `.deck`。舞台保留 300px 的下限，窗口比它还矮时才由根容器滚动 ——
 * 卡牌会随舞台等比缩小（见 fitScale），所以下限可以取得比一张卡的高度还小。
 *
 * 详情打开时底部信息栏（`.info`）本来就是隐藏的，这里改成 display:none，把它的高度也让给舞台。
 */
const SKC_CSS_FIT = ".skc-root{display:flex;flex-direction:column}\n.skc-root>*{flex:0 0 auto}\n.skc-root .deck{flex:1 1 auto;min-height:300px;display:flex;flex-direction:column}\n.skc-root .stage{flex:1 1 auto;height:auto;min-height:0}\n.skc-root.detail-open .info{display:none}\n";
const SKC_CSS_FX = "/* ── 稀有度特效与特效开关 ───────────────────────────────\n   特效由 15-fx.js 的 Canvas 引擎绘制：下层画布画卡外（柔光/光柱/光轮/光粒/冲击波），\n   上层画布裁剪在卡面圆角内（全息/高光/星芒）。这里只负责三件事：两块画布的位置与\n   层级、贴着卡框的一圈柔光（.fxrim）、以及特效开关关闭时的整体隐藏。\n   画布 640x800 比卡面 240x360 大一圈，光必须在画布内部淡到全透明，否则被画布边界\n   切出一条直边（曾被当成「卡片外面套了个长方形」）。 */\n.skc-root .card3d{isolation:isolate}\n/* 卡面（.c 包裹层）夹在两层画布之间：下层画布 z-index:0，卡面 1，上层画布 2 */\n.skc-root .card3d .c{position:relative;z-index:1}\n.skc-root .card3d .fx,.skc-root .card3d canvas.fxup{position:absolute;left:-200px;top:-220px;width:640px;height:800px;pointer-events:none}\n.skc-root .card3d .fx{z-index:0;opacity:0;transition:opacity .45s ease}\n.skc-root .card3d canvas.fxup{z-index:2;opacity:0;transition:opacity .45s ease}\n.skc-root .card3d.fx-on .fx,.skc-root .card3d.fx-on canvas.fxup{opacity:1}\n.skc-root .card3d .fx canvas{position:absolute;left:0;top:0;width:640px;height:800px;display:block}\n/* 贴边柔光：只在外侧着色、跟随圆角，绝不铺到卡面上 */\n.skc-root .card3d .fx .fxrim{position:absolute;left:200px;top:220px;width:240px;height:360px;border-radius:16px;box-shadow:0 0 12px 0 var(--fx),0 0 0 1px rgba(255,255,255,.10)}\n.skc-root .card3d .fx .fxrim.b{box-shadow:0 0 15px 2px var(--fx);opacity:.38;animation:fx-breathe 3.4s ease-in-out infinite}\n@keyframes fx-breathe{0%,100%{opacity:.26}50%{opacity:.78}}\n.skc-root .card3d .fx[data-r=\"N\"] .fxrim{box-shadow:0 0 10px 0 var(--fx),0 0 0 1px rgba(255,255,255,.10)}\n.skc-root .card3d .fx[data-r=\"N\"] .fxrim.b{animation:none;opacity:.20}\n.skc-root .card3d .fx[data-r=\"R\"] .fxrim.b{animation-duration:3.2s}\n.skc-root .card3d .fx[data-r=\"SR\"] .fxrim{box-shadow:0 0 14px 1px #e2c7ff,0 0 0 1px rgba(255,255,255,.12)}\n.skc-root .card3d .fx[data-r=\"SR\"] .fxrim.b{box-shadow:0 0 19px 3px var(--fx);animation-duration:2.8s}\n.skc-root .card3d .fx[data-r=\"SSR\"] .fxrim{box-shadow:0 0 16px 2px #ffe6a8,0 0 0 1px rgba(255,255,255,.14)}\n.skc-root .card3d .fx[data-r=\"SSR\"] .fxrim.b{box-shadow:0 0 22px 4px var(--fx);animation-duration:2.4s}\n.skc-root .card3d .fx[data-r=\"UR\"] .fxrim{box-shadow:0 0 18px 3px #ffd06a,0 0 0 1px rgba(255,255,255,.16)}\n.skc-root .card3d .fx[data-r=\"UR\"] .fxrim.b{box-shadow:0 0 25px 5px var(--fx);animation-duration:1.9s}\n/* 特效开关（面板设置行） */\n.skc-root .setting input[type=checkbox]{width:15px;height:15px;accent-color:#8b5cf6;cursor:pointer;margin:0}\n/* 关闭开关：整体隐藏（引擎同时会停帧，这里只是兜底） */\n.skc-root[data-fx=off] .card3d .fx,.skc-root[data-fx=off] .card3d canvas.fxup{opacity:0!important;animation:none!important}";

    /* ── 40-panel.js ─────────────────────────────── */
/**
 * 技能卡库面板控制器：构建面板 DOM、持有全部界面状态、对接 host 路由。
 *
 * 采用「控制器 + 一次性 DOM」结构 —— 主面板被切走时 React 组件会卸载，
 * 但控制器与 DOM 由外层持有，切回来只是把同一个 root 重新挂上，
 * 因此滚动位置、当前卡、分类与来源与标签筛选都不会丢。
 *
 * @param api 与 host 通信的接口对象（由 50-apply.js 注入）
 * @return 控制器对象（含 root / mount / unmount / refresh / dispose）
 */
function createSkillCardController(api) {
const PANEL_HTML = '<div class="skchead"><span class="skctitle">技能卡库</span><span class="skcmark" id="mark"></span>' + '<button class="gbtn primary" id="newbtn" data-act="new">＋ 新建技能</button>' + '<button class="gbtn" id="refreshbtn" data-act="refresh">↻ 刷新</button></div>' + '<div class="bar" id="tabs"></div>' + '<div class="bar srcs"><span class="lbl">来源</span><div class="srctabs" id="srcs"></div></div>' + '<div class="tagbar"><span class="lbl">标签</span><div class="skc-taglist" id="taglist"></div><input id="search" class="search" placeholder="搜索技能名 / 描述 / 标签"></div>' + '<div class="modes" id="modes">' + '<div class="mbtn on" data-mode="fan">扇形轮播</div><div class="mbtn" data-mode="ring">环形旋转</div>' + '<div class="mbtn" data-mode="smooth">平滑放大</div><div class="mbtn" data-mode="deck">叠牌抽卡</div></div>' + '<div class="setting"><span class="lbl">滚轮灵敏度</span><input id="sens" type="range" min="1" max="10" step="1" value="6">' + '<span class="val" id="sensval"></span><span class="tip">越高，一次滚轮跨过的卡片越多</span></div><div class="setting"><span class="lbl">卡牌特效</span><input id="fx" type="checkbox"><span class="val" id="fxval">已开启</span><span class="tip">关掉后只保留静态光晕，卡顿或远程桌面时可关</span></div>' + '<div class="deck" id="deck"><div class="stage" id="stage"><div class="track" id="track"></div>' + '</div><div class="dpanel" id="dpanel"></div><div class="confirm" id="confirm"></div></div>' + '<div class="hud"><span class="count" id="count"></span><div class="dots" id="dots"></div></div>' + '<div class="info" id="info"></div>' + '<div class="skc-toast" id="toast"></div>';
  const root = document.createElement("div");
  root.className = "skc-root";
  root.innerHTML = PANEL_HTML;
  const q = function (s) { return root.querySelector(s); };
  const qall = function (s) { return root.querySelectorAll(s); };
  const styleEl = document.createElement("style");
  styleEl.setAttribute("data-plugin-css", "dsh-skill-card");
  styleEl.textContent = SKC_CSS+SKC_CSS_BODY+SKC_CSS_FX+SKC_CSS_FILTER+SKC_CSS_REBIND+SKC_CSS_ACTS+SKC_CSS_FIT;
  root.appendChild(styleEl);
  var CATS=[["全部",null],["办公","办公"],["开发","开发"],["AI 智能体","AI 智能体"],["分析","分析"],["文档","文档"],["流程","流程"]];
  /** 来源筛选的固定顺序（取值即 host 下发的 levelLabel）；数据里出现的新来源追加在后面。 */
  var SRC_ORDER=["项目技能","公共技能","自定义目录","系统内置","运行时"];
  var CAPS=["能力","效率","通用","稳定","命中"];
  var RARC={N:"#8b95a5",R:"#4a9eff",SR:"#b06bff",SSR:"#ffb020",UR:"#ff4d6d"};
  var RARS=["N","R","SR","SSR","UR"];
  var state={index:0,mode:"fan",cat:null,src:"公共技能",project:null,dir:null,ddOpen:false,projOpen:false,dirOpen:false,list:[],sens:6,detail:-1,editing:false,confirm:false,creating:false,tags:[],query:"",addingTag:false,pendingTag:"",bodyFull:false};
  var WHEEL_BASE=600,wheelAcc=0;

  /** 环形模式使用的透视距离（px）；必须与 CSS 里 .stage 的 perspective 值保持一致。 */
  var RING_PERSPECTIVE=2200;
  /** 环形模式卡片沿视线方向的位移（px），即环的半径；数值越小卡片越靠拢、环越紧凑。 */
  var RING_DEPTH=420;
  /**
   * 环形模式的透视补偿系数。
   *
   * 卡片经 translateZ(RING_DEPTH) 后会被透视放大 RING_PERSPECTIVE/(RING_PERSPECTIVE-RING_DEPTH)≈1.24 倍，
   * 不补偿时居中卡渲染宽约 297px，比扇形与叠牌模式的 240px 更大。
   * 在变换末尾乘上本系数即可抵消这层放大，使居中卡回到 240px，与其它三种模式保持一致；
   * 平移与旋转不受影响，环的纵深与前后遮挡仍然保留。
   */
  var RING_K=Math.round((RING_PERSPECTIVE-RING_DEPTH)/RING_PERSPECTIVE*10000)/10000;
  /** 虚线「＋ 新建技能」卡的 HTML；因为轨道每次重建，节点不能缓存，必须随列表一起写入。 */
  var NEW_CARD_HTML='<div class="newcard" id="newcard" data-act="new"><div class="dash">＋</div><div class="dashlbl">新建技能</div></div>';
  var cards=[];
/** 全量技能列表（未经筛选）；分类计数、标签 tally 都基于它。 */
var allSkills=[];
/** 正在拉取列表时为 true，避免重复请求。 */
var loading=false;
/** artPending 轮询定时器 id。 */
var pollTimer=0;

/* ── host 接口层 ─────────────────────────────────────── */
/** 列表元信息：pending（还有几张卡面在生成）、createRoots（新建可选根）等。 */
state.meta={pending:0,complete:true,storePath:"",createRoots:[]};
/**
 * 调用 host 侧路由并返回 JSON。
 *
 * 具体的 fetch 由 50-apply.js 注入（它负责拼文档相对 URL 与 JSON 头）；
 * 失败时抛出带 host 错误文案的 Error，交给各个调用点提示用户。
 *
 * @param path 路由后缀（如 list / update）
 * @param body POST 请求体；不传表示 GET
 * @return host 返回的 JSON 对象
 */
function apiCall(path,body){
 return api.request(path,body);
}
/**
 * 把 host 返回的技能对象整理成界面使用的结构。
 *
 * 界面渲染沿用样张的字段名（cat / pal / src），因此在原始字段之外补三个别名，
 * 这样卡面渲染与详情渲染都能直接工作；保存时再把 cat 映射回 category。
 *
 * @param src host 返回的单条技能数据
 * @return 带界面别名的技能对象
 */
function normalizeSkill(src){
 var rec={};
 for(var k in src)if(Object.prototype.hasOwnProperty.call(src,k))rec[k]=src[k];
 rec.cat=src.category||"未分类";
 rec.pal=(src.palette&&src.palette.length===4)?src.palette:["#111722","#223046","#5b8cff","#bcd6ff"];
 rec.id=src.id||src.name;
 rec.src=src.levelLabel||src.level||"";
 // 卡片/详情上显示的项目名：项目技能显示所属项目，其余显示来源分组名
 rec.srcLabel=src.project||src.levelLabel||src.level||"";
 rec.tags=(src.tags||[]).slice();
 rec.project=src.project||"";
 var st=(src.stats||[]).slice(0,5);
 while(st.length<5)st.push(0);
 rec.stats=st;
 rec.description=src.description||"";
 return rec;
}
/** 上一次渲染用的载荷指纹；静默轮询拿到相同指纹时不再重建轨道（否则卡片会重播入场动画）。 */
var lastPayloadSig="";
/**
 * 计算一份载荷里「影响界面」的部分的指纹。
 *
 * 只取真正会画到界面上的字段：多了/少了一张卡、卡面配方变了、分类或来源变了、
 * 权限变了都要重建；`artTries` 这类内部计数不参与，避免无谓重建。
 *
 * @param items host 下发的技能数组
 * @return 指纹字符串
 */
function payloadSignature(items){
 var parts=[],i,r;
 for(i=0;i<items.length;i++){
  r=items[i];
  parts.push([r.name,r.cn,r.title,r.category,r.rarity,r.stars,(r.stats||[]).join("."),(r.tags||[]).join("."),
   r.motif,r.glyph,(r.palette||[]).join("."),r.art,r.description,r.levelLabel,
   r.canWrite?1:0,r.canDelete?1:0,r.deleteFiles||0,r.readonlyReason||""].join("~"));
 }
 return parts.join("|");
}
/**
 * 用 host 返回的 list 结构整批替换内存里的技能，并刷新顶栏状态文案。
 *
 * @param payload list 路由的响应体
 */
function applyPayload(payload){
 allSkills=(payload.skills||[]).map(normalizeSkill);
 state.meta={pending:payload.pending||0,complete:payload.complete!==false,
  storePath:payload.storePath||"",createRoots:payload.createRoots||[]};
 buildTabs();
 buildSrcs();
 if(state.detail>=0)refreshKeepingDetail();else render();
 syncMark();
}
/**
 * 刷新顶栏状态文案（卡面生成进度 / 技能总数）。
 */
function syncMark(){
 var mark=q("#mark");
 if(mark)mark.textContent=state.meta.pending?("卡面生成中 "+state.meta.pending+" 张"):(allSkills.length+" 个技能");
}
/**
 * 按 host 报告的 pending 数安排下一次静默刷新。
 *
 * @param pending 还有多少张卡面在后台生成；为 0 时不再轮询
 */
function schedulePendingPoll(pending){
 if(pollTimer){clearTimeout(pollTimer);pollTimer=0;}
 if(!pending)return;
 pollTimer=setTimeout(function(){pollTimer=0;if(root.isConnected)refresh(true);},1500);
}
/**
 * 拉取技能列表。
 *
 * @param silent 静默模式：不弹「已刷新」提示（轮询用）
 */
function refresh(silent){
 if(loading)return;
 loading=true;
 apiCall("list").then(function(payload){
  loading=false;
  var sig=payloadSignature(payload.skills||[]);
  // 静默轮询拿到的数据和上次一模一样：只更新计数与轮询，不重建轨道 ——
  // 每次重建都会让 64 张卡重播一遍入场过渡，看起来就是「反复跳动」。
  if(silent&&sig===lastPayloadSig){
   state.meta.pending=payload.pending||0;
   syncMark();
   schedulePendingPoll(payload.pending);
   return;
  }
  lastPayloadSig=sig;
  applyPayload(payload);
  if(!silent)toast("已刷新："+allSkills.length+" 个技能"+(payload.pending?("，还有 "+payload.pending+" 张卡面在生成中"):""));
  schedulePendingPoll(payload.pending);
 }).catch(function(err){
  loading=false;
  toast("读取技能列表失败："+((err&&err.message)||err));
 });
}
/**
 * 提交卡片属性改动（分类/稀有度/星数/五维/标签/配色）。
 *
 * 失败时回滚成 host 的真实状态，避免界面与磁盘不一致。
 *
 * @param patch 要提交的字段（category/rarity/stars/stats/tags/cn/title/palette）
 * @param okMsg 成功后的轻提示文案；不传则不提示
 * @return Promise
 */
function pushUpdate(patch,okMsg){
 var r=state.list[state.index];
 if(!r)return Promise.resolve(null);
 return apiCall("update",Object.assign({id:r.id,name:r.name},patch)).then(function(res){
  if(okMsg)toast(okMsg);
  return res;
 }).catch(function(err){
  toast("保存失败："+((err&&err.message)||err));
  refresh(true);
  return null;
 });
}
/**
 * 提交描述改动（host 会写回 SKILL.md 的 frontmatter，只替换 description 那一处）。
 *
 * @param description 新的描述文本
 * @return Promise
 */
function pushDescription(description){
 var r=state.list[state.index];
 if(!r)return Promise.resolve(null);
 return apiCall("set-description",{id:r.id,name:r.name,description:description}).then(function(){
  r.description=description;
  return true;
 }).catch(function(err){
  toast("描述保存失败："+((err&&err.message)||err));
  return false;
 });
}
/**
 * 取当前卡片可用于正文区的内容。
 *
 * host 只在技能文件可定位时才下发 body 字段；没有该字段表示正文不可读。
 *
 * @param r 技能卡数据
 * @return 正文字符串；不可读时返回 null
 */
function bodyTextOf(r){
 return (r&&typeof r.body==="string")?r.body:null;
}
/**
 * 让正文文本框随内容自动增高，滚动统一交给详情面板，避免嵌套滚动条。
 *
 * @param ta 正文文本框元素
 */
function autosizeBody(ta){
 ta.style.height="auto";
 ta.style.height=(ta.scrollHeight+4)+"px";
}
/**
 * 渲染「技能正文」入口行；修改态下可写技能改为直接显示正文编辑框。
 *
 * 未展开时只给一行入口（正文完全不占位），点「展开正文」才在覆盖层里阅读全文；
 * 只读技能（宿主内置包 / 插件包 / app.asar）的正文只读，编辑态只提示原因。
 *
 * @param r 技能卡数据
 * @param ed 当前是否处于修改态
 * @return 入口行或编辑框 HTML；整屏阅读态返回空串
 */
function bodyInline(r,ed){
 if(state.bodyFull)return "";
 var text=bodyTextOf(r);
 var ro=r.canWrite===false||text===null;
 var meta=(text===null?"不可读":(ro?"只读 · ":"")+text.length+" 字符");
 if(ed&&!ro){
  return '<div class="skc-inline"><div class="bhead"><span class="bt">技能正文</span><span class="bmeta">编辑中 · '+text.length+" 字符</span>"
   +'<span class="bspace"></span><span class="bhint" style="margin:0">随面板滚动条下滑，保存修改时一并提交</span></div>'
   +'<textarea class="bta" id="f-body" spellcheck="false">'+esc(text)+"</textarea></div>";
 }
 return '<div class="skc-inline"><div class="brow"><span class="bt">技能正文</span><span class="bmeta">'+meta+"</span>"
  +'<span class="bspace"></span>'+(text===null?"":'<button class="bbtn p" data-act="bodyfull">⤢ 展开正文</button>')+"</div>"
  +(ed&&text!==null?'<div class="bhint" style="margin-top:7px">'+esc("🔒 "+((r.readonlyReason)||"该技能不可修改。"))+"</div>":"")
  +"</div>";
}
/**
 * 渲染整屏阅读正文的覆盖层，只有点「展开正文」后才出现并盖住整个详情面板。
 *
 * @param r 技能卡数据
 * @return 覆盖层 HTML；未展开、正文不可读或正在编辑可写技能时返回空串
 */
function bodyOverlay(r){
 if(!state.bodyFull)return "";
 var text=bodyTextOf(r);
 if(text===null)return "";
 if(state.editing&&r.canWrite!==false)return "";
 var ro=r.canWrite===false;
 return '<div class="skc-body exp"><div class="bhead"><span class="bt">技能正文</span><span class="bmeta">'+(ro?"只读 · ":"")+text.length+" 字符</span>"
  +'<span class="bspace"></span><button class="bbtn" data-act="bodyfull">⤡ 收起</button></div>'
  +'<div class="btext">'+esc(text)+"</div>"
  +(ro?'<div class="bhint" style="margin-top:7px">'+esc("🔒 "+((r.readonlyReason)||"该技能不可修改。"))+"</div>":"")+"</div>";
}
/**
 * 提交技能正文改动（host 只改写 SKILL.md 里 frontmatter 之后的部分）。
 *
 * @param id 技能身份（真实路径）
 * @param name 技能名
 * @param body 新的正文文本
 * @return Promise
 */
function pushBody(id,name,body){
 return apiCall("set-body",{id:id,name:name,body:body}).catch(function(err){
  toast("正文保存失败："+((err&&err.message)||err));
  return false;
 });
}
  var body=root;
  var deck=q("#deck"),track=q("#track"),stage=q("#stage"),
  dpanel=q("#dpanel"),confirmEl=q("#confirm"),
  countEl=q("#count"),dotsEl=q("#dots"),infoEl=q("#info"),
  toastEl=q("#toast");
  var newCardEl=null;
  var draft=null;

  /**
   * 转义会被拼进 HTML 的文本（标签是用户自由输入，必须转义）。
   *
   * @param x 原始文本
   * @return 可安全插入 HTML 文本节点与双引号属性的字符串
   */
  function esc(x){return String(x).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  function passCat(r){return state.cat===null||r.cat===state.cat;}
  /**
   * 判断技能卡是否命中当前选中的来源。
   *
   * @param r 技能卡数据
   * @return 未选来源、或该卡的来源文案与所选一致时返回 true
   */
  function passSrc(r){return state.src===null||r.src===state.src;}
  /**
   * 判断技能卡是否命中当前选中的项目（只对「项目技能」生效）。
   *
   * @param r 技能卡数据
   * @return 非项目技能来源、未选项目、或该卡所属项目与所选一致时返回 true
   */
  function passProject(r){return state.src!=="项目技能"||state.project===null||r.project===state.project;}
  /**
   * 判断技能卡是否命中当前选中的技能目录（只在「项目技能 + 选中具体项目」时生效）。
   *
   * @param r 技能卡数据
   * @return 未选目录、或该卡的目录与所选一致时返回 true
   */
  function passDir(r){
   if(state.src!=="项目技能"||state.project===null||state.dir===null)return true;
   return r.dir===state.dir;
  }
  /**
   * 判断技能卡是否命中搜索框关键词。
   *
   * @param r 技能卡数据
   * @return 关键词为空或命中技能名/中文名/分类/描述/标签时返回 true
   */
  function passQuery(r){
   var q=state.query.trim().toLowerCase();
   if(!q)return true;
   return (r.name+" "+r.cn+" "+r.cat+" "+(r.description||"")+" "+r.tags.join(" ")).toLowerCase().indexOf(q)>=0;
  }
  /**
   * 四重筛选总入口：分类、来源、标签（多选取交集）、搜索关键词必须同时通过。
   *
   * @param r 技能卡数据
   * @return 该卡是否应出现在当前列表中
   */
  function passes(r){
   if(!passCat(r)||!passSrc(r)||!passProject(r)||!passDir(r)||!passQuery(r))return false;
   for(var i=0;i<state.tags.length;i++)if(r.tags.indexOf(state.tags[i])<0)return false;
   return true;
  }
  /**
   * 渲染顶部的标签筛选行。计数只统计当前「分类 + 来源 + 搜索」下的结果，
   * 这样点标签前就能看到还剩几张卡，不会出现计数撒谎的情况。
   */
  function buildTagRow(){
   var base=allSkills.filter(function(r){return passCat(r)&&passSrc(r)&&passProject(r)&&passDir(r)&&passQuery(r);});
   var tally={},order=[],has=Object.prototype.hasOwnProperty;
   for(var i=0;i<base.length;i++){var ts=base[i].tags;
    for(var j=0;j<ts.length;j++){if(!has.call(tally,ts[j])){tally[ts[j]]=0;order.push(ts[j]);}tally[ts[j]]++;}}
   for(var s=0;s<state.tags.length;s++)if(!has.call(tally,state.tags[s])){tally[state.tags[s]]=0;order.push(state.tags[s]);}
   order.sort(function(a,b){return (tally[b]-tally[a])||(a<b?-1:1);});
   var hh="";
   for(var k=0;k<order.length;k++){
    if(tally[order[k]]===0&&state.tags.indexOf(order[k])<0)continue;
    var on=state.tags.indexOf(order[k])>=0;
    hh+='<span class="tchip'+(on?" on":"")+'" data-tag="'+esc(order[k])+'">'+esc(order[k])+'<b>'+tally[order[k]]+'</b></span>';
   }
   if(!hh)hh='<span style="font-size:11.5px;opacity:.32">还没有标签 —— 打开任意卡片，点「＋ 标签」添加</span>';
   if(state.tags.length)hh+='<span class="tchip clear" data-tag="__CLEAR__">✕ 清除（'+state.tags.length+'）</span>';
   q("#taglist").innerHTML=hh;
  }
  /**
   * 渲染卡片详情里的标签行。
   *
   * @param r 当前技能卡数据
   * @param ed 是否编辑态；编辑态下每个标签可点 × 删除
   * @return 标签行的 HTML 片段
   */
  function tagChips(r,ed){
   if(!r.tags.length)return '<span class="tag empty">暂无标签</span>';
   var hh="";
   for(var i=0;i<r.tags.length;i++){
    hh+='<span class="tag'+(ed?" rm":"")+'"'+(ed?' data-rm="'+esc(r.tags[i])+'"':"")+'>'+esc(r.tags[i])+(ed?"<i>×</i>":"")+'</span>';
   }
   return hh;
  }
  /**
   * 按状态插入 / 移除「待提交标签」输入框。
   *
   * 标签输入是编辑态里唯一需要临时多出来的控件，它不能靠整块 renderDetail 来显示：
   * 那会把用户已经改好但还没保存的中文名 / 五维 / 描述一起重置掉。
   */
  function ensureTagInput(){
   var wrap=q("#dpanel .tagwrap .tags");
   if(!wrap)return;
   var cur=q("#f-newtag");
   if(state.addingTag){
    if(cur)return;
    var el=document.createElement("input");
    el.className="tin newtag";el.id="f-newtag";el.maxLength=24;
    el.placeholder="输入后回车或点保存";el.value=state.pendingTag;
    wrap.appendChild(el);
    try{el.focus();}catch(e){/* 无法聚焦时用户仍可手动点 */}
   }else if(cur&&cur.parentNode){
    cur.parentNode.removeChild(cur);
   }
  }
  /**
   * 只重画详情里的标签 chips，不动其它输入框。
   *
   * 增删标签都走这里，避免编辑态里一处标签操作把整张表单重置。
   */
  function renderTagChipsOnly(){
   var wrap=q("#dpanel .tagwrap .tags");
   var r=state.list[state.index];
   if(!wrap||!r)return;
   wrap.innerHTML=tagChips(r,state.editing);
   ensureTagInput();
  }
  function buildTabs(){
   var h="";
   for(var i=0;i<CATS.length;i++){
    var c=CATS[i],n=(c[1]===null)?allSkills.length:allSkills.filter(function(r){return r.cat===c[1];}).length;
    h+='<div class="tab'+(state.cat===c[1]?" on":"")+'" data-cat="'+i+'">'+c[0]+'<b>'+n+'</b></div>';
   }
   q("#tabs").innerHTML=h;
  }
  /**
   * 渲染来源筛选行。
   *
   * 固定顺序的来源永远在列（计数为 0 也保留）；「项目技能」不是一个普通 tab，而是一个下拉：
   * 默认文案就是「项目技能」（等于全部项目），选中某个项目后文案换成项目名 —— 否则
   * 「项目技能」与「项目：全部」会表达同一件事，重复。
   * 其余来源（Claude Code / Codex / WorkBuddy 这类随本机安装的其它 Agent 变化的来源）
   * 同样收进右侧「其它来源」下拉，不各占一个按钮。
   */
  function buildSrcs(){
   var tally={},has=Object.prototype.hasOwnProperty,i;
   for(i=0;i<allSkills.length;i++){
    var s=allSkills[i].src||"";
    if(s==="")continue;
    if(!has.call(tally,s))tally[s]=0;
    tally[s]+=1;
   }
   var extras=[];
   for(i=0;i<allSkills.length;i++){
    var k=allSkills[i].src||"";
    if(k!==""&&SRC_ORDER.indexOf(k)<0&&extras.indexOf(k)<0)extras.push(k);
   }
   var projTally={},projOrder=[],projTotal=0;
   for(i=0;i<allSkills.length;i++){
    if((allSkills[i].src||"")!=="项目技能")continue;
    projTotal+=1;
    var pj=allSkills[i].project||"";
    if(pj==="")continue;
    if(!has.call(projTally,pj)){projTally[pj]=0;projOrder.push(pj);}
    projTally[pj]+=1;
   }
   projOrder.sort(function(a,b){return (projTally[b]-projTally[a])||(a<b?-1:1);});
   var curProj=state.project||"";
   var hh='<div class="tab'+(state.src===null?" on":"")+'" data-src="__ALL__">全部<b>'+allSkills.length+'</b></div>';
   for(i=0;i<SRC_ORDER.length;i++){
    var lbl=SRC_ORDER[i];
    if(lbl==="项目技能"&&projOrder.length){
     var projOn=state.src==="项目技能";
     var projLabel=(projOn&&curProj!=="")?curProj:"项目技能";
     var projCount=(projOn&&curProj!=="")?(projTally[curProj]||0):projTotal;
     hh+='<div class="srcdd"><div class="tab ddtog'+(projOn?" on":"")+'" data-act="projdd">'+esc(projLabel)+'<b>'+projCount+'</b><span class="caret">▾</span></div>';
     if(state.projOpen){
      hh+='<div class="ddmenu" id="projmenu">';
      hh+='<div class="dditem'+(projOn&&curProj===""?" on":"")+'" data-proj="__ALL__">全部项目<b>'+projTotal+'</b></div>';
      for(var pi=0;pi<projOrder.length;pi++){
       var pname=projOrder[pi];
       hh+='<div class="dditem'+(projOn&&curProj===pname?" on":"")+'" data-proj="'+esc(pname)+'">'+esc(pname)+'<b>'+projTally[pname]+'</b></div>';
      }
      hh+='</div>';
     }
     hh+='</div>';
     // 目录筛选：选中具体项目、且该项目有多个 skills 目录时才出现（默认「全部」）
     if(projOn&&curProj!==""){
      var dirTally={},dirOrder=[],dirTotal=0;
      for(var di=0;di<allSkills.length;di++){
       var dr=allSkills[di];
       if((dr.src||"")!=="项目技能"||dr.project!==curProj)continue;
       var dn=dr.dir||"";
       if(dn==="")continue;
       dirTotal+=1;
       if(!has.call(dirTally,dn)){dirTally[dn]=0;dirOrder.push(dn);}
       dirTally[dn]+=1;
      }
      dirOrder.sort(function(a,b){return (dirTally[b]-dirTally[a])||(a<b?-1:1);});
      if(dirOrder.length>1){
       var curDir=state.dir||"";
       var dirCount=curDir!==""?(dirTally[curDir]||0):dirTotal;
       hh+='<div class="srcdd"><div class="tab ddtog'+(curDir!==""?" on":"")+'" data-act="dirdd">目录：'+esc(curDir!==""?curDir:"全部")+'<b>'+dirCount+'</b><span class="caret">▾</span></div>';
       if(state.dirOpen){
        hh+='<div class="ddmenu" id="dirmenu">';
        hh+='<div class="dditem'+(curDir===""?" on":"")+'" data-dir="__ALL__">全部目录<b>'+dirTotal+'</b></div>';
        for(var dj=0;dj<dirOrder.length;dj++){
         var dname=dirOrder[dj];
         hh+='<div class="dditem'+(curDir===dname?" on":"")+'" data-dir="'+esc(dname)+'">'+esc(dname)+'<b>'+dirTally[dname]+'</b></div>';
        }
        hh+='</div>';
       }
       hh+='</div>';
      }
     }
     continue;
    }
    hh+='<div class="tab'+(state.src===lbl?" on":"")+'" data-src="'+esc(lbl)+'">'+esc(lbl)+'<b>'+(tally[lbl]||0)+'</b></div>';
   }
   if(extras.length){
    var picked=(state.src!==null&&extras.indexOf(state.src)>=0)?state.src:"";
    hh+='<div class="srcdd">'
     +'<div class="tab ddtog'+(picked!==""?" on":"")+'" data-act="srcdd">'+esc(picked!==""?picked:"其它来源")+'<span class="caret">▾</span></div>';
    if(state.ddOpen){
     hh+='<div class="ddmenu" id="ddmenu">';
     for(i=0;i<extras.length;i++){
      var e=extras[i];
      hh+='<div class="dditem'+(state.src===e?" on":"")+'" data-src="'+esc(e)+'">'+esc(e)+'<b>'+(tally[e]||0)+'</b></div>';
     }
     hh+='</div>';
    }
    hh+='</div>';
   }
   q("#srcs").innerHTML=hh;
  }
  function showInfo(){
   var r=state.list[state.index];if(!r)return;
   var rc=RARC[r.rarity],st="";
   for(var i=0;i<5;i++)st+=(i<r.stars?"★":"☆");
   var sp="";
   for(var j=0;j<5;j++)sp+='<span><b style="color:'+r.pal[3]+'">'+r.stats[j]+'</b> <span style="font-size:10.5px;opacity:.5">'+CAPS[j]+'</span></span>';
   infoEl.innerHTML='<div class="left"><div class="nm">'+r.cn+' <span style="font-size:11px;font-weight:700;color:'+rc+'">'+r.rarity+' '+st+'</span></div>'
   +'<div class="en">'+r.name+'</div>'
   +'<div style="font-size:11px;opacity:.85;display:flex;gap:14px;margin-top:2px">'+sp+'</div></div>'
   +'<div class="desc">'+esc(r.description||"")+'</div>';
  }
    /**
   * 把稀有度与「是否居中」写到卡牌 DOM 上，供 CSS 特效选择器使用。
   *
   * data-rarity 与 --rc 供卡片自身配色使用，cur 类标记「居中且未打开详情」的那张卡；
   * 真正的稀有度特效由 15-fx.js 的 Canvas 引擎绘制，末尾的 fxSync() 负责把两块画布
   * 绑定到当前居中的那张卡（卡面被重建时也必须重绑）。
   */
  function markFx(){
   for(var i=0;i<cards.length;i++){
    var el=cards[i],r=state.list[i];
    if(!el||!r)continue;
    var rar=RARC[r.rarity]?r.rarity:"N";
    if(el.getAttribute("data-rarity")!==rar)el.setAttribute("data-rarity",rar);
    el.style.setProperty("--rc",RARC[rar]);
    el.classList.toggle("cur",state.detail<0&&i===state.index);
   }
   fxSync(cards,state.index);
  }
  /**
   * 小窗口下卡牌的等比缩放系数。
   *
   * 舞台高度跟着窗口走（见 SKC_CSS_FIT），窗口越矮舞台越矮；卡牌按舞台高度等比缩小，
   * 整张卡才留得住，而不是被 `.stage` 的 overflow:hidden 裁掉上下两头。
   * 舞台高度够（≥ 约 430px）时恒为 1，大屏观感与以前完全一致。
   *
   * @return 缩放系数，取值 0.55 ~ 1
   */
  function fitScale(){
   var h=stage.clientHeight;
   if(!h)return 1;
   var k=(h-20)/410;
   return k>=1?1:(k<.55?.55:k);
  }
  function apply(){
   var open=state.detail>=0;
   var flyX=-(deck.clientWidth/2-210);
   // 位移与缩放一起乘 K：邻卡间距、聚拢程度都随卡牌本身等比缩小，四种模式的构图不变
   var K=fitScale();
   for(var i=0;i<cards.length;i++){
    var el=cards[i],dd=i-state.index,ad=Math.abs(dd),t,op,z;
    if(open){
     if(i===state.index){t="translate(-50%,-50%) translateX("+flyX+"px) scale("+(1.07*K)+")";op=1;z=120;}
     else{t="translate(-50%,-50%) translateX("+flyX+"px) scale("+(.86*K)+")";op=0;z=1;}
    }else if(state.mode==="fan"){
     var x=dd*134*K,rot=dd*8.5,sc=Math.max(.5,1-ad*.155)*K,y=ad*24*K;
     t="translate(-50%,-50%) translate("+x+"px,"+y+"px) rotate("+rot+"deg) scale("+sc+")";
     op=ad>4?0:1-ad*.14;z=200-ad;
    }else if(state.mode==="ring"){
     var ang=dd*26;
     t="translate(-50%,-50%) rotateY("+ang+"deg) translateZ("+RING_DEPTH+"px) scale("+(RING_K*K)+")";
     op=ad>3?0:1-ad*.24;z="auto";
    }else if(state.mode==="smooth"){
     var x2=dd*232*K,sc2=(dd===0?1.18:.84)*K;
     t="translate(-50%,-50%) translateX("+x2+"px) scale("+sc2+")";
     op=ad>3?0:1-ad*.22;z=200-ad;
    }else{
     var e=dd<0?0:dd;
     t="translate(-50%,-50%) translate("+(e*16*K)+"px,"+(-e*9*K)+"px) rotate("+(e*2.6)+"deg) scale("+((1-e*.055)*K)+")";
     op=dd<0?0:(e>5?0:1-e*.14);z=200-e;
    }
    el.style.transform=t;el.style.opacity=op;el.style.zIndex=z;
    el.style.pointerEvents=op<.05?"none":"auto";
    el.style.filter=(!open&&dd===0)?"brightness(1.06) saturate(1.05)":"";
   }
   markFx();
   if(newCardEl){
    var ndd=(state.mode==="deck")?(state.list.length-state.index):(-1-state.index);
    if(!state.list.length)ndd=0;
    var nad=Math.abs(ndd),nt,nop,nz;
    if(state.mode==="fan"){
     nt="translate(-50%,-50%) translate("+(ndd*134*K)+"px,"+(nad*24*K)+"px) rotate("+(ndd*8.5)+"deg) scale("+(Math.max(.5,1-nad*.155)*K)+")";
     nop=nad>4?0:1-nad*.14;nz=200-nad;
    }else if(state.mode==="ring"){
     nt="translate(-50%,-50%) rotateY("+(ndd*26)+"deg) translateZ("+RING_DEPTH+"px) scale("+(RING_K*K)+")";
     nop=nad>3?0:1-nad*.24;nz="auto";
    }else if(state.mode==="smooth"){
     nt="translate(-50%,-50%) translateX("+(ndd*232*K)+"px) scale("+((ndd===0?1.18:.84)*K)+")";
     nop=nad>3?0:1-nad*.22;nz=200-nad;
    }else{
     var ne=ndd<0?0:ndd;
     nt="translate(-50%,-50%) translate("+(ne*16*K)+"px,"+(-ne*9*K)+"px) rotate("+(ne*2.6)+"deg) scale("+((1-ne*.055)*K)+")";
     nop=ndd<0?0:(ne>5?0:1-ne*.14);nz=200-ne;
    }
    if(open)nop=0;
    newCardEl.style.transform=nt;newCardEl.style.opacity=nop;newCardEl.style.zIndex=nz;
    newCardEl.style.pointerEvents=nop<.05?"none":"auto";
   }
   countEl.textContent=(state.list.length?state.index+1:0)+" / "+state.list.length;
   var ds=dotsEl.children;
   for(var q=0;q<ds.length;q++)ds[q].className="dot"+(q===state.index?" on":"");
   showInfo();
  }
  /**
   * 重建卡片轨道时临时关掉过渡用的标记。
   *
   * 轨道重建会造出全新的 .card3d 节点，浏览器把「初始 transform → 目标 transform」当成一次
   * 状态变化，于是每张卡都把入场过渡重播一遍（实测静默刷新一次触发 127 次过渡），
   * 看起来就是卡片反复跳动。首次填充（还没有卡）保留入场动画，之后的任何重建都不播。
   */
  var rebindTimer=0;
  /**
   * 按当前「分类 + 来源 + 标签 + 搜索」四重条件重建卡片轨道与指示点。
   * 只负责列表本身，不触碰详情面板的开合状态，因此可以安全地在详情页里调用。
   */
  function renderList(){
   var animate=cards.length===0;
   if(!animate)deck.classList.add("skc-rebind");
   state.list=allSkills.filter(passes);
   buildTagRow();
   if(state.index>=state.list.length)state.index=Math.max(0,state.list.length-1);
   var h="";
   for(var i=0;i<state.list.length;i++)h+='<div class="card3d"></div>';
   // 没有符合条件的卡时不顶掉整条轨道：虚线「＋ 新建技能」卡保持可见，
   // 提示文案挪到底部信息栏，用户至少还能新建技能。
   track.innerHTML=h+NEW_CARD_HTML;
   cards=state.list.length?[].slice.call(track.children).filter(function(el){return String(el.className).indexOf("card3d")>=0;}):[];
   newCardEl=q("#newcard");
   for(var i2=0;i2<cards.length;i2++)cards[i2].innerHTML=fxHTML(state.list[i2])+renderCard(state.list[i2],i2,"x")+fxUpHTML(state.list[i2]);
   var d="";
   for(var j=0;j<state.list.length;j++)d+='<div class="dot"></div>';
   dotsEl.innerHTML=d;
   if(!state.list.length){
    infoEl.innerHTML='<div class="desc">没有符合条件的技能卡 —— 点中间的 ＋ 新建技能，或换一个来源 / 清空搜索框</div>';
   }
   markFx();
   if(!animate){
    // 60ms 后再放开过渡：apply() 已在新节点上写好 transform，此时放开不会补播动画。
    // 这里用定时器而不是 rAF —— 面板在后台标签页时 rAF 可能长期不触发，标记会一直挂着。
    if(rebindTimer)clearTimeout(rebindTimer);
    rebindTimer=setTimeout(function(){rebindTimer=0;deck.classList.remove("skc-rebind");},60);
   }
  }
  /**
   * 技能卡的稳定标识。
   *
   * 详情面板在刷新后要「认得出还是原来那张卡」，不能拿对象身份比：applyPayload 会用
   * `normalizeSkill` 把 host 下发的每一条都重新映射成**新对象**，旧引用在新列表里
   * 永远找不到，索引一丢详情就被关掉（表现为：后台出图完成的轮询、点「↻ 刷新」
   * 都会把刚打开的详情顶回卡片列表）。host 下发的 id 由真实路径决定，整批重建后不变。
   *
   * @param r 技能卡数据
   * @return 稳定标识
   */
  function skillKey(r){
   return r?(r.id||r.name||""):"";
  }
  /**
   * 重建列表，并尽量让详情面板继续停在同一张卡上。
   *
   * 详情页里改完分类或标签后调用；若该卡已被筛选条件排除，则关闭详情面板。
   */
  function refreshKeepingDetail(){
   var keep=(state.detail>=0&&state.list[state.index])?state.list[state.index]:null;
   var wantKey=skillKey(keep);
   renderList();
   if(keep){
    var ni=-1;
    for(var i=0;i<state.list.length;i++)if(skillKey(state.list[i])===wantKey){ni=i;break;}
    if(ni>=0){state.index=ni;state.detail=ni;body.classList.add("detail-open");deck.classList.add("open");}
    else{closeDetail();}
   }
   renderDetail();
   apply();
  }
  /**
   * 全量重绘：关闭详情面板，重建列表，再刷新面板与舞台。
   */
  function render(){
   if(state.detail>=0){state.detail=-1;state.editing=false;state.bodyFull=false;state.confirm=false;deck.classList.remove("open");}
   state.addingTag=false;state.pendingTag="";
   renderList();
   renderDetail();
   apply();
  }
  function step(d){
   var n=state.index+d;
   if(n<0)n=0;else if(n>state.list.length-1)n=state.list.length-1;
   if(n===state.index)return;
   state.index=n;apply();
  }
  /* ── 详情面板 ─────────────────────────────────────────── */
  function openDetail(){
   if(state.list.length===0)return;
   state.detail=state.index;state.editing=false;state.bodyFull=false;state.confirm=false;state.addingTag=false;state.pendingTag="";
   body.classList.add("detail-open");deck.classList.add("open");
   renderDetail();apply();
  }
  function closeDetail(){
   if(state.detail<0)return;
   state.detail=-1;state.editing=false;state.bodyFull=false;state.confirm=false;state.addingTag=false;state.pendingTag="";
   body.classList.remove("detail-open");deck.classList.remove("open");
   renderDetail();apply();
  }
  /**
   * 渲染右侧详情面板。详情关闭时清空内容；编辑态下把只读文案换成表单控件。
   */
  function renderDetail(){
   if(state.detail<0){dpanel.innerHTML="";confirmEl.innerHTML="";confirmEl.className="confirm";return;}
   var r=state.list[state.index];if(!r)return;
   var rc=RARC[r.rarity],ed=state.editing;
 var ro=r.canWrite===false,canDel=r.canDelete!==false;
   var starHtml="";
   for(var i=0;i<5;i++)starHtml+='<span class="'+(i<r.stars?"on":"")+'" data-star="'+(i+1)+'">★</span>';
   var statHtml="";
   for(var j=0;j<5;j++){
    var v=(r.stats[j]===undefined?0:r.stats[j]);
    var val=ed?('<input class="snum" type="number" min="0" max="100" value="'+v+'" data-stat="'+j+'">'):v;
    statHtml+='<div class="stat"><div class="v" style="color:'+(ed?"#e6edf7":r.pal[3])+'">'+val+'</div>'
     +'<div class="l">'+CAPS[j]+'</div><div class="bar"><i style="width:'+v+'%;background:linear-gradient(90deg,'+r.pal[2]+','+r.pal[3]+')"></i></div></div>';
   }
   var editRow="";
   if(ed){
    var opts="";
    for(var c=0;c<CATS.length;c++){if(CATS[c][1]===null)continue;opts+='<option value="'+CATS[c][1]+'"'+(CATS[c][1]===r.cat?" selected":"")+'>'+CATS[c][1]+'</option>';}
    var rp="";
    for(var k=0;k<RARS.length;k++)rp+='<span class="rpick'+(RARS[k]===r.rarity?" on":"")+'" data-rar="'+RARS[k]+'" style="'+(RARS[k]===r.rarity?("background:"+RARC[RARS[k]]):"")+'">'+RARS[k]+'</span>';
    editRow='<div class="editrow"><span class="k">中文名</span><input class="tin cnin" id="f-cn" maxlength="12" value="'+esc(r.cn)+'" placeholder="例如：提审双途"></div>'
     +'<div class="editrow"><span class="k">分类</span><select class="sel" id="f-cat">'+opts+'</select>'
     +'<span class="k" style="margin-left:14px">稀有度</span><span class="rpicks" id="f-rar">'+rp+'</span></div>'
     +'<div class="editrow"><span class="k">星数</span><span class="starpick" id="f-star">'+starHtml+'</span></div>';
   }
   var tagWrap='<div class="tagwrap"><div class="tags">'+tagChips(r,ed)
    +(state.addingTag?'<input class="tin newtag" id="f-newtag" placeholder="输入后回车或点保存" maxlength="24" value="'+esc(state.pendingTag)+'">':"")
    +'</div><button class="tagadd" data-act="addtag">＋ 标签</button></div>';
   var descBlock=ed
    ?(ro?'<textarea class="ta" id="f-desc" disabled>'+esc(r.description||"")+'</textarea><div class="rohint">🔒 该技能位于只读位置（应用内置包或插件包），描述不可修改</div>':'<textarea class="ta" id="f-desc">'+esc(r.description||"")+'</textarea>')
    :'<div class="pdesc">'+esc(r.description||"")+'</div>';
   var actHtml=ed
    ?'<div class="acts"><button class="gbtn primary" data-act="save">✓ 保存修改</button><button class="gbtn ghost" data-act="cancel">取消</button></div>'
    :'<div class="acts"><button class="gbtn primary" data-act="edit">✎ 修改</button>'
  +(canDel?'<button class="gbtn danger" data-act="del">🗑 删除技能</button>'
    :'<button class="gbtn danger ro" data-act="del" aria-disabled="true" title="'+esc(r.readonlyReason||"不可删除")+'">🔒 只读技能</button>')
  +'<button class="gbtn ghost" data-act="close">✕ 关闭</button></div>';
   dpanel.innerHTML='<div class="panel" style="--rc:'+rc+'">'
    +'<div class="phead"><span class="rbadge" style="background:'+rc+'">'+r.rarity+'</span>'
    +'<span class="pcat">'+esc(r.cat)+'</span>'
    +'<span class="stars">'+starHtml+'</span></div>'
    +'<div class="ptitle">'+esc(r.cn)+'</div><div class="pen">'+esc(r.name)+' · '+esc(r.srcLabel||r.src)+'</div>'
    +'<div style="margin-top:12px">'+editRow+'<div class="stats">'+statHtml+'</div>'+tagWrap+descBlock+'</div>'
    +bodyInline(r,ed)
    +actHtml
    +bodyOverlay(r)
    +'</div>';
   // 正文框需在 innerHTML 落盘后再测量高度，否则拿到的是尚未布局的尺寸
   var bta=q("#f-body");
   if(bta){autosizeBody(bta);bta.addEventListener("input",function(){autosizeBody(bta);});}
   if(ed){
    confirmEl.className="confirm";
    return;
   }
   renderConfirm(r);
  }
  /**
   * 当前详情对应的技能是否允许删除。
   */
  function canDelOf(){var r=state.list[state.index];return !!(r&&r.canDelete!==false);}
  /**
   * 生成「为什么不能删」的提示文案，直接把 host 给出的原因展示给用户。
   */
  function readonlyTip(){var r=state.list[state.index];return "🔒 "+((r&&r.readonlyReason)||"该技能不可删除。");}
  /**
   * 渲染删除二次确认弹层。仅在非编辑态、且确认开关打开时可见。
   *
   * @param r 当前详情面板对应的技能卡数据
   */
  function renderConfirm(r){
   if(!state.confirm){confirmEl.innerHTML="";confirmEl.className="confirm";return;}
   confirmEl.innerHTML='<div class="cbox"><h3>⚠ 删除技能</h3>'
    +'<p>确认删除技能 <code>'+esc(r.name)+'</code> 吗？<br>将删除：<code>'+esc(r.deleteTarget||r.path||"")+'</code>'
 +'（共 '+(r.deleteFiles||1)+' 个文件）<br><b>此操作不可恢复。</b></p>'
    +'<div class="crow"><button class="gbtn ghost" data-act="del-no">取消</button><button class="gbtn danger" data-act="del-yes">确认删除</button></div></div>';
   confirmEl.className="confirm on";
  }
  function toast(msg){
   toastEl.textContent=msg;toastEl.classList.add("on");
   clearTimeout(toast._t);
   toast._t=setTimeout(function(){toastEl.classList.remove("on");},2400);
  }
  /* ── 详情面板内的所有交互（事件委托） ─────────────────── */
  dpanel.addEventListener("click",function(e){
   var hit=e.target.closest?e.target.closest("[data-act],[data-rm]"):null;
   var el=hit||e.target,act=hit?hit.getAttribute("data-act"):null;
   if(act==="addtag"){state.addingTag=true;ensureTagInput();return;}
   var rmv=hit?hit.getAttribute("data-rm"):null;
   if(rmv){
    var rr=state.list[state.index],ix=rr.tags.indexOf(rmv);
    if(ix>=0)rr.tags.splice(ix,1);
    buildTagRow();renderTagChipsOnly();renderCardsOnly();toast("已移除标签「"+rmv+"」");
    pushUpdate({tags:rr.tags},null);
    return;
   }
   if(act==="close"){closeDetail();return;}
   if(act==="bodyfull"){state.bodyFull=!state.bodyFull;renderDetail();return;}
   if(act==="edit"){state.editing=true;state.bodyFull=false;state.pendingTag="";renderDetail();return;}
   if(act==="cancel"){state.editing=false;state.bodyFull=false;state.addingTag=false;state.pendingTag="";renderDetail();return;}
   if(act==="del"){if(!canDelOf()){toast(readonlyTip());return;}state.confirm=true;renderDetail();return;}
   if(act==="save"){
    var r=state.list[state.index];
    if(!r)return;
    var cats=q("#f-cat"),ds=q("#f-desc"),cnEl=q("#f-cn");
    var cnNew=cnEl?cnEl.value.trim():"";
    // 中文名是卡面主标题，空名字会让卡片没标题，直接挡在提交前
    if(cnEl&&cnNew===""){toast("中文名不能为空");return;}
    var bs=q("#f-body"),bodyNew=bs?bs.value:null;
    var patch={};
    // 标签输入框里还没回车的文本，点「保存修改」也要一起存下来（以前会被失焦清掉）
    var tagEl=q("#f-newtag");
    var tagRaw=tagEl?tagEl.value:state.pendingTag;
    var tagNew=String(tagRaw||"").replace(/\s+/g," ").trim().slice(0,8);
    if(tagNew!==""){
     if(r.tags.indexOf(tagNew)<0)r.tags.push(tagNew);
     patch.tags=r.tags;
    }
    state.pendingTag="";
    if(cnEl&&cnNew!==r.cn){r.cn=cnNew;patch.cn=cnNew;}
    if(cats){r.cat=cats.value;patch.category=cats.value;}
    var canDesc=!!(ds&&!ds.disabled),descNew=canDesc?ds.value:null;
    // 描述没动就不写回 SKILL.md：以前每次保存都无条件回写，等于每点一次保存就动一次源文件
    var descDirty=canDesc&&descNew!==r.description;
    if(canDesc)r.description=ds.value;
    var nums=dpanel.querySelectorAll(".snum"),stats=r.stats.slice(0,5);
    while(stats.length<5)stats.push(0);
    for(var i=0;i<nums.length;i++){
     var idx=parseInt(nums[i].getAttribute("data-stat"),10),nv=parseInt(nums[i].value,10);
     stats[idx]=isNaN(nv)?0:Math.max(1,Math.min(99,nv));
    }
    r.stats=stats;
    patch.stats=stats;
    // 正文先写回内存再重绘：refreshKeepingDetail 用的是内存里的 r.body，写晚了入口行字数会停在旧值
    var bodyDirty=bodyNew!==null&&bodyNew!==r.body;
    if(bodyNew!==null)r.body=bodyNew;
    state.editing=false;state.bodyFull=false;
    buildTabs();buildSrcs();refreshKeepingDetail();
    pushUpdate(patch,"已保存对 "+(r.cn||r.name)+" 的修改");
    if(descDirty)pushDescription(descNew);
    if(bodyDirty)pushBody(r.id,r.name,bodyNew);
    return;
   }
   var rar=el.getAttribute&&el.getAttribute("data-rar");
   if(rar){state.list[state.index].rarity=rar;renderDetail();renderCardsOnly();pushUpdate({rarity:rar},null);return;}
   var st=el.getAttribute&&el.getAttribute("data-star");
   if(st){var sv=parseInt(st,10);state.list[state.index].stars=sv;renderDetail();renderCardsOnly();pushUpdate({stars:sv},null);return;}
  });
  /**
   * 只重画卡面 SVG 与底部信息条，不重建 track（避免编辑时卡片动画被重置）。
   */
  function renderCardsOnly(){
   /* 卡面是 innerHTML 整体替换的，两块特效画布随之被销毁重建，只能靠下面的 markFx 重新绑定 */
   for(var i=0;i<cards.length;i++)cards[i].innerHTML=fxHTML(state.list[i])+renderCard(state.list[i],i,"x")+fxUpHTML(state.list[i]);
   markFx();
   showInfo();
  }
  /**
   * 提交标签输入框里的内容：折叠空格、去重后挂到当前卡上，并刷新标签筛选行与卡面。
   *
   * @param raw 输入框原始文本
   */
  function commitTag(raw){
   var v=String(raw||"").replace(/\s+/g," ").trim().slice(0,8);
   state.addingTag=false;state.pendingTag="";
   if(!v){renderTagChipsOnly();return;}
   var r=state.list[state.index];
   if(!r){renderTagChipsOnly();return;}
   if(r.tags.indexOf(v)>=0){renderTagChipsOnly();toast("标签「"+v+"」已存在");return;}
   r.tags.push(v);
   buildTagRow();renderTagChipsOnly();renderCardsOnly();
   toast("已添加标签「"+v+"」");
   pushUpdate({tags:r.tags},null);
  }
  dpanel.addEventListener("keydown",function(e){
   if(e.target.id!=="f-newtag")return;
   if(e.key==="Enter"){e.preventDefault();commitTag(e.target.value);}
   else if(e.key==="Escape"){e.preventDefault();state.addingTag=false;state.pendingTag="";ensureTagInput();}
  });
  dpanel.addEventListener("input",function(e){
   if(e.target&&e.target.id==="f-newtag")state.pendingTag=e.target.value;
  });
  dpanel.addEventListener("focusout",function(e){
   if(e.target.id!=="f-newtag"||!state.addingTag)return;
   // 有内容就先留着：用户可能接着点「保存修改」，失焦不能把标签吃掉
   setTimeout(function(){
    if(state.addingTag&&String(state.pendingTag||"").trim()===""){state.addingTag=false;ensureTagInput();}
   },0);
  });
  confirmEl.addEventListener("click",function(e){
   var act=e.target.getAttribute&&e.target.getAttribute("data-act");
   if(act==="new-no"){state.creating=false;renderCreate();return;}
   if(act==="new-yes"){submitCreate();return;}
   if(act==="del-no"){state.confirm=false;renderDetail();return;}
   if(act==="del-yes"){
  var r=state.list[state.index];
  if(!r)return;
  var nm=r.name;
  apiCall("delete",{id:r.id,name:nm}).then(function(){
   state.detail=-1;state.editing=false;state.bodyFull=false;state.confirm=false;
   body.classList.remove("detail-open");deck.classList.remove("open");
   toast("已删除技能 "+nm);
   refresh(true);
  }).catch(function(err){
   state.confirm=false;renderDetail();
   toast("删除失败："+((err&&err.message)||err));
  });
 }
  });
  /* ── 指针滑动 ─────────────────────────────────────────── */
  var down=false,sx=0,dx=0,moved=false;
  stage.addEventListener("pointerdown",function(e){
   if(e.button!==0&&e.button!==1&&e.button!==2)return;
   e.preventDefault();
   if(state.detail>=0)return;
   down=true;sx=e.clientX;dx=0;moved=false;
   stage.classList.add("drag");track.style.transition="none";
  });
  window.addEventListener("pointermove",function(e){if(!root.isConnected)return;
   if(!down)return;
   dx=e.clientX-sx;
   if(Math.abs(dx)>6)moved=true;
   track.style.transform="translateX("+(dx*.6)+"px)";
  });
  /**
   * 结束一次指针交互：位移超阈值则翻页，未移动则视为点选。
   *
   * @param e 触发结束的指针事件；取消时为 null
   */
  function release(e){
   if(!down)return;
   down=false;stage.classList.remove("drag");
   if(!moved&&e&&typeof e.clientX==="number")tapAt(e.clientX,e.clientY);
   track.style.transition="";track.style.transform="translateX(0px)";
   if(dx<-65)step(1);else if(dx>65)step(-1);
  }
  /**
   * 命中测试：点空处关详情；点未选中的卡跳转；点已选中的卡打开详情。
   *
   * @param x 视口 X 坐标
   * @param y 视口 Y 坐标
   */
  function tapAt(x,y){
   var el=document.elementFromPoint(x,y);
   while(el&&el!==stage){
    if(el.id==="newcard"){openCreate();return;}
    if(el.className&&String(el.className).indexOf("card3d")>=0){
     var k=cards.indexOf(el);
     if(k<0)return;
     if(state.detail>=0){if(k===state.index)closeDetail();return;}
     if(k===state.index)openDetail();
     else{state.index=k;apply();}
     return;
    }
    el=el.parentNode;
   }
   if(state.detail>=0)closeDetail();
  }
  window.addEventListener("pointerup",function(e){if(!root.isConnected)return;release(e);});
  window.addEventListener("pointercancel",function(){if(!root.isConnected)return;release(null);});
  ["contextmenu","selectstart","dragstart","mousedown"].forEach(function(t){
   stage.addEventListener(t,function(e){e.preventDefault();});
  });
  /* ── 滚轮：累计位移换算成卡片张数 ─────────────────────── */
  stage.addEventListener("wheel",function(e){
   e.preventDefault();
   if(state.detail>=0)return;
   var d=(Math.abs(e.deltaX)>Math.abs(e.deltaY))?e.deltaX:e.deltaY;
   if(e.deltaMode===1)d*=16;else if(e.deltaMode===2)d*=400;
   wheelAcc+=d;
   var unit=WHEEL_BASE/state.sens;
   var n=Math.trunc(wheelAcc/unit);
   if(n!==0){
    var c=Math.max(-5,Math.min(5,n));
    wheelAcc=(c!==n)?0:wheelAcc-c*unit;
    step(c);
   }
  },{passive:false});
  window.addEventListener("keydown",function(e){if(!root.isConnected)return;
   if(e.key==="Escape"){if(state.ddOpen||state.projOpen||state.dirOpen){state.ddOpen=false;state.projOpen=false;state.dirOpen=false;buildSrcs();return;}closeDetail();return;}
   if(state.detail>=0)return;
   if(e.key==="ArrowLeft")step(-1);else if(e.key==="ArrowRight")step(1);
  });
  q("#tabs").addEventListener("click",function(e){
   var el=e.target;while(el&&el.className.indexOf("tab")<0)el=el.parentNode;
   if(!el||!el.getAttribute)return;
   var idx=parseInt(el.getAttribute("data-cat"),10);
   if(isNaN(idx))return;
   state.cat=CATS[idx][1];state.index=0;buildTabs();render();
  });
  q("#srcs").addEventListener("click",function(e){
   var ditem=e.target.closest?e.target.closest("[data-dir]"):null;
   if(ditem){
    var dv=ditem.getAttribute("data-dir");
    state.dir=(dv==="__ALL__")?null:dv;state.dirOpen=false;state.index=0;buildSrcs();render();return;
   }
   var dtog=e.target.closest?e.target.closest('[data-act="dirdd"]'):null;
   if(dtog){state.dirOpen=!state.dirOpen;state.projOpen=false;state.ddOpen=false;buildSrcs();return;}
   var pitem=e.target.closest?e.target.closest("[data-proj]"):null;
   if(pitem){
    var pv=pitem.getAttribute("data-proj");
    state.src="项目技能";
    state.project=(pv==="__ALL__")?null:pv;state.projOpen=false;state.dir=null;state.dirOpen=false;
    state.index=0;buildSrcs();render();return;
   }
   var ptog=e.target.closest?e.target.closest('[data-act="projdd"]'):null;
   if(ptog){state.projOpen=!state.projOpen;state.ddOpen=false;state.dirOpen=false;buildSrcs();return;}
   var item=e.target.closest?e.target.closest(".dditem"):null;
   if(item){state.src=item.getAttribute("data-src");state.ddOpen=false;state.index=0;buildSrcs();render();return;}
   var tog=e.target.closest?e.target.closest('[data-act="srcdd"]'):null;
   if(tog){state.ddOpen=!state.ddOpen;state.projOpen=false;buildSrcs();return;}
   var el=e.target.closest?e.target.closest(".tab"):null;
   if(!el)return;
   var v=el.getAttribute("data-src");
   if(v===null)return;
   state.src=(v==="__ALL__")?null:v;state.project=null;state.dir=null;state.ddOpen=false;state.projOpen=false;state.dirOpen=false;
   state.index=0;buildSrcs();render();
  });
  /**
   * 点来源行以外的地方收起「其它来源」下拉。
   *
   * 必须挂在**捕获阶段**：展开下拉时 `#srcs` 会被整块重绘，等冒泡到这里时被点的按钮
   * 已经脱离文档，`closest('#srcs')` 会误判成「点在面板外」而把刚展开的菜单关掉。
   *
   * @param e 文档级 click 事件
   */
  function closeSrcMenu(e){
   if(!state.ddOpen&&!state.projOpen&&!state.dirOpen)return;
   var t=e.target;
   if(t&&t.closest&&t.closest("#srcs"))return;
   state.ddOpen=false;state.projOpen=false;state.dirOpen=false;buildSrcs();
  }
  q("#taglist").addEventListener("click",function(e){
   var el=e.target.closest?e.target.closest(".tchip"):null;
   if(!el)return;
   var tg=el.getAttribute("data-tag");
   if(tg==="__CLEAR__")state.tags=[];
   else{
    var ix=state.tags.indexOf(tg);
    if(ix>=0)state.tags.splice(ix,1);else state.tags.push(tg);
   }
   state.index=0;render();
  });
  q("#modes").addEventListener("click",function(e){
   var el=e.target;while(el&&el.className.indexOf("mbtn")<0)el=el.parentNode;
   if(!el||!el.getAttribute)return;
   var mm=el.getAttribute("data-mode");if(!mm)return;
   state.mode=mm;
   var all=qall(".mbtn");
   for(var i=0;i<all.length;i++)all[i].className="mbtn"+(all[i]===el?" on":"");
   stage.className="stage"+(mm==="ring"?" ring":"");
   apply();
  });
  /* ── 滚轮灵敏度设置 ───────────────────────────────────── */
  var sensEl=q("#sens"),sensValEl=q("#sensval");
  /**
   * 刷新灵敏度读数：把内部刻度换算成「滚动一格前进几张卡」。
   * 标准鼠标滚轮一格约产生 100 的 deltaY。
   */
  function syncSens(){
   var per=100*state.sens/WHEEL_BASE;
   sensValEl.textContent="每格滚轮 ≈ "+per.toFixed(1)+" 张卡";
  }
  sensEl.addEventListener("input",function(){
   var v=parseInt(sensEl.value,10);
   state.sens=(isNaN(v)||v<1)?6:v;
   wheelAcc=0;
   syncSens();
  });
  state.sens=parseInt(sensEl.value,10)||6;
  syncSens();
  /* ── 卡牌特效开关 ─────────────────────────────────────── */
  var FX_KEY="dsh-skill-card:fx";   // 本机保存特效开关用的 localStorage 键
  var fxEl=q("#fx"),fxValEl=q("#fxval");
  /**
   * 读取本机保存的特效开关。
   *
   * @return true 表示开启特效；读不到（存储被禁用）时按默认「开」处理
   */
  function fxLoad(){
   try{return window.localStorage.getItem(FX_KEY)!=="0";}catch(e){return true;}
  }
  /**
   * 应用特效开关：只改根节点的一个属性，特效显示与否完全交给 CSS，避免重建卡片。
   *
   * @param on 是否开启特效
   */
  function fxApply(on){
   root.setAttribute("data-fx",on?"on":"off");
   FXOFF=!on;
   fxSync(cards,state.index);
   fxEl.checked=on;
   fxValEl.textContent=on?"已开启":"已关闭";
  }
  fxEl.addEventListener("change",function(){
   var on=!!fxEl.checked;
   fxApply(on);
   try{window.localStorage.setItem(FX_KEY,on?"1":"0");}catch(e){/* 存储不可用时只在本次会话生效 */}
  });
  fxApply(fxLoad());
  var searchEl=q("#search");
  searchEl.addEventListener("input",function(){
   state.query=searchEl.value;state.index=0;render();
  });  /* ── 新建技能 ─────────────────────────────────────────── */
  var NAME_RE=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  /**
   * 打开新建技能表单（复用详情面板的确认弹层容器）。
   */
  function openCreate(){
   state.creating=true;state.confirm=false;state.editing=false;state.bodyFull=false;state.addingTag=false;state.pendingTag="";
   renderCreate();
  }
  /**
   * 渲染新建技能表单：技能名、描述、分类、稀有度、安装位置。
   *
   * 只列出 host 报告为可写的技能目录；技能名必须符合 DSH 的命名规则，
   * 否则 SKILL.md 不会被识别成一个技能。
   */
  function renderCreate(){
   if(!state.creating){confirmEl.className="confirm";confirmEl.innerHTML="";return;}
   var roots=(state.meta&&state.meta.createRoots)||[],writable=[],i;
   for(i=0;i<roots.length;i++)if(roots[i].writable!==false)writable.push(roots[i]);
   var ropts="";
   if(!writable.length)ropts='<option value="">（没有可写的技能目录）</option>';
   for(i=0;i<writable.length;i++)ropts+='<option value="'+esc(writable[i].path)+'">'+esc(writable[i].label)+" · "+esc(writable[i].path)+'</option>';
   var copts="";
   for(i=1;i<CATS.length;i++)copts+='<option value="'+esc(CATS[i][1])+'">'+esc(CATS[i][0])+'</option>';
   var xopts="";
   for(i=0;i<RARS.length;i++)xopts+='<option value="'+RARS[i]+'"'+(RARS[i]==="SR"?" selected":"")+'>'+RARS[i]+'</option>';
   confirmEl.className="confirm on";
   confirmEl.innerHTML='<div class="cbox create"><h3>＋ 新建技能</h3>'
    +'<label class="fl">技能名（小写字母、数字、连字符）<input id="c-name" class="fin" placeholder="my-new-skill" autocomplete="off"></label>'
    +'<label class="fl">描述<textarea id="c-desc" class="fin ta" rows="3" placeholder="这个技能用来做什么，什么时候用它"></textarea></label>'
    +'<label class="fl">分类<select id="c-cat" class="fin">'+copts+'</select></label>'
    +'<label class="fl">稀有度<select id="c-rar" class="fin">'+xopts+'</select></label>'
    +'<label class="fl">安装位置<select id="c-root" class="fin">'+ropts+'</select></label>'
    +'<div class="cerr" id="c-err"></div>'
    +'<div class="crow"><button class="gbtn ghost" data-act="new-no">取消</button><button class="gbtn primary" data-act="new-yes">✓ 创建</button></div></div>';
   var ni=q("#c-name");
   if(ni)ni.focus();
  }
  /**
   * 校验并提交新建技能表单：先建 SKILL.md，再按需补写卡片属性。
   */
  function submitCreate(){
   var ni=q("#c-name"),di=q("#c-desc"),ci=q("#c-cat"),ri=q("#c-rar"),ti=q("#c-root"),err=q("#c-err");
   var nm=(ni&&ni.value||"").trim(),ds=(di&&di.value||"").trim();
   var ca=ci?ci.value:"",ra=ri?ri.value:"",rt=ti?ti.value:"";
   if(!NAME_RE.test(nm)){if(err)err.textContent="技能名只能由小写字母、数字与连字符组成，且不能以连字符开头或结尾";return;}
   if(!ds){if(err)err.textContent="描述不能为空：DSH 要求 SKILL.md 的 frontmatter 必须有 description";return;}
   if(!rt){if(err)err.textContent="没有可写的技能目录，无法新建";return;}
   if(err)err.textContent="创建中…";
   apiCall("create",{name:nm,description:ds,root:rt}).then(function(){
    var rest=ra?apiCall("update",{name:nm,category:ca,rarity:ra}):Promise.resolve(null);
    return rest.then(function(){return refresh(true);}).then(function(){
     state.creating=false;renderCreate();
     for(var i=0;i<state.list.length;i++)if(state.list[i].name===nm){state.index=i;break;}
     apply();toast("已创建技能 "+nm);
    });
   }).catch(function(e2){
    if(err)err.textContent="创建失败："+((e2&&e2.message)||e2);
   });
  }
  var newBtn=q("#newbtn");
  if(newBtn)newBtn.addEventListener("click",function(){openCreate();});
  var refreshBtn=q("#refreshbtn");
  if(refreshBtn)refreshBtn.addEventListener("click",function(){refresh();});
  /**
   * 容器尺寸变化后的一帧内重排。
   *
   * 卡片是绝对定位 + 由 apply() 写死的 transform，其中详情态的左移距离取自 `deck.clientWidth`。
   * 窗口从全屏缩成小窗时不重算，卡片就会停在按旧宽度算出的位置上（用户看到的是整条卡片
   * 飞出演播区、只剩空白）。ResizeObserver 监听宿主容器，能一并覆盖窗口缩放、侧栏折叠
   * 这类非 window.resize 引起的尺寸变化；用 rAF 把同一帧的多次回调合并成一次 apply。
   */
  var relayoutRaf=0;
  var resizeObs=null;
  function relayoutSoon(){
   if(relayoutRaf)return;
   var raf=window.requestAnimationFrame||function(f){return setTimeout(f,16);};
   relayoutRaf=raf(function(){relayoutRaf=0;if(root.isConnected)apply();});
  }
  function mount(container) {
    if (root.parentNode !== container) container.appendChild(root);
    document.addEventListener("click",closeSrcMenu,true);
    window.addEventListener("resize",relayoutSoon);
    if(typeof ResizeObserver==="function"){
     if(!resizeObs)resizeObs=new ResizeObserver(relayoutSoon);
     resizeObs.observe(container);
    }
    apply();
    if(!allSkills.length)refresh(true);
  }

  function unmount() {
    document.removeEventListener("click",closeSrcMenu,true);
    window.removeEventListener("resize",relayoutSoon);
    if(resizeObs)resizeObs.disconnect();
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  function dispose() {
    unmount();
    if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
  }

  return { root: root, state: state, mount: mount, unmount: unmount, refresh: refresh, dispose: dispose };
}

    /* ── 50-apply.js ─────────────────────────────── */
  /* ── host 接口客户端 ─────────────────────────────────── */
  var API_BASE = "api/dsh-skill-card/";
  /**
   * 调用 host 路由。
   *
   * 必须使用「文档相对 URL」（不能以 / 开头）：DSH Web GUI 用 <base href="./"> 承载页面，
   * 以斜杠开头的绝对路径不会命中插件路由。
   *
   * @param path 路由短名（list / update / set-description / set-body / delete / create / refresh / health）
   * @param body POST 请求体；不传表示 GET
   * @return Promise，resolve 为 host 返回的 JSON 对象；HTTP 非 2xx 时 reject
   */
  function request(path, body) {
    var init = (body === undefined || body === null)
      ? { method: "GET", credentials: "same-origin" }
      : { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
    return fetch(API_BASE + path, init).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        if (!res.ok) {
          var msg = (data && (data.error || data.message)) || ("HTTP " + res.status);
          throw new Error(msg);
        }
        return data;
      });
    });
  }
  var api = { request: request };
  var controller = createSkillCardController(api);

  /* ── 侧栏图标 ────────────────────────────────────────── */
  /**
   * 侧栏面板行的图标。
   *
   * 侧栏行由外壳自己渲染（按钮、标签、高亮、折叠都由外壳负责），
   * 这里只画一个字形，收到外壳给的 size 与 active。
   *
   * @param props 外壳传入的图标参数：size 为边长，active 为选中态
   * @return 24 视口内的卡牌字形
   */
  function SkillCardPanelIcon(props) {
    var size = (props && props.size) || 16;
    return h("svg", {
      viewBox: "0 0 16 16",
      width: size,
      height: size,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.3,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      "data-dsh-panel-entry": "skill-card"
    },
      h("rect", { key: "a", x: 4.6, y: 1.6, width: 6.8, height: 9.6, rx: 1.2, transform: "rotate(-8 8 6.4)" }),
      h("rect", { key: "b", x: 3.6, y: 4.4, width: 8.8, height: 10, rx: 1.2 }),
      h("path", { key: "c", d: "M6.2 7.4h3.6M6.2 10h2.4M6.2 12.4h3" })
    );
  }

  /* ── 主面板 ──────────────────────────────────────────── */
  /**
   * 主面板页面。
   *
   * 外壳只在选中本面板时挂载它，切入会话就卸载；因此面板状态全部放在 controller 里，
   * 这里只负责把 controller 的 DOM 挂进宿主容器、卸载时摘掉（DOM 与状态都保留）。
   *
   * @param props 外壳注入的面板参数：controller 与 api
   * @return 承载面板根节点的容器
   */
  function SkillCardPanelPage(props) {
    var ctl = (props && props.controller) || controller;
    var hostRef = react.useRef ? react.useRef(null) : { current: null };
    react.useEffect(function () {
      var el = hostRef.current;
      if (!el) return undefined;
      ctl.mount(el);
      return function () { ctl.unmount(); };
    }, [ctl]);
    return h("div", {
      ref: hostRef,
      "data-dsh-skill-card-view": "",
      style: { position: "relative", height: "100%", minHeight: 0, overflow: "hidden" }
    });
  }

  /* ── 注册两个 slot ───────────────────────────────────── */
  var PANEL_ID = "skill-card";
  /**
   * 客户端插件入口：注册侧栏图标（sidebar.panellist）与主面板（main）。
   *
   * 两个 seat 都由外壳插件声明，因此都用 ctx.slots.inject 包裹：
   * 回调只会在拥有该 seat 的外壳条目就绪后执行，加载顺序无关；
   * PANEL_ID 必须两处完全一致，且与 ctx.layout.selectPanel 的参数一致。
   *
   * @param ctx 客户端根上下文（服务：slots）
   */
  function apply(ctx) {
    try {
      ctx.slots.inject("sidebar.panellist", function () {
        return ctx.slots.register({
          name: "sidebar.panellist",
          id: PANEL_ID,
          order: 40,
          label: function () { return "技能卡库"; }
        }, SkillCardPanelIcon);
      });
      ctx.slots.inject("main", function () {
        return ctx.slots.register({
          name: "main",
          key: PANEL_ID,
          inject: function () { return { controller: controller, api: api }; }
        }, SkillCardPanelPage);
      });
    } catch (error) {
      console.warn("[skill-card] 客户端挂载失败", error);
    }
  }
  var inject = ["slots"];
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
