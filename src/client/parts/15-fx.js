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