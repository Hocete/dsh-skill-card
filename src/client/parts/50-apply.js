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
