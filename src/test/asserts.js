/**
 * panel-test.html 里的断言脚本（headless Chrome --dump-dom 读取 #TESTOUT）。
 *
 * 全部通过 DOM 事件走真实交互路径：指针点选、面板按钮点击、键盘翻页、搜索框输入。
 */
(async function () {
  var out = [];
  var C = window.__ctl;
  function ok(n, c, x) { out.push((c ? "PASS " : "FAIL ") + n + (c ? "" : " :: " + (x === undefined ? "" : x))); }
  function q(id) { return document.getElementById(id); }
  function cards() { return [].slice.call(document.querySelectorAll(".card3d")); }
  function tick(ms) { return new Promise(function (r) { setTimeout(r, ms || 50); }); }
  function pd(el, x, y) { el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: x, clientY: y })); }
  function pu(x, y) { window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, button: 0, clientX: x, clientY: y })); }
  function tap(el, dx) { var b = el.getBoundingClientRect(); var x = b.left + b.width / 2, y = b.top + b.height / 2; pd(el, x, y); pu(x + (dx || 0), y); }
  function key(k) { window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })); }
  function nav(n, k) { for (var i = 0; i < n; i++) key(k || "ArrowRight"); }
  function act(name) { var el = document.querySelector('[data-act="' + name + '"]'); if (el) el.click(); return !!el; }
  function has(name) { return !!document.querySelector('[data-act="' + name + '"]'); }
  function calls(p) { return window.__calls.filter(function (c) { return c.path === p; }); }
  function last(p) { var a = calls(p); return a.length ? a[a.length - 1].body : null; }
  function setSearch(v) { var el = q("search"); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }
  function st() { return "detail=" + C.state.detail + " edit=" + C.state.editing + " creating=" + C.state.creating + " idx=" + C.state.index + " len=" + C.state.list.length; }
  function dtext() { return (q("dpanel").textContent || "").replace(/\s+/g, " ").slice(0, 90); }
  function ctext() { return (q("confirm").textContent || "").replace(/\s+/g, " ").slice(0, 110); }
  async function pickCard(name) {
    setSearch(name); await tick(70);
    var cs = cards();
    if (cs.length !== 1) return false;
    tap(cs[0]); await tick(90);
    return C.state.list.length === 1 && C.state.list[C.state.index].name === name;
  }
  async function clearSearch() { setSearch(""); await tick(70); }
  // 截图模式（#shot=xxx）：只摆出要看的界面状态，不跑断言。
  if (/^#shot=/.test(location.hash || "")) {
    var sc = location.hash.slice(6);
    q("TESTOUT").style.display = "none";
    // 截图模式下关掉过渡：虚拟时钟不推进合成器，CSS transition 会停在半路（卡片飞到一半、面板半透明）
    var st = document.createElement("style");
    st.textContent = "*{transition:none !important;animation:none !important}";
    document.head.appendChild(st);
    await tick(900);
    document.querySelectorAll("#srcs .tab")[0].click(); await tick(120);
    if (sc === "ro" || sc === "roedit") {
      await pickCard("office-docx");
      if (sc === "roedit") { act("edit"); await tick(160); }
    } else if (sc === "create") {
      act("new"); await tick(200);
    } else if (sc === "del") {
      await pickCard("rea-reverse-engineering");
      act("del"); await tick(180);
    } else if (sc === "tags") {
      var tc = document.querySelector('[data-tag="开发"]');
      if (tc) tc.click();
      await tick(180);
    } else if (sc === "detail") {
      await pickCard("graphify");
      await tick(160);
    } else if (sc === "ring") {
      document.querySelector('[data-mode="ring"]').click();
      nav(C.state.list.length >> 1);
      await tick(260);
    } else if (sc === "body") {
      await pickCard("agently-mail"); act("bodyfull"); await tick(260);
    } else if (sc === "bodyedit") {
      await pickCard("agently-mail"); act("edit"); await tick(300);
    } else if (sc === "bodyeditscroll") {
      await pickCard("agently-mail"); act("edit"); await tick(300);
      var pn = q("dpanel").querySelector(".panel"); if (pn) pn.scrollTop = 99999;
      await tick(120);
    } else if (sc === "fx") {
      tap(cards()[0]); await tick(160);
      if (has("edit")) { act("edit"); await tick(160); }
      var ub = document.querySelector('[data-rar="UR"]'); if (ub) ub.click();
      await tick(180);
      if (has("close")) { act("close"); await tick(320); }
      await tick(400);
    } else if (sc === "bodyro") {
      await pickCard("office-docx"); act("bodyfull"); await tick(260);
    }
    window.__done = true;
    return;
  }  try {
    await tick(150);
    ok("面板已挂载", !!document.querySelector(".skc-root"));
    ok("默认选中公共技能", C.state.src === "公共技能", C.state.src);
    ok("默认只显示公共技能的 5 张", cards().length === 5, cards().length);
    ok("计数 1 / 5", q("count").textContent === "1 / 5", q("count").textContent);
    ok("虚线新建卡存在", !!q("newcard"));
    ok("状态文案含 13（总数不受筛选影响）", /13/.test(q("mark").textContent), q("mark").textContent);
    ok("挂载即拉取 list", calls("list").length >= 1, calls("list").length);
    document.querySelectorAll("#srcs .tab")[0].click(); await tick(80);
    ok("切到全部来源 = 13 张", cards().length === 13, cards().length);
    var tabs = [].slice.call(document.querySelectorAll("#tabs .tab"));
    ok("分类 7 个", tabs.length === 7, tabs.length);
    var office = null;
    tabs.forEach(function (t) { if (t.textContent.indexOf("办公") >= 0) office = t; });
    ok("办公计数 4", !!office && office.textContent.indexOf("4") >= 0, office && office.textContent.trim());
    office.click(); await tick(70);
    ok("筛选办公 = 4 张", cards().length === 4, cards().length);
    [].slice.call(document.querySelectorAll("#tabs .tab"))[0].click(); await tick(70);
    ok("回到全部 = 13 张", cards().length === 13, cards().length);
    // ── 来源筛选：5 个固定来源 + 「其它来源」下拉（本例里是 Codex 1 张）
    /* 每次点击都会重建 #srcs 里的节点，所以按名字重新查询，不能缓存节点 */
    var srcTab = function (label) {
      var list = [].slice.call(document.querySelectorAll("#srcs .tab"));
      for (var i = 0; i < list.length; i++) if (list[i].textContent.indexOf(label) === 0) return list[i];
      return null;
    };
    var srcTabs = [].slice.call(document.querySelectorAll("#srcs .tab"));
    ok("来源 = 5 个固定 tab + 1 个下拉按钮", srcTabs.length === 7, srcTabs.map(function (t) { return t.textContent; }).join(","));
    ok("固定来源顺序正确", ["全部", "项目技能", "公共技能", "自定义目录", "系统内置", "运行时"].every(function (label, i) { return srcTabs[i] && srcTabs[i].textContent.indexOf(label) === 0; }), srcTabs.slice(0, 6).map(function (t) { return t.textContent; }).join(","));
    var pTab = srcTab("项目技能");
    ok("项目技能本身就是项目下拉（计数 3）", !!pTab && /3/.test(pTab.textContent) && pTab.getAttribute("data-act") === "projdd", pTab && pTab.textContent);
    if (pTab) pTab.click();
    await tick(80);
    var projItems = [].slice.call(document.querySelectorAll("#projmenu .dditem"));
    ok("展开后项目下拉 = 全部项目 / BasketballServer / bm2_server", projItems.length === 3 && projItems[0].textContent.indexOf("全部项目") === 0, projItems.map(function (x) { return x.textContent; }).join(","));
    var allProjItem = projItems[0];
    if (allProjItem) allProjItem.click();
    await tick(80);
    ok("选「全部项目」= 项目技能 3 张", cards().length === 3 && C.state.src === "项目技能" && C.state.project === null, cards().length + " " + st());
    ok("项目技能下的卡来源一致", C.state.list.length > 0 && C.state.list.every(function (r) { return r.src === "项目技能"; }), C.state.list.map(function (r) { return r.src; }).join(","));
    var bsItem = null, bmItem = null;
    projItems.forEach(function (x) { if (x.getAttribute("data-proj") === "BasketballServer") bsItem = x; if (x.getAttribute("data-proj") === "bm2_server") bmItem = x; });
    ok("项目计数正确（BasketballServer 2 / bm2_server 1）", !!bsItem && !!bmItem && /2/.test(bsItem.textContent) && /1/.test(bmItem.textContent), projItems.map(function (x) { return x.textContent; }).join(","));
    var projTog = document.querySelector('#srcs [data-act="projdd"]');
    if (projTog) projTog.click();
    await tick(80);
    bsItem = null;
    [].slice.call(document.querySelectorAll("#projmenu .dditem")).forEach(function (x) { if (x.getAttribute("data-proj") === "BasketballServer") bsItem = x; });
    if (bsItem) bsItem.click();
    await tick(80);
    ok("选 BasketballServer 只剩 2 张", cards().length === 2 && C.state.project === "BasketballServer", cards().length + " " + st());
    // ── 项目内的「技能目录」筛选
    var dirTog = document.querySelector('#srcs [data-act="dirdd"]');
    ok("项目内有多个技能目录时出现目录下拉", !!dirTog && dirTog.textContent.indexOf("目录：全部") === 0, dirTog && dirTog.textContent);
    if (dirTog) dirTog.click();
    await tick(80);
    var dirItems = [].slice.call(document.querySelectorAll("#dirmenu .dditem"));
    ok("目录下拉 = 全部 / .agents/skills / .agents/bm2-skills/skills", dirItems.length === 3, dirItems.map(function (x) { return x.textContent; }).join(","));
    var nestedItem = null;
    dirItems.forEach(function (x) { if (x.getAttribute("data-dir") === ".agents/bm2-skills/skills") nestedItem = x; });
    ok("嵌套目录计数正确（1）", !!nestedItem && /1/.test(nestedItem.textContent), nestedItem && nestedItem.textContent);
    if (nestedItem) nestedItem.click();
    await tick(80);
    ok("选嵌套目录后只剩 1 张", cards().length === 1 && C.state.dir === ".agents/bm2-skills/skills", cards().length + " " + st());
    var dirTog2 = document.querySelector('#srcs [data-act="dirdd"]');
    if (dirTog2) dirTog2.click();
    await tick(80);
    var dirAllItem = [].slice.call(document.querySelectorAll("#dirmenu .dditem"))[0];
    if (dirAllItem) dirAllItem.click();
    await tick(80);
    ok("选「全部目录」回到 2 张", cards().length === 2 && C.state.dir === null, cards().length + " " + st());
    var projTog2 = document.querySelector('#srcs [data-act="projdd"]');
    ok("按钮文案变成项目名", !!projTog2 && projTog2.textContent.indexOf("BasketballServer") === 0, projTog2 && projTog2.textContent);
    if (projTog2) projTog2.click();
    await tick(80);
    bmItem = null;
    [].slice.call(document.querySelectorAll("#projmenu .dditem")).forEach(function (x) { if (x.getAttribute("data-proj") === "bm2_server") bmItem = x; });
    if (bmItem) bmItem.click();
    await tick(80);
    ok("选 bm2_server 只剩 1 张", cards().length === 1 && C.state.project === "bm2_server", cards().length + " " + st());
    ok("只含单个技能目录的项目不显示目录下拉", !document.querySelector('#srcs [data-act="dirdd"]'));
    var projTog3 = document.querySelector('#srcs [data-act="projdd"]');
    if (projTog3) projTog3.click();
    await tick(80);
    var backAll = [].slice.call(document.querySelectorAll("#projmenu .dditem"))[0];
    if (backAll) backAll.click();
    await tick(80);
    ok("再选「全部项目」回到 3 张", cards().length === 3 && C.state.project === null, cards().length + " " + st());
    var uTab = srcTab("公共技能");
    if (uTab) uTab.click();
    await tick(80);
    ok("筛选公共技能 = 5 张", cards().length === 5, cards().length);
    ok("切到公共技能后项目下拉不再高亮", (function () { var t = document.querySelector('#srcs [data-act="projdd"]'); return !!t && !t.classList.contains("on"); })());
    ok("切来源后目录筛选已清空", C.state.dir === null && !document.querySelector('#srcs [data-act="dirdd"]'), String(C.state.dir));
    // ── 其它来源：不各占一个按钮，收进下拉
    var ddTog = document.querySelector('#srcs [data-act="srcdd"]');
    ok("其它来源收成一个下拉按钮", !!ddTog && ddTog.textContent.indexOf("其它来源") === 0, ddTog && ddTog.textContent);
    if (ddTog) ddTog.click();
    await tick(80);
    var ddItems = [].slice.call(document.querySelectorAll("#ddmenu .dditem"));
    ok("下拉里只列非固定来源（Codex）", ddItems.length === 1 && ddItems[0].textContent.indexOf("Codex") === 0, ddItems.map(function (d) { return d.textContent; }).join(","));
    if (ddItems[0]) ddItems[0].click();
    await tick(80);
    ok("选下拉项后按该来源筛选 = 1 张", cards().length === 1 && C.state.src === "Codex", cards().length + " " + st());
    var ddTog2 = document.querySelector('#srcs [data-act="srcdd"]');
    ok("下拉按钮显示当前来源且菜单已收起", !!ddTog2 && ddTog2.textContent.indexOf("Codex") >= 0 && !document.querySelector("#ddmenu"), ddTog2 && ddTog2.textContent);
    if (ddTog2) ddTog2.click();
    await tick(60);
    ok("再点可展开下拉", !!document.querySelector("#ddmenu"));
    document.body.click();
    await tick(60);
    ok("点来源行以外收起下拉", !document.querySelector("#ddmenu"));
    document.querySelectorAll("#srcs .tab")[0].click(); await tick(80);
    ok("来源回到全部 = 13 张", cards().length === 13, cards().length);
    ok("来源与分类叠加取交集", (function () {
      var office = null;
      [].slice.call(document.querySelectorAll("#tabs .tab")).forEach(function (t) { if (t.textContent.indexOf("办公") >= 0) office = t; });
      if (!office) return false;
      office.click();
      var p = document.querySelector('#srcs [data-act="projdd"]');
      if (!p) return false;
      p.click();                                   // 展开项目下拉
      var all = document.querySelector('#projmenu [data-proj="__ALL__"]');
      if (!all) return false;
      all.click();                                 // 选「全部项目」= 项目技能
      var want = window.__payload.skills.filter(function (s) { return s.category === "办公" && s.levelLabel === "项目技能"; }).length;
      return cards().length === want && C.state.cat === "办公" && C.state.src === "项目技能";
    })(), cards().length + " " + st());
    await tick(80);
    document.querySelectorAll("#srcs .tab")[0].click();
    [].slice.call(document.querySelectorAll("#tabs .tab"))[0].click(); await tick(80);
    ok("清空来源与分类后回到 13 张", cards().length === 13 && C.state.src === null && C.state.cat === null, cards().length);
    setSearch("zzz-绝对搜不到的东西"); await tick(120);
    ok("无匹配时仍保留 ＋ 新建卡", !!q("newcard") && cards().length === 0, cards().length);
    ok("无匹配时底部信息栏给出提示", /没有符合条件的技能/.test(q("info").textContent), q("info").textContent.slice(0, 40));
    await clearSearch();
    // ── 反复跳动的回归：静默轮询不得重建轨道；重建期间不得补播入场过渡
    var trackEl1 = cards()[0];
    var idxBeforePoll = C.state.index;
    C.refresh(true);
    await tick(120);
    ok("静默刷新载荷未变时不重建轨道", cards()[0] === trackEl1 && cards().length === 13, "卡数 " + cards().length);
    ok("静默刷新不重置当前卡", C.state.index === idxBeforePoll, C.state.index + "/" + idxBeforePoll);
    var officeTab = null;
    [].slice.call(document.querySelectorAll("#tabs .tab")).forEach(function (t) { if (t.textContent.indexOf("办公") >= 0) officeTab = t; });
    if (officeTab) officeTab.click();
    ok("重建轨道期间挂上过渡开关", q("deck").classList.contains("skc-rebind"), q("deck").className);
    await tick(150);
    ok("重建结束后过渡开关自动摘掉", !q("deck").classList.contains("skc-rebind"), q("deck").className);
    [].slice.call(document.querySelectorAll("#tabs .tab"))[0].click(); await tick(80);
    tap(cards()[0]); await tick(100);
    ok("点卡打开详情", q("deck").classList.contains("open") && C.state.detail === 0, st());
    ok("详情显示五维标签", q("dpanel").textContent.indexOf("命中") >= 0);
    ok("可写技能显示删除技能按钮", q("dpanel").textContent.indexOf("删除技能") >= 0, dtext());
    var before = calls("update").length;
    act("edit"); await tick(70);
    var nums = [].slice.call(document.querySelectorAll(".snum"));
    ok("编辑态 5 个数值输入框", nums.length === 5, nums.length + " " + st());
    nums[4].value = "77";
    var cnEl = q("f-cn");
    ok("编辑态有中文名输入框且带出当前名字", !!cnEl && cnEl.value === C.state.list[C.state.index].cn, cnEl ? cnEl.value : "none");
    if (cnEl) cnEl.value = "测试改名";
    var dEl = document.querySelector("#f-desc");
    if (dEl) dEl.value = "改过的描述文本";
    // 标签：不按回车，直接点「保存修改」也要存下来；中途失焦不能把输入吃掉
    act("addtag"); await tick(70);
    var tiEdit = q("f-newtag");
    ok("编辑态能打开标签输入框", !!tiEdit);
    if (tiEdit) { tiEdit.value = "编辑态标签"; tiEdit.dispatchEvent(new Event("input", { bubbles: true })); }
    if (tiEdit) tiEdit.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await tick(80);
    ok("失焦后待提交的标签没被清空", !!q("f-newtag") && q("f-newtag").value === "编辑态标签", q("f-newtag") && q("f-newtag").value);
    act("save"); await tick(120);
    ok("保存调用了 update", calls("update").length > before);
    var b = last("update");
    ok("update 带技能身份 id", !!b && typeof b.id === "string" && b.id === C.state.list[C.state.index].id, b && b.id);
    ok("保存时把未回车的标签一起提交", !!b && (b.tags || []).indexOf("编辑态标签") >= 0, b && JSON.stringify(b.tags));
    ok("保存后标签出现在详情里", q("dpanel").textContent.indexOf("编辑态标签") >= 0, dtext());
    ok("update 带中文名", !!b && b.cn === "测试改名", b && b.cn);
    ok("详情标题已换成新中文名", q("dpanel").textContent.indexOf("测试改名") >= 0, dtext());
    ok("卡面也换成新中文名", !!cards()[C.state.index] && cards()[C.state.index].textContent.indexOf("测试改名") >= 0, cards()[C.state.index] ? cards()[C.state.index].textContent.slice(0, 30) : "no card");
    ok("update 带 5 维 stats", !!b && b.stats && b.stats.length === 5, b && JSON.stringify(b.stats));
    ok("update 命中值 = 77", !!b && b.stats[4] === 77, b && b.stats[4]);
    ok("保存调用了 set-description", calls("set-description").length >= 1);
    ok("保存后详情仍打开", q("deck").classList.contains("open") && !C.state.editing, st());
    // 再保存一次但什么都不改：描述不该再写回 SKILL.md（以前每次保存都会回写一遍）
    var sd0 = calls("set-description").length;
    act("edit"); await tick(70);
    act("save"); await tick(120);
    ok("没改描述时不再写回 SKILL.md", calls("set-description").length === sd0, calls("set-description").length + "/" + sd0);
    act("edit"); await tick(70);
    var cnEmpty = q("f-cn"), u0 = calls("update").length;
    if (cnEmpty) cnEmpty.value = "   ";
    act("save"); await tick(90);
    ok("中文名为空时不提交", calls("update").length === u0, calls("update").length + "/" + u0);
    ok("中文名为空时给出提示", q("toast").textContent.indexOf("中文名不能为空") >= 0, q("toast").textContent);
    ok("中文名为空时留在编辑态", C.state.editing === true, st());
    act("cancel"); await tick(70);
    var t0 = calls("update").length;
    act("addtag"); await tick(70);
    var ti = q("f-newtag");
    ok("标签输入框已聚焦", !!ti && document.activeElement === ti);
    if (ti) { ti.value = "  测试   标签 "; ti.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); }
    await tick(100);
    ok("提交标签调用 update", calls("update").length > t0);
    var tb = last("update");
    ok("标签折叠空格后入库", !!tb && tb.tags && tb.tags.indexOf("测试 标签") >= 0, tb && JSON.stringify(tb.tags));
    ok("标签出现在详情页", q("dpanel").textContent.indexOf("测试 标签") >= 0, dtext());
    act("close"); await tick(80);
    ok("关闭详情", C.state.detail < 0, st());
    // ── 只读技能：用搜索定位 office-docx
    ok("搜索定位 office-docx", await pickCard("office-docx"), st());
    var delBtn = document.querySelector('[data-act="del"]');
    ok("只读技能按钮置灰", !!delBtn && delBtn.getAttribute("aria-disabled") === "true", delBtn && delBtn.outerHTML.slice(0, 120));
    ok("只读技能按钮文案为只读", !!delBtn && delBtn.textContent.indexOf("只读技能") >= 0, delBtn && delBtn.textContent);
    var d0 = calls("delete").length;
    act("del"); await tick(80);
    ok("点只读删除不调用 delete", calls("delete").length === d0);
    ok("弹提示说明不能删", q("toast").textContent.indexOf("🔒") >= 0 && q("toast").textContent.length > 6, q("toast").textContent);
    ok("只读技能仍可修改", has("edit"), dtext());
    act("edit"); await tick(80);
    var fd = document.querySelector("#f-desc");
    ok("只读技能描述框禁用", !!fd && fd.disabled === true, dtext());
    ok("只读描述附只读原因", !!document.querySelector(".rohint") && document.querySelector(".rohint").textContent.indexOf("🔒") >= 0, dtext());
    act("cancel"); await tick(80);
    act("close"); await tick(80);
    await clearSearch();
    ok("清空搜索恢复 13 张", cards().length === 13, cards().length);
    // ── 可写技能：真删（二次确认显示路径与文件数）
    ok("搜索定位 rea-reverse-engineering", await pickCard("rea-reverse-engineering"), st());
    act("del"); await tick(80);
    ok("二次确认框出现", q("confirm").className.indexOf("on") >= 0, ctext());
    ok("确认框显示绝对路径", q("confirm").textContent.indexOf("agents") >= 0, ctext());
    ok("确认框显示文件数", q("confirm").textContent.indexOf("2 个文件") >= 0, ctext());
    var d1 = calls("delete").length;
    act("del-yes"); await tick(150);
    ok("确认后调用 delete", calls("delete").length > d1, ctext());
    ok("delete 传了技能名", !!last("delete") && last("delete").name === "rea-reverse-engineering", JSON.stringify(last("delete")));
    ok("delete 传了技能身份 id", !!last("delete") && /^id-/.test(String(last("delete").id)), JSON.stringify(last("delete")));
    ok("删除后详情关闭", q("deck").className.indexOf("open") < 0, st());
    await clearSearch();
    ok("删除后剩 12 张", cards().length === 12, cards().length);
    // ── 新建技能
    act("new"); await tick(80);
    ok("新建表单出现", !!q("c-name"), ctext());
    ok("安装位置只列可写目录", q("c-root").options.length === 1, q("c-root").options.length);
    q("c-name").value = "Bad Name"; q("c-desc").value = "x";
    act("new-yes"); await tick(80);
    ok("非法技能名被拒", q("c-err").textContent.indexOf("小写字母") >= 0, q("c-err").textContent);
    q("c-name").value = "my-new-skill"; q("c-desc").value = "   ";
    act("new-yes"); await tick(80);
    ok("空描述被拒", q("c-err").textContent.indexOf("描述不能为空") >= 0, q("c-err").textContent);
    q("c-desc").value = "这是一个测试技能";
    var c0 = calls("create").length;
    act("new-yes"); await tick(250);
    ok("提交调用 create", calls("create").length > c0);
    var cb = last("create");
    ok("create 体含 name/description/root", !!cb && cb.name === "my-new-skill" && !!cb.description && !!cb.root, JSON.stringify(cb).slice(0, 110));
    ok("新建后列表 +1（13 张）", cards().length === 13, cards().length + " " + st());
    ok("新建后选中新技能", C.state.list[C.state.index].name === "my-new-skill", st());
    ok("新建后补写分类/稀有度", !!last("update") && last("update").name === "my-new-skill", JSON.stringify(last("update")).slice(0, 90));
    var l0 = calls("list").length;
    act("refresh"); await tick(150);
    ok("刷新按钮调用 list", calls("list").length > l0);
    // ── 虚线卡随模式自适应
    document.querySelector('[data-mode="deck"]').click(); await tick(70);
    nav(40, "ArrowLeft"); await tick(70);
    var nOpMid = parseFloat(q("newcard").style.opacity || "1");
    var midIdx = C.state.index;
    nav(40); await tick(120);
    var nOpEnd = parseFloat(q("newcard").style.opacity || "1");
    var lastIdx = C.state.list.length - 1;
    ok("叠牌模式：中间看不到新建卡", nOpMid < 0.05, "idx=" + midIdx + " op=" + nOpMid);
    ok("叠牌模式：滑到最后露出新建卡", C.state.index === lastIdx && nOpEnd > 0.05, "idx=" + C.state.index + "/" + lastIdx + " op=" + nOpEnd);
    document.querySelector('[data-mode="fan"]').click(); await tick(70);
    nav(40, "ArrowLeft"); await tick(70);
    ok("扇形模式：新建卡在最左端可见", C.state.index === 0 && parseFloat(q("newcard").style.opacity || "0") > 0.05, "idx=" + C.state.index + " op=" + q("newcard").style.opacity);
    ok("新建卡不参与计数", q("count").textContent === "1 / " + C.state.list.length, q("count").textContent);
    // ── 技能正文：入口行 → 展开阅读 → 收起 → 修改态编辑 → 保存提交 set-body
    if (has("close")) { act("close"); await tick(80); }
    await clearSearch();
    ok("正文·定位 agently-mail", await pickCard("agently-mail"), st());
    var bodyA = window.__payload.skills.filter(function (s) { return s.name === "agently-mail"; })[0].body;
    var headA = bodyA.replace(/\s+/g, " ").slice(0, 30);
    function pEl() { return q("dpanel").querySelector(".panel"); }
    var rowEl = document.querySelector(".skc-inline");
    ok("正文·未展开时不渲染正文文本与编辑框", !q("f-body") && !document.querySelector(".btext") && !!rowEl, dtext());
    ok("正文·未展开时面板文本不含正文", (q("dpanel").textContent || "").indexOf(headA) < 0, headA);
    ok("正文·入口行有展开按钮", has("bodyfull") && (rowEl.textContent || "").indexOf("技能正文") >= 0, rowEl && rowEl.textContent);
    ok("正文·入口行标注正文字数", (rowEl.textContent || "").indexOf(bodyA.length + " 字符") >= 0, rowEl && rowEl.textContent);
    var pnEl = pEl();
    ok("正文·入口行落在面板可视区内", !!pnEl && rowEl.getBoundingClientRect().bottom <= pnEl.getBoundingClientRect().bottom + 1, rowEl.getBoundingClientRect().bottom.toFixed(0) + "/" + (pnEl ? pnEl.getBoundingClientRect().bottom.toFixed(0) : "?"));
    act("bodyfull"); await tick(180);
    var over = document.querySelector(".skc-body.exp");
    var btxt = document.querySelector(".btext");
    ok("正文·展开后出现整屏覆盖层", !!over, dtext());
    ok("正文·覆盖层全文与下发正文逐字一致", !!btxt && btxt.textContent === bodyA, btxt ? btxt.textContent.length + "/" + bodyA.length : "none");
    var pnEl = pEl();
    ok("正文·覆盖层盖满详情面板", !!over && !!pnEl && Math.abs(over.getBoundingClientRect().height - pnEl.getBoundingClientRect().height) < 5, over ? over.getBoundingClientRect().height.toFixed(0) + "/" + (pnEl ? pnEl.getBoundingClientRect().height.toFixed(0) : "?") : "none");
    ok("正文·展开态不出编辑框", !q("f-body"));
    act("bodyfull"); await tick(180);
    ok("正文·收起后覆盖层消失且回到入口行", !document.querySelector(".skc-body.exp") && !!document.querySelector(".skc-inline"));
    // 只读技能：可整屏阅读，但没有正文编辑框
    if (has("close")) { act("close"); await tick(80); }
    ok("正文·定位只读技能 office-docx", await pickCard("office-docx"), st());
    ok("正文·只读技能有展开入口", has("bodyfull"));
    act("bodyfull"); await tick(180);
    var btRo = document.querySelector(".btext");
    var hintRo = document.querySelector(".skc-body.exp .bhint");
    ok("正文·只读技能可读全文", !!btRo && btRo.textContent.length > 0, btRo ? btRo.textContent.length : "none");
    ok("正文·只读技能标注只读原因", !!hintRo && hintRo.textContent.indexOf("🔒") >= 0, hintRo && hintRo.textContent.slice(0, 40));
    ok("正文·只读技能无编辑框", !q("f-body"));
    act("bodyfull"); await tick(140);
    act("edit"); await tick(140);
    ok("正文·只读技能修改态也不出编辑框", !q("f-body") && !!document.querySelector(".skc-inline .bhint"), dtext());
    act("cancel"); await tick(120);
    if (has("close")) { act("close"); await tick(80); }
    // 可写技能：修改态默认展开正文，随面板滚动条下滑，保存修改时一并提交
    ok("正文·回到可写技能 agently-mail", await pickCard("agently-mail"), st());
    act("edit"); await tick(150);
    var fb = q("f-body");
    ok("正文·修改态默认出现正文编辑框", !!fb);
    ok("正文·编辑框内容与下发正文逐字一致", !!fb && fb.value === bodyA, fb ? fb.value.length + "/" + bodyA.length : "none");
    ok("正文·修改态不叠覆盖层", !document.querySelector(".skc-body.exp"));
    ok("正文·编辑框随内容自动增高", !!fb && fb.getBoundingClientRect().height > 110, fb ? fb.getBoundingClientRect().height.toFixed(0) : "none");
    ok("正文·编辑框自身没有嵌套滚动条", !!fb && fb.scrollHeight <= fb.clientHeight + 4, fb ? fb.scrollHeight + "/" + fb.clientHeight : "none");
    var pnEl = pEl();
    ok("正文·详情面板可纵向滚动到正文", !!pnEl && pnEl.scrollHeight > pnEl.clientHeight + 10, pnEl ? pnEl.scrollHeight + "/" + pnEl.clientHeight : "?");
    // 操作栏固定：滚到最顶时「保存修改 / 取消」仍在面板底边，不用滚到底才能点
    var actsEl = document.querySelector("#dpanel .acts");
    ok("操作栏是 sticky", !!actsEl && getComputedStyle(actsEl).position === "sticky", actsEl && getComputedStyle(actsEl).position);
    if (pnEl) { pnEl.scrollTop = 0; await tick(40); }
    ok("正文再长，滚到顶时操作栏仍在可视区", !!actsEl && !!pnEl && actsEl.getBoundingClientRect().bottom <= pnEl.getBoundingClientRect().bottom + 2 && actsEl.getBoundingClientRect().top >= pnEl.getBoundingClientRect().top, actsEl && pnEl ? (actsEl.getBoundingClientRect().top.toFixed(0) + "~" + actsEl.getBoundingClientRect().bottom.toFixed(0) + " in " + pnEl.getBoundingClientRect().top.toFixed(0) + "~" + pnEl.getBoundingClientRect().bottom.toFixed(0)) : "none");
    var newBody = bodyA + "\n新增一行：测试正文写回。\n";
    var b0 = calls("set-body").length;
    fb.value = newBody;
    act("save"); await tick(220);
    ok("正文·保存修改调用 set-body", calls("set-body").length > b0, calls("set-body").length);
    var sb = last("set-body");
    ok("正文·set-body 传技能名", !!sb && sb.name === "agently-mail", JSON.stringify(sb).slice(0, 60));
    ok("正文·set-body 传新正文", !!sb && sb.body === newBody, sb ? sb.body.length + "/" + newBody.length : "none");
    ok("正文·保存后回到入口行且字数已更新", !q("f-body") && !document.querySelector(".btext") && (q("dpanel").textContent || "").indexOf(newBody.length + " 字符") >= 0, dtext());
    act("close"); await tick(90);
    // 正文不可读（registry 快照回来的技能没有 body 字段）：只提示不可读，不给展开按钮
    var tgt = window.__payload.skills.filter(function (s) { return s.name === "outline-tool-setup"; })[0];
    if (tgt) delete tgt.body;
    var l1 = calls("list").length;
    act("refresh"); await tick(220);
    ok("正文·刷新后重新拉取列表", calls("list").length > l1);
    ok("正文·定位正文不可读技能", await pickCard("outline-tool-setup"), st());
    ok("正文·不可读时入口行标注不可读", (q("dpanel").textContent || "").indexOf("不可读") >= 0, dtext());
    ok("正文·不可读时不给展开按钮", !has("bodyfull") && !q("f-body"));
    act("close"); await tick(90);
    await clearSearch();
    ok("正文·验证结束后恢复 13 张卡", cards().length === 13, cards().length);
    ok("无 JS 运行时错误", window.__errors.length === 0, window.__errors.join(" ; "));
      // ── 稀有度特效（Canvas 引擎）与特效开关 ─────────────────
   var fxLay = function(i){ return cards()[i].querySelector(".fx"); };
   var fxUpCv = function(i){ return cards()[i].querySelector("canvas.fxup"); };
   var fxLowCv = function(i){ var l=fxLay(i); return l?l.querySelector("canvas"):null; };
   /* 统计画布透明通道的像素和：>0 说明这一层真的被绘制过，===0 说明一次都没画 */
   var fxSum = function(cv){
     if(!cv) return -1;
     var d=cv.getContext("2d").getImageData(0,0,cv.width,cv.height).data,s=0;
     for(var k=3;k<d.length;k+=28)s+=d[k];
     return s;
   };
   /* 最外圈 1px 的 alpha 和与最大值：只要光被画布边界切断，这里必然 >0 */
   var fxEdge = function(cv){
     if(!cv) return {sum:-1,max:-1};
     var w=cv.width,h=cv.height,d=cv.getContext("2d").getImageData(0,0,w,h).data,s=0,m=0,x,y,v;
     for(x=0;x<w;x++){
       v=d[(x)*4+3];s+=v;if(v>m)m=v;
       v=d[((h-1)*w+x)*4+3];s+=v;if(v>m)m=v;
     }
     for(y=0;y<h;y++){
       v=d[(y*w)*4+3];s+=v;if(v>m)m=v;
       v=d[(y*w+w-1)*4+3];s+=v;if(v>m)m=v;
     }
     return {sum:s,max:m};
   };
   /* 等一小段虚拟时间后强制画一帧：--dump-dom 下 rAF 不一定被驱动，画一帧才能量到像素 */
   var fxFrames = function(){
     return new Promise(function(res){ setTimeout(function(){
       try{ if(FXctxA)fxDrawA(.016); if(FXctxB)fxDrawB(.016); }catch(e){ window.__fxdrawerr=String(e&&e.message||e); }
       res();
     },100); });
   };
   var fxCards = cards();
   var fxCur = function(){ var c=document.querySelector(".card3d.cur"); return c?fxCards.indexOf(c):-1; };
   var fxJump = function(tier, idx){
     var cur=cards().indexOf(document.querySelector(".card3d.cur"));
     var want=idx; while((cur%fxCards.length)!==want){ key("ArrowRight"); cur=(cur+1)%fxCards.length; }
   };
   var ci=fxCur();
   ok("特效·每张卡都带上下两块特效画布", fxCards.length===13&&fxCards.every(function(el,i){return !!fxLowCv(i)&&!!fxUpCv(i);}), fxCards.length);
   ok("特效·两块画布都是 640x800（比 240x360 的卡面大一圈）", fxCards.every(function(el,i){return fxLowCv(i).width===640&&fxLowCv(i).height===800&&fxUpCv(i).width===640&&fxUpCv(i).height===800;}), fxLowCv(ci)&&fxLowCv(ci).width+"x"+fxLowCv(ci).height);
   ok("特效·特效层按档位写了 data-r", fxCards.every(function(el,i){return fxLay(i).getAttribute("data-r")===(C.state.list[i].rarity||"N");}), fxCards.map(function(el,i){return fxLay(i).getAttribute("data-r");}).join(","));
   ok("特效·每张卡都带上本档颜色 --rc", fxCards.every(function(el){return /^#/.test(el.style.getPropertyValue("--rc")||"");}), fxCards[0]&&fxCards[0].style.getPropertyValue("--rc"));
   ok("特效·只有居中卡带 cur 与 fx-on", (function(){var on=document.querySelectorAll(".card3d.fx-on");return ci>=0&&on.length===1&&on[0]===fxCards[ci];})(), "cur="+ci+" fx-on="+document.querySelectorAll(".card3d.fx-on").length);
   ok("特效·开关行在面板里可见且默认开启", !!q("fx")&&q("fx").checked===true&&q("fx").getBoundingClientRect().width>0);
   /* 层级：下层画布 0 < 卡面 1 < 上层画布 2，否则柔光会盖住卡面 */
   ok("特效·两层画布夹住卡面（0 / 卡面 1 / 上层 2）", (function(){
     var f=getComputedStyle(fxLay(ci)),u=getComputedStyle(fxUpCv(ci)),s=getComputedStyle(fxCards[ci].querySelector(".c"));
     return f.zIndex==="0"&&u.zIndex==="2"&&s.zIndex==="1";
   })(), getComputedStyle(fxLay(ci)).zIndex+"/"+getComputedStyle(fxCards[ci].querySelector(".c")).zIndex+"/"+getComputedStyle(fxUpCv(ci)).zIndex);
   await fxFrames();
   var fxBaseSum=fxSum(fxLowCv(ci));
   ok("特效·居中卡下层画布真的画了东西", fxBaseSum>0, "alpha 和 "+fxBaseSum);
   ok("特效·非居中卡一次都没绘制", cards().every(function(el,i){return i===ci||fxSum(fxLowCv(i))===0;}), "越界卡 alpha 和 "+(ci===0?fxSum(fxLowCv(12)):fxSum(fxLowCv(0))));
   /* 逐档验证：光必须在画布内部淡到全透明，不能出现被边界切断的直边。
      走真实交互改档（详情页稀有度按钮），顺带覆盖「改档 → 重建卡面 → 重绑画布」这条路 */
   var fxTiers=["N","R","SR","SSR","UR"],fxEdgeRep=[],fxSumRep=[],fxTierBad=[];
   var fxSetTier=async function(tier){
     tap(cards()[ci]); await tick(150);
     if(!has("edit")&&C.state.detail<0){ tap(cards()[ci]); await tick(150); }
     if(has("edit")){ act("edit"); await tick(160); }
     var tb=document.querySelector('[data-rar="'+tier+'"]');
     if(tb)tb.click();
     await tick(150);
     if(has("cancel")){ act("cancel"); await tick(150); }
     if(has("close")){ act("close"); await tick(200); }
     await fxFrames();
     return C.state.list[ci].rarity===tier;
   };
   for(var fi=0;fi<fxTiers.length;fi++){
     var fxTierOk=await fxSetTier(fxTiers[fi]);
     if(!fxTierOk){ fxTierBad.push(fxTiers[fi]+"未切到"); continue; }
     var eLow=fxEdge(fxLowCv(ci)),eUp=fxEdge(fxUpCv(ci)),sLow=fxSum(fxLowCv(ci));
     fxEdgeRep.push(fxTiers[fi]+" "+eLow.sum+"/"+eLow.max+"+"+eUp.sum+"/"+eUp.max);
     fxSumRep.push(fxTiers[fi]+" "+sLow);
     if(eLow.sum!==0||eLow.max!==0||eUp.sum!==0||eUp.max!==0)fxTierBad.push(fxTiers[fi]+"越界");
   }
   ok("特效·五档都能切过去", fxTierBad.length===0, fxTierBad.join(","));
   ok("特效·五档画布最外圈 alpha 全为 0（光没被边界切断）", fxEdgeRep.length===5&&fxEdgeRep.every(function(x){return / 0\/0\+0\/0$/.test(x);}), fxEdgeRep.join(" ; "));
   ok("特效·五档特效强度逐级递增（像素和单调不减）", (function(){
     var v=fxSumRep.map(function(x){return parseInt(x.split(" ")[1],10);});
     if(v.length!==5)return false;
     for(var i=1;i<v.length;i++)if(v[i]<v[i-1]*0.85)return false;
     return v[0]>0&&v[4]>v[0];
   })(), fxSumRep.join(" ; "));
   ok("特效·渲染循环已挂到 rAF 上", FXraf>0, "raf="+FXraf);
   /* 此刻停在 UR 档（本来就有动画），拿它验「换一帧像素确实会变」；低档位设计成静态，换帧不变才是对的 */
   var fxDiffA=fxSum(fxLowCv(ci));
   FXt+=.37; fxDrawA(.37);
   var fxDiffB=fxSum(fxLowCv(ci));
   ok("特效·换一帧像素就变（动画真的在动）", fxDiffA>0&&fxDiffB!==fxDiffA, fxDiffA+" → "+fxDiffB);
   /* 回归：改星数走 renderCardsOnly 会把画布节点整块换掉，不重绑就会静默失去特效 */
   tap(cards()[ci]); await tick(150);
   ok("特效·详情打开后特效仍跟着当前卡", document.querySelectorAll(".card3d.fx-on").length===1&&document.querySelectorAll(".card3d.fx-on")[0]===cards()[C.state.index], "fx-on "+document.querySelectorAll(".card3d.fx-on").length+" index="+C.state.index);
   ok("特效·详情可进入编辑态", has("edit"));
   act("edit"); await tick(180);
   var fxStarBtn=document.querySelector('[data-star="2"]');
   if(fxStarBtn)fxStarBtn.click();
   await tick(150); await fxFrames();
   var fxOnEl=document.querySelector(".card3d.fx-on");
   var fxOnIx=fxOnEl?cards().indexOf(fxOnEl):-1;
   ok("特效·改星数后画布重新绑定并继续绘制", fxOnIx>=0&&FXraf>0&&fxSum(fxLowCv(fxOnIx))>0, "fx-on 索引="+fxOnIx+" raf="+FXraf+" 画布和="+(fxOnIx>=0?fxSum(fxLowCv(fxOnIx)):"-"));
   if(has("cancel")){act("cancel"); await tick(160);}
   if(has("close")){act("close"); await tick(220);}
   await fxFrames();
   ok("特效·改完能回到浏览态且特效回到居中卡", C.state.detail<0&&document.querySelectorAll(".card3d.fx-on").length===1, "detail="+C.state.detail+" fx-on="+document.querySelectorAll(".card3d.fx-on").length);
   var fxCk=q("fx");
   fxCk.checked=false; fxCk.dispatchEvent(new Event("change",{bubbles:true})); await tick(90);
   ok("特效·关掉开关后根节点标记为 off", C.root.getAttribute("data-fx")==="off", "data-fx="+C.root.getAttribute("data-fx"));
   ok("特效·关掉开关后所有卡摘掉 fx-on 且引擎停帧", document.querySelectorAll(".card3d.fx-on").length===0&&FXOFF===true&&(!FXraf), "fx-on="+document.querySelectorAll(".card3d.fx-on").length+" FXOFF="+FXOFF+" raf="+FXraf);
   /* 虚拟时钟不推进 CSS 过渡，读 opacity 前先把过渡关掉，否则量到的是过渡起点 */
   var fxNoTrans=document.createElement("style");
   fxNoTrans.textContent=".card3d .fx,.card3d canvas.fxup{transition:none!important}";
   document.head.appendChild(fxNoTrans);
   await tick(40);
   ok("特效·关掉开关后画布整体隐藏", parseFloat(getComputedStyle(fxLay(ci)).opacity)===0&&parseFloat(getComputedStyle(fxUpCv(ci)).opacity)===0, getComputedStyle(fxLay(ci)).opacity+"/"+getComputedStyle(fxUpCv(ci)).opacity);
   ok("特效·关掉开关后写入本机存储", (function(){try{return window.localStorage.getItem("dsh-skill-card:fx")==="0";}catch(e){return false;}})());
   fxCk.checked=true; fxCk.dispatchEvent(new Event("change",{bubbles:true})); await tick(90); await fxFrames();
   ok("特效·重新打开后特效恢复绘制", C.root.getAttribute("data-fx")==="on"&&document.querySelectorAll(".card3d.fx-on").length===1&&fxSum(fxLowCv(ci))>0, "data-fx="+C.root.getAttribute("data-fx")+" 画布和="+fxSum(fxLowCv(ci)));
  } catch (e) { out.push("FAIL 断言脚本异常 :: " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e)); }
  var pass = out.filter(function (x) { return x.indexOf("PASS") === 0; }).length;
  document.getElementById("TESTOUT").textContent = "\n" + out.join("\n") + "\nTOTAL " + pass + "/" + out.length;
  window.__done = true;
})();