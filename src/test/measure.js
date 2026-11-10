/**
 * panel-measure.html 里的尺寸量测脚本（headless Chrome --dump-dom 读取 #TESTOUT）。
 *
 * 用途：对比四种轮播模式里居中卡的渲染尺寸，防止「环形模式透视放大」
 * 这类各模式之间尺寸不一致的问题再次出现。
 *
 * 注意：prev/next 取的是旋转后元素的轴对齐包围盒，会被平面内旋转撑大，
 * 只有居中卡（无旋转、无平面位移）的宽度可以跨模式直接比较。
 *
 * 量测前会关掉 .card3d/.newcard 的过渡动画，确保读到的是动画结束后的最终尺寸。
 */
(async function () {
  var out = [];
  var C = window.__ctl;
  function tick(ms) { return new Promise(function (r) { setTimeout(r, ms || 60); }); }
  function key(k) { window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })); }
  function cards() { return [].slice.call(document.querySelectorAll(".card3d")); }
  function w(el) { return el ? Math.round(el.getBoundingClientRect().width) : -1; }
  function mode(m) { document.querySelector('[data-mode="' + m + '"]').click(); }
  function goMid() {
    var d = (C.state.list.length >> 1) - C.state.index;
    for (var k = 0; k < Math.abs(d); k++) key(d > 0 ? "ArrowRight" : "ArrowLeft");
  }

  var kill = document.createElement("style");
  kill.textContent = ".skc-root .card3d,.skc-root .newcard{transition:none!important}";
  document.head.appendChild(kill);

  await tick(900);
  var modes = ["fan", "ring", "smooth", "deck"];
  var rows = [];
  for (var i = 0; i < modes.length; i++) {
    mode(modes[i]);
    await tick(120);
    goMid();
    await tick(220);
    var list = cards();
    var ix = C.state.index;
    rows.push({
      mode: modes[i], idx: ix, len: list.length,
      sel: w(list[ix]), prev: w(list[ix - 1]), next: w(list[ix + 1]),
      tf: String(list[ix] && list[ix].style.transform)
    });
  }

  out.push("居中卡宽度（可比）；prev/next 为旋转后的轴对齐包围盒，仅供参照");
  var base = rows[0].sel;
  rows.forEach(function (r) {
    out.push("MODE " + r.mode + " idx=" + r.idx + "/" + r.len +
      " sel=" + r.sel + "px  d(sel-fan)=" + (r.sel - base) + "px" +
      "  [bbox prev=" + r.prev + " next=" + r.next + "]");
    out.push("     transform: " + r.tf);
  });

  // 第二阶段：环形模式下把虚线「＋」卡转到跟前（索引 0 时 ndd=-1），单独量它
  mode("ring"); await tick(120);
  var back = C.state.index;
  for (var b = 0; b < back; b++) key("ArrowLeft");
  await tick(220);
  var list0 = cards();
  var sel0 = w(list0[C.state.index]);
  var dash0 = w(document.getElementById("newcard"));
  out.push("RING-DASH idx=0 sel=" + sel0 + "px newcard=" + dash0 + "px ratio=" + (dash0 / sel0).toFixed(2));

  function ok(n, c, x) { out.push((c ? "PASS " : "FAIL ") + n + (c ? "" : " :: " + x)); }
  var fan = rows[0], ring = rows[1], smooth = rows[2], deck = rows[3];
  ok("环形居中卡与扇形一致（±8px）", Math.abs(ring.sel - fan.sel) <= 8, ring.sel + " vs " + fan.sel);
  ok("环形居中卡不大于平滑放大", ring.sel <= smooth.sel + 2, ring.sel + " vs " + smooth.sel);
  ok("环形居中卡不小于叠牌", ring.sel >= deck.sel - 2, ring.sel + " vs " + deck.sel);
  ok("环形邻卡小于居中卡", ring.prev < ring.sel && ring.next < ring.sel, ring.prev + "/" + ring.next + " vs " + ring.sel);
  ok("环形：虚线卡吃到同一个补偿系数（0.72~1.30 倍）",
    dash0 / sel0 > 0.72 && dash0 / sel0 < 1.3, dash0 + " vs " + sel0);
  ok("无 JS 运行时错误", window.__errors.length === 0, window.__errors.join(" ; "));

  var pass = out.filter(function (x) { return x.indexOf("PASS") === 0; }).length;
  var total = out.filter(function (x) { return /^(PASS|FAIL) /.test(x); }).length;
  document.getElementById("TESTOUT").textContent = "\n" + out.join("\n") + "\nTOTAL " + pass + "/" + total;
  window.__done = true;
})();
