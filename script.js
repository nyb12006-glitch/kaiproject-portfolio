// Sala de montaje: cada sección es una pista y el scroll mueve el cabezal.
const root=document.documentElement;
const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer=window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const FPS=25;
const $=id=>document.getElementById(id);

// Segundos a timecode HH:MM:SS:FF
function tc(sec){
 const f=Math.floor(sec*FPS);
 const ff=f%FPS,s=Math.floor(f/FPS)%60,m=Math.floor(f/FPS/60)%60,h=Math.floor(f/FPS/3600);
 return [h,m,s,ff].map(n=>String(n).padStart(2,"0")).join(":");
}
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

/* ---------- intro: se salta con clic o tecla ---------- */
if(root.classList.contains("intro-on")){
 const introTc=$("introTc");const t0=performance.now();let done=false;
 const tick=now=>{if(done)return;const s=(now-t0)/1000;introTc.textContent=tc(Math.min(s,1.45)*4);if(s<1.5)requestAnimationFrame(tick);};
 requestAnimationFrame(tick);
 const end=()=>{if(done)return;done=true;root.classList.add("intro-done");
  // si se salta, el titular se "renderiza" ya sin esperar a la intro
  root.classList.remove("intro-on");};
 $("intro").addEventListener("click",end);
 document.addEventListener("keydown",end,{once:true});
 setTimeout(end,2100);
}

/* ---------- hero: monitor de programa ---------- */
const heroVideo=$("heroVideo"),heroTc=$("heroTc"),heroHead=$("heroHead"),heroToggle=$("heroToggle");
if(heroVideo){
 const seq=$("heroSeq");
 const drawHero=()=>{
  const d=heroVideo.duration||10;const p=heroVideo.currentTime/d;
  heroTc.textContent=tc(heroVideo.currentTime);
  heroHead.style.left=`calc(12px + ${p} * (100% - 24px))`;
  if(!heroVideo.paused)requestAnimationFrame(drawHero);
 };
 heroVideo.addEventListener("play",()=>requestAnimationFrame(drawHero));
 heroVideo.addEventListener("seeked",drawHero);
 if(reduced){heroVideo.removeAttribute("autoplay");heroVideo.pause();}
 const setToggle=()=>{const paused=heroVideo.paused;heroToggle.textContent=paused?"▶":"❚❚";heroToggle.dataset.i18nAria=paused?"monitor.resume":"monitor.pause";heroToggle.setAttribute("aria-label",t(heroToggle.dataset.i18nAria));};
 heroToggle.addEventListener("click",()=>{heroVideo.paused?heroVideo.play().catch(()=>{}):heroVideo.pause();});
 heroVideo.addEventListener("play",setToggle);heroVideo.addEventListener("pause",setToggle);
 setToggle();
 // fuera de pantalla se pausa para no gastar batería
 let userPaused=false;heroToggle.addEventListener("click",()=>{userPaused=heroVideo.paused;});
 new IntersectionObserver(([e])=>{if(e.isIntersecting){if(!userPaused&&!reduced)heroVideo.play().catch(()=>{});}else heroVideo.pause();},{threshold:.2}).observe(heroVideo);
 if(seq)seq.addEventListener("click",e=>{const r=seq.getBoundingClientRect();heroVideo.currentTime=clamp((e.clientX-r.left-12)/(r.width-24),0,1)*(heroVideo.duration||10);});
}

/* ---------- línea de tiempo fija + timecode + pestaña activa ---------- */
const timeline=$("timeline"),tlHead=$("tlHead"),tlLanes=$("tlLanes"),tlRuler=$("tlRuler"),tlBody=$("tlBody");
const tcEl=$("tc"),barProgress=$("barProgress");
const TOTAL=150; // duración "virtual" del montaje completo en segundos
const tlMedia=window.matchMedia("(min-width: 861px) and (min-height: 600px)");
const LANES=[ // fila de la línea de tiempo: 0=V3 1=V2 2=V1 3=A1
 {sel:"#inicio",lane:2,c:"c-play"},{sel:"#web",lane:2,c:"c-web"},{sel:"#video",lane:1,c:"c-vid"},
 {sel:"#social",lane:0,c:"c-reel"},{sel:"#canales",lane:3,c:"c-aud"},{sel:"#servicios",lane:0,c:"c-fx"},{sel:"#contacto",lane:3,c:"c-play"}
];
let tlClips=[];
function maxScroll(){return Math.max(1,document.documentElement.scrollHeight-innerHeight);}
function buildTimeline(){
 root.classList.toggle("has-tl",tlMedia.matches);
 if(!tlMedia.matches)return;
 tlLanes.innerHTML="";tlRuler.innerHTML="";tlClips=[];
 const rows=[0,1,2,3].map(()=>{const d=document.createElement("div");d.className="tl-lane";tlLanes.appendChild(d);return d;});
 const H=document.documentElement.scrollHeight;
 for(const l of LANES){
  const s=document.querySelector(l.sel);if(!s)continue;
  const a=s.offsetTop/H,b=(s.offsetTop+s.offsetHeight)/H;
  const c=document.createElement("span");c.className=`tl-clip ${l.c}`;
  c.style.left=`${a*100}%`;c.style.width=`calc(${(b-a)*100}% - 2px)`;
  rows[l.lane].appendChild(c);tlClips.push({el:c,s});
 }
 for(let i=0;i<5;i++){const sp=document.createElement("span");sp.style.left=`${i*20}%`;sp.textContent=tc(TOTAL*i/5).slice(3,8);tlRuler.appendChild(sp);}
}
if(tlBody)tlBody.addEventListener("click",e=>{const r=tlBody.getBoundingClientRect();window.scrollTo({top:clamp((e.clientX-r.left)/r.width,0,1)*maxScroll(),behavior:reduced?"auto":"smooth"});});

const tabs=[...document.querySelectorAll(".tabs a")];
const tabTargets=tabs.map(a=>document.querySelector(a.getAttribute("href")));
function onScrollUI(){
 const p=clamp(scrollY/maxScroll(),0,1);
 if(tcEl)tcEl.textContent=tc(p*TOTAL);
 if(barProgress)barProgress.style.transform=`scaleX(${p})`;
 if(tlHead&&root.classList.contains("has-tl"))tlHead.style.left=`${p*100}%`;
 const mid=scrollY+innerHeight*.4;
 let active=-1;tabTargets.forEach((s,i)=>{if(s&&s.offsetTop<=mid)active=i;});
 tabs.forEach((a,i)=>a.classList.toggle("is-on",i===active));
 for(const c of tlClips)c.el.classList.toggle("is-on",c.s.offsetTop<=mid&&c.s.offsetTop+c.s.offsetHeight>mid);
}

/* ---------- V1: el visor reproduce cada web con el scroll ---------- */
const scrub=$("web"),webScreen=$("webScreen");
const shots=[...document.querySelectorAll(".web-shot")];
const webClips=[...document.querySelectorAll("#webTrack .clip")];
const webHead=$("webHead");
let webIdx=-1;
function setWeb(i){
 if(i===webIdx)return;
 const first=webIdx===-1;webIdx=i;
 shots.forEach((s,k)=>s.classList.toggle("is-on",k===i));
 webClips.forEach((c,k)=>c.classList.toggle("is-on",k===i));
 const c=webClips[i];
 $("webIdx").textContent=i+1;$("webName").textContent=c.dataset.name;$("webUrl").textContent=c.dataset.url;
 const d=$("webDesc");d.dataset.i18n=c.dataset.desc;d.textContent=t(c.dataset.desc);
 $("webLink").href=c.href;
 if(!first&&!reduced){webScreen.classList.remove("is-cutting");void webScreen.offsetWidth;webScreen.classList.add("is-cutting");}
}
const ease=x=>x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2;
function onScrollWeb(){
 if(!scrub||reduced)return;
 const sticky=scrub.firstElementChild;
 const range=scrub.offsetHeight-sticky.offsetHeight;
 const p=clamp((scrollY-scrub.offsetTop+ (parseFloat(getComputedStyle(sticky).top)||0))/range,0,1);
 const n=webClips.length;const pos=p*n;const i=Math.min(n-1,Math.floor(pos));
 setWeb(i);
 const local=clamp(pos-i,0,1);
 const shot=shots[i];const travel=Math.max(0,shot.offsetHeight-webScreen.clientHeight);
 // margen al principio y al final de cada clip para que se lea el arranque y el pie
 shot.style.transform=`translateY(${-travel*ease(clamp((local-.12)/.76,0,1))}px)`;
 if(webHead){const lane=webHead.parentElement;webHead.style.left=`${8+p*(lane.clientWidth-18)}px`;}
}
setWeb(0);
if(reduced){
 // sin scroll que arrastre: se elige la web pasando por encima o con el teclado
 webClips.forEach((c,k)=>{c.addEventListener("mouseenter",()=>setWeb(k));c.addEventListener("focus",()=>setWeb(k));});
 if(webHead)webHead.hidden=true;
}

/* ---------- V2: monitor de origen ---------- */
const srcScreen=$("srcScreen"),srcPoster=$("srcPoster"),srcVideo=$("srcVideo"),srcPlay=$("srcPlay"),srcYt=$("srcYt"),srcName=$("srcName"),srcKind=$("srcKind");
const stripClips=[...document.querySelectorAll(".strip-clip")];
let srcCurrent=stripClips[0];
function clipTitle(c){return c.dataset.titleKey?t(c.dataset.titleKey):c.dataset.title;}
function loadSource(c,cut){
 srcCurrent=c;
 stripClips.forEach(x=>x.classList.toggle("is-on",x===c));
 srcVideo.pause();srcVideo.removeAttribute("src");srcVideo.load();srcVideo.hidden=true;
 srcPoster.src=c.dataset.poster;srcPoster.hidden=false;
 srcName.textContent=clipTitle(c);
 if(c.dataset.kind==="yt"){
  srcKind.removeAttribute("data-i18n");srcKind.textContent="YouTube";
  srcPlay.hidden=true;srcYt.hidden=false;srcYt.href=`https://www.youtube.com/watch?v=${c.dataset.yt}`;
 }else{
  srcKind.dataset.i18n="video.local";srcKind.textContent=t("video.local");
  srcYt.hidden=true;srcPlay.hidden=false;
 }
 if(cut&&!reduced){srcScreen.classList.remove("is-cutting");void srcScreen.offsetWidth;srcScreen.classList.add("is-cutting");}
}
if(srcScreen){
 srcVideo.hidden=true;
 stripClips.forEach(c=>c.addEventListener("click",()=>{loadSource(c,true);if(c.dataset.kind==="local"&&matchMedia("(max-width: 860px)").matches)srcScreen.scrollIntoView({behavior:reduced?"auto":"smooth",block:"center"});}));
 srcPlay.addEventListener("click",()=>{
  srcVideo.src=srcCurrent.dataset.src;srcVideo.poster=srcCurrent.dataset.poster;
  srcVideo.hidden=false;srcPoster.hidden=true;srcPlay.hidden=true;
  srcVideo.play().catch(()=>{});
 });
 // al salir de la sección se pausa
 new IntersectionObserver(([e])=>{if(!e.isIntersecting)srcVideo.pause();},{threshold:0}).observe(srcScreen);
}

/* ---------- V3: multicámara de reels ---------- */
const mc=$("multicam"),mcVideo=$("mcVideo"),mcScreen=$("mcScreen"),mcNum=$("mcNum"),mcLink=$("mcLink"),mcFull=$("mcFull");
const angles=[...document.querySelectorAll(".angle")];
let mcVisible=false,mcFullOn=false;
function playAll(on){
 const vids=[mcVideo,...angles.map(a=>a.querySelector("video"))];
 vids.forEach(v=>{if(on&&!reduced){if(v===mcVideo&&mcFullOn)return;v.preload="auto";v.play().catch(()=>{});}else v.pause();});
}
function setAngle(a,cut){
 angles.forEach(x=>x.classList.toggle("is-on",x===a));
 mcNum.textContent=angles.indexOf(a)+1;
 mcFullOn=false;mcVideo.controls=false;mcVideo.muted=true;mcVideo.loop=true;
 mcVideo.poster=a.dataset.poster;mcVideo.src=a.dataset.src;
 if(mcVisible&&!reduced)mcVideo.play().catch(()=>{});
 if(a.dataset.href){mcLink.hidden=false;mcLink.href=a.dataset.href;mcFull.hidden=true;}
 else{mcLink.hidden=true;mcFull.hidden=false;}
 if(cut&&!reduced){mcScreen.classList.remove("is-cutting");void mcScreen.offsetWidth;mcScreen.classList.add("is-cutting");}
}
if(mc){
 angles.forEach(a=>a.addEventListener("click",()=>setAngle(a,true)));
 mcFull.addEventListener("click",()=>{
  const a=angles.find(x=>x.classList.contains("is-on"));if(!a||!a.dataset.full)return;
  mcFullOn=true;mcVideo.src=a.dataset.full;mcVideo.loop=false;mcVideo.muted=false;mcVideo.controls=true;mcVideo.play().catch(()=>{});
 });
 new IntersectionObserver(([e])=>{mcVisible=e.isIntersecting;playAll(mcVisible);},{threshold:.25}).observe(mc);
}

/* ---------- A1/A2: formas de onda ---------- */
document.querySelectorAll(".wave").forEach((w,k)=>{
 let seed=7+k*13;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 const n=window.innerWidth<700?48:110;const frag=document.createDocumentFragment();
 for(let i=0;i<n;i++){
  const env=.35+.65*Math.abs(Math.sin(i/n*Math.PI*(2.2+k)));
  const b=document.createElement("i");b.style.setProperty("--h",(0.15+rnd()*.85*env).toFixed(2));
  b.style.transitionDelay=`${i*6}ms`;b.style.animationDelay=`${-(i%9)*80}ms`;frag.appendChild(b);
 }
 w.appendChild(frag);
});
const audio=document.querySelector(".audio");
if(audio)new IntersectionObserver(([e],o)=>{if(e.isIntersecting){audio.classList.add("is-in");o.disconnect();}},{threshold:.3}).observe(audio);

/* ---------- fx: panel de efectos ---------- */
const folders=[...document.querySelectorAll(".fx-folder")];
const fxRows=$("fxRows"),fxTitle=$("fxTitle");
let fxCurrent=1;
function renderFx(animate){
 const items=t(`svc${fxCurrent}.items`).split("|");
 fxTitle.textContent=t(`svc${fxCurrent}.title`);
 fxRows.classList.remove("is-in");fxRows.innerHTML="";
 items.forEach((name,r)=>{
  const li=document.createElement("li");li.className="fx-row";
  li.innerHTML=`<span class="fx-badge" aria-hidden="true">fx</span><span class="fx-name"></span><span class="fx-lane" aria-hidden="true"></span>`;
  li.querySelector(".fx-name").textContent=name;
  const lane=li.querySelector(".fx-lane");
  const keys=2+((r+fxCurrent)%3);
  for(let k=0;k<keys;k++){const i=document.createElement("i");i.style.left=`${8+((k*31+r*17+fxCurrent*11)%84)}%`;i.style.transitionDelay=`${r*60+k*70}ms`;lane.appendChild(i);}
  fxRows.appendChild(li);
 });
 if(animate===false||reduced){fxRows.classList.add("is-in");return;}
 void fxRows.offsetWidth;requestAnimationFrame(()=>fxRows.classList.add("is-in"));
}
function selectFolder(f,focus){
 fxCurrent=Number(f.dataset.svc);
 folders.forEach(x=>{const on=x===f;x.setAttribute("aria-selected",on);x.tabIndex=on?0:-1;});
 if(focus)f.focus();
 renderFx(true);
}
folders.forEach((f,i)=>{
 f.addEventListener("click",()=>selectFolder(f));
 f.addEventListener("keydown",e=>{
  let j=null;
  if(e.key==="ArrowDown"||e.key==="ArrowRight")j=(i+1)%folders.length;
  if(e.key==="ArrowUp"||e.key==="ArrowLeft")j=(i-1+folders.length)%folders.length;
  if(e.key==="Home")j=0;if(e.key==="End")j=folders.length-1;
  if(j!==null){e.preventDefault();selectFolder(folders[j],true);}
 });
});
if(fxRows){
 renderFx(false);fxRows.classList.remove("is-in");
 new IntersectionObserver(([e],o)=>{if(e.isIntersecting){fxRows.classList.add("is-in");o.disconnect();}},{threshold:.4}).observe(fxRows);
}

/* ---------- cursor: herramienta cuchilla ---------- */
const razor=$("razor"),cutline=$("cutline"),cutLabel=$("cutLabel");
if(finePointer&&!reduced&&razor){
 root.classList.add("has-razor");
 let x=-100,y=-100,target=null;
 const place=()=>{
  razor.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;
  if(target&&document.contains(target)){
   const r=target.getBoundingClientRect();
   cutline.style.transform=`translate(${clamp(x,r.left+1,r.right-1)}px,${r.top}px)`;
   cutline.style.height=`${r.height}px`;cutline.classList.add("is-on");
  }else cutline.classList.remove("is-on");
 };
 document.addEventListener("mousemove",e=>{
  x=e.clientX;y=e.clientY;
  const el=e.target.closest?e.target.closest("[data-cut]"):null;
  if(el!==target){target=el;if(el)cutLabel.textContent=t(el.dataset.cut);}
  razor.classList.toggle("is-hidden",!!(e.target.closest&&e.target.closest("select,video[controls],dialog")));
  place();
 },{passive:true});
 document.addEventListener("mouseleave",()=>{target=null;x=y=-100;place();});
 window.addEventListener("scroll",()=>{if(target)place();},{passive:true});
 document.addEventListener("click",e=>{
  if(e.target.closest&&e.target.closest("[data-cut]")){cutline.classList.remove("is-snap");void cutline.offsetWidth;cutline.classList.add("is-snap");}
 });
}

/* ---------- aparición al hacer scroll ---------- */
const revealEls=document.querySelectorAll(".block-head,.source,.strip,.multicam,.audio,.fx,.export-title,.export-sub,.export-panel");
if("IntersectionObserver" in window&&!reduced){
 revealEls.forEach(el=>el.classList.add("reveal"));
 const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("is-visible");io.unobserve(e.target);}}),{threshold:.12,rootMargin:"0px 0px -40px 0px"});
 revealEls.forEach(el=>io.observe(el));
}

/* ---------- aviso legal ---------- */
const legal=$("legal");
if(legal){
 $("legalOpen").addEventListener("click",()=>legal.showModal());
 $("legalClose").addEventListener("click",()=>legal.close());
 legal.addEventListener("click",e=>{if(e.target===legal)legal.close();});
}

/* ---------- textos dinámicos al cambiar de idioma ---------- */
document.addEventListener("langchange",()=>{
 if(srcCurrent&&srcName)srcName.textContent=clipTitle(srcCurrent);
 if(fxRows)renderFx(false);
 if(heroToggle)heroToggle.setAttribute("aria-label",t(heroToggle.dataset.i18nAria||"monitor.pause"));
 requestAnimationFrame(()=>{buildTimeline();onScroll();});
});

/* ---------- bucle de scroll ---------- */
let ticking=false;
function onScroll(){onScrollUI();onScrollWeb();ticking=false;}
window.addEventListener("scroll",()=>{if(!ticking){ticking=true;requestAnimationFrame(onScroll);}},{passive:true});
window.addEventListener("resize",()=>{buildTimeline();onScroll();});
tlMedia.addEventListener("change",()=>{buildTimeline();onScroll();});
shots.forEach(s=>s.addEventListener("load",onScroll));
window.addEventListener("load",()=>{buildTimeline();onScroll();});
buildTimeline();onScroll();
