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
