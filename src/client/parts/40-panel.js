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
