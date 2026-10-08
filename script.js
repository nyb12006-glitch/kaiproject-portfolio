// Sala de montaje: arriba el monitor de programa, abajo la línea de tiempo que hace de menú.
const root=document.documentElement;
const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer=window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const FPS=25,TOTAL=150; // duración "virtual" del montaje completo en segundos
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

// Segundos a timecode HH:MM:SS:FF
function tc(sec){
 const f=Math.floor(sec*FPS);
 const ff=f%FPS,s=Math.floor(f/FPS)%60,m=Math.floor(f/FPS/60)%60,h=Math.floor(f/FPS/3600);
 return [h,m,s,ff].map(n=>String(n).padStart(2,"0")).join(":");
}

/* ---------- luz ambiente: color medio de una imagen o un fotograma ---------- */
const ambCanvas=document.createElement("canvas");ambCanvas.width=12;ambCanvas.height=8;
const ambCtx=ambCanvas.getContext("2d",{willReadFrequently:true});
function avgColor(src,cropTop){
 try{
  const w=src.videoWidth||src.naturalWidth,h=src.videoHeight||src.naturalHeight;
  if(!w||!h)return null;
  const sh=cropTop?Math.min(h,w*.6):h; // en capturas largas solo cuenta la parte de arriba
  ambCtx.drawImage(src,0,0,w,sh,0,0,12,8);
  const d=ambCtx.getImageData(0,0,12,8).data;let r=0,g=0,b=0;
  for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];}
  const n=d.length/4;r/=n;g/=n;b/=n;
  // se aviva un poco para que la luz se note sobre el fondo oscuro
  const max=Math.max(r,g,b)||1,k=Math.min(2.2,190/max);
  return `rgb(${Math.round(r*k)},${Math.round(g*k)},${Math.round(b*k)})`;
 }catch(e){return null;}
}
function setAmb(el,src,cropTop){const c=avgColor(src,cropTop);if(c&&el)el.style.setProperty("--amb",c);}
// mientras un vídeo suena, la luz sigue sus colores
function followVideo(video,el){
 let timer=null;
 const stop=()=>{clearInterval(timer);timer=null;};
 video.addEventListener("play",()=>{stop();setAmb(el,video);timer=setInterval(()=>setAmb(el,video),450);});
 video.addEventListener("pause",stop);video.addEventListener("emptied",stop);
}

/* ---------- intro: se salta con clic o tecla ---------- */
if(root.classList.contains("intro-on")){
 const introTc=$("introTc");const t0=performance.now();let done=false;
 const tick=now=>{if(done)return;const s=(now-t0)/1000;introTc.textContent=tc(Math.min(s,1.45)*4);if(s<1.5)requestAnimationFrame(tick);};
 requestAnimationFrame(tick);
 const end=()=>{if(done)return;done=true;root.classList.add("intro-done");root.classList.remove("intro-on");};
 $("intro").addEventListener("click",end);
 document.addEventListener("keydown",end,{once:true});
 setTimeout(end,2100);
}

/* ---------- portada: monitor de programa ---------- */
const heroVideo=$("heroVideo"),heroTc=$("heroTc"),heroToggle=$("heroToggle"),heroAmb=$("heroAmb");
// solo suena un vídeo a la vez: al activar uno se silencian los demás
const players=new Set();
function soloAudio(v){for(const p of players)if(p!==v)p.pause();}
if(heroVideo){
 followVideo(heroVideo,heroAmb);
 const draw=()=>{heroTc.textContent=tc(heroVideo.currentTime);if(!heroVideo.paused)requestAnimationFrame(draw);};
 heroVideo.addEventListener("play",()=>requestAnimationFrame(draw));
 if(reduced){heroVideo.removeAttribute("autoplay");heroVideo.pause();}
 const setToggle=()=>{const p=heroVideo.paused;heroToggle.textContent=p?"▶":"❚❚";heroToggle.dataset.i18nAria=p?"monitor.resume":"monitor.pause";heroToggle.setAttribute("aria-label",t(heroToggle.dataset.i18nAria));};
 let userPaused=reduced;
 heroToggle.addEventListener("click",()=>{if(heroVideo.paused){userPaused=false;heroVideo.play().catch(()=>{});}else{userPaused=true;heroVideo.pause();}});
 heroVideo.addEventListener("play",setToggle);heroVideo.addEventListener("pause",setToggle);setToggle();
 new IntersectionObserver(([e])=>{if(e.isIntersecting){if(!userPaused)heroVideo.play().catch(()=>{});}else heroVideo.pause();},{threshold:.15}).observe(heroVideo);
}

/* ---------- línea de tiempo: menú, cabezal y timecode ---------- */
const bar=document.querySelector(".bar");
const tcEl=$("tc"),tlHead=$("tlHead"),tlLane=$("tlLane");
const tlClips=[...document.querySelectorAll(".tl-clip")].map(el=>({el,s:$(el.dataset.sec)}));
function maxScroll(){return Math.max(1,document.documentElement.scrollHeight-innerHeight);}
const tlWide=window.matchMedia("(min-width: 961px)");
function sizeTimeline(){
 // en escritorio cada clip mide lo que mide su sección, como en un montaje real;
 // en móvil van iguales para que se lean todos los nombres
 for(const c of tlClips)if(c.s)c.el.style.flexGrow=tlWide.matches?String(Math.max(1,c.s.offsetHeight)):"1";
}
function onScrollUI(){
 const p=clamp(scrollY/maxScroll(),0,1);
 tcEl.textContent=tc(p*TOTAL);
 bar.classList.toggle("is-solid",scrollY>innerHeight*.6);
 // punto del documento bajo el cabezal: arriba del todo es 0 y al final es 1
 const pos=scrollY+innerHeight*p;
 let active=tlClips[0];
 for(const c of tlClips)if(c.s&&c.s.offsetTop<=pos+1)active=c;
 for(const c of tlClips)c.el.classList.toggle("is-on",c===active);
 if(active.s){
  const frac=clamp((pos-active.s.offsetTop)/active.s.offsetHeight,0,1);
  tlHead.style.left=`${tlLane.offsetLeft+active.el.offsetLeft+frac*active.el.offsetWidth}px`;
 }
}

/* ---------- 01 webs: miniaturas que cambian el monitor ---------- */
const webScreen=$("webScreen"),webAmb=$("webAmb");
const shots=[...document.querySelectorAll(".web-shot")];
const webThumbs=[...document.querySelectorAll("#webThumbs .thumb")];
const shotColors=[];
let webIdx=0;
// cuánto tiene que bajar cada captura para enseñar la web entera al pasar el ratón
function sizeShots(){
 shots.forEach(s=>{const travel=Math.max(0,s.offsetHeight-webScreen.clientHeight);s.style.setProperty("--travel",`-${travel}px`);s.style.setProperty("--dur",`${clamp(travel/260,4,14)}s`);});
}
shots.forEach((s,k)=>{const read=()=>{shotColors[k]=avgColor(s,true);if(k===webIdx&&shotColors[k])webAmb.style.setProperty("--amb",shotColors[k]);sizeShots();};s.complete?read():s.addEventListener("load",read);});
function setWeb(i){
 if(i===webIdx)return;
 webIdx=i;
 const b=webThumbs[i];
 shots.forEach((s,k)=>s.classList.toggle("is-on",k===i));
 webThumbs.forEach((x,k)=>x.classList.toggle("is-on",k===i));
 if(shots[i].loading==="lazy")shots[i].loading="eager";
 $("webName").textContent=b.dataset.name;$("webHost").textContent=b.dataset.host;
 const d=$("webDesc");d.dataset.i18n=b.dataset.desc;d.textContent=t(b.dataset.desc);
 $("webLink").href=b.dataset.href;
 webScreen.scrollTop=0;
 if(shotColors[i])webAmb.style.setProperty("--amb",shotColors[i]);
 if(!reduced){webScreen.classList.remove("is-cutting");void webScreen.offsetWidth;webScreen.classList.add("is-cutting");}
}
webThumbs.forEach((b,k)=>b.addEventListener("click",()=>setWeb(k)));
// las capturas grandes se piden cuando la sección está cerca, no al abrir la página
new IntersectionObserver(([e],o)=>{if(e.isIntersecting){shots.forEach(s=>{s.loading="eager";});o.disconnect();}},{rootMargin:"600px"}).observe(webScreen);

/* ---------- 02 videoclips: miniaturas y monitor de origen ---------- */
const srcScreen=$("srcScreen"),srcPoster=$("srcPoster"),srcVideo=$("srcVideo"),srcPlay=$("srcPlay"),srcYt=$("srcYt"),srcAmb=$("srcAmb");
const vthumbs=[...document.querySelectorAll("#srcThumbs .thumb")];
let srcCurrent=vthumbs[0];
function vText(b,sel){const el=b.querySelector(sel);return el.dataset.i18n?t(el.dataset.i18n):el.textContent;}
function loadSource(b,cut){
 srcCurrent=b;
 vthumbs.forEach(x=>x.classList.toggle("is-on",x===b));
 srcVideo.pause();srcVideo.removeAttribute("src");srcVideo.load();srcVideo.hidden=true;
 srcPoster.src=b.dataset.poster;srcPoster.hidden=false;
 const yt=b.dataset.kind==="yt";
 srcPlay.hidden=yt;srcYt.hidden=!yt;
 if(yt)srcYt.href=`https://www.youtube.com/watch?v=${b.dataset.yt}`;
 const title=$("srcTitle"),kind=$("srcKind"),by=$("srcBy");
 const tn=b.querySelector(".thumb-name");
 if(tn.dataset.i18n){title.dataset.i18n=tn.dataset.i18n;}else title.removeAttribute("data-i18n");
 title.textContent=vText(b,".thumb-name");
 kind.hidden=!yt;kind.textContent=yt?"YouTube":"";
 by.textContent=b.querySelector(".thumb-sub").textContent;
 if(cut&&!reduced){srcScreen.classList.remove("is-cutting");void srcScreen.offsetWidth;srcScreen.classList.add("is-cutting");}
}
if(srcScreen){
 players.add(srcVideo);
 srcVideo.hidden=true;
 srcPoster.addEventListener("load",()=>setAmb(srcAmb,srcPoster));
 if(srcPoster.complete)setAmb(srcAmb,srcPoster);
 followVideo(srcVideo,srcAmb);
 srcVideo.addEventListener("play",()=>soloAudio(srcVideo));
 vthumbs.forEach(b=>b.addEventListener("click",()=>{
  loadSource(b,true);
  srcScreen.scrollIntoView({behavior:reduced?"auto":"smooth",block:"center"});
 }));
 srcPlay.addEventListener("click",()=>{
  srcVideo.src=srcCurrent.dataset.src;srcVideo.poster=srcCurrent.dataset.poster;
  srcVideo.muted=false;srcVideo.hidden=false;srcPoster.hidden=true;srcPlay.hidden=true;
  srcVideo.play().catch(()=>{});
 });
 new IntersectionObserver(([e])=>{if(!e.isIntersecting)srcVideo.pause();}).observe(srcScreen);
}

/* ---------- 03 contenido: multicámara con versión completa y sonido ---------- */
const mcVideo=$("mcVideo"),mcScreen=$("mcScreen"),mcLink=$("mcLink"),mcSound=$("mcSound"),mcAmb=$("mcAmb");
const angles=[...document.querySelectorAll(".angle")];
let mcVisible=false;
// vista previa: bucle corto sin sonido; completo: el reel entero con sonido y controles
function previewMode(){mcVideo.controls=false;mcVideo.muted=true;mcVideo.loop=true;}
function setAngle(a,cut){
 angles.forEach(x=>x.classList.toggle("is-on",x===a));
 previewMode();
 mcVideo.poster=a.dataset.poster;mcVideo.src=a.dataset.src;
 if(mcVisible&&!reduced)mcVideo.play().catch(()=>{});
 mcLink.hidden=!a.dataset.href;if(a.dataset.href)mcLink.href=a.dataset.href;
 mcSound.hidden=!a.dataset.full;
 if(cut&&!reduced){mcScreen.classList.remove("is-cutting");void mcScreen.offsetWidth;mcScreen.classList.add("is-cutting");}
}
if(mcVideo){
 players.add(mcVideo);
 followVideo(mcVideo,mcAmb);
 angles.forEach(a=>a.addEventListener("click",()=>setAngle(a,true)));
 mcSound.addEventListener("click",()=>{
  const a=angles.find(x=>x.classList.contains("is-on"));if(!a||!a.dataset.full)return;
  soloAudio(mcVideo);
  mcVideo.src=a.dataset.full;mcVideo.loop=false;mcVideo.muted=false;mcVideo.controls=true;mcVideo.play().catch(()=>{});
  mcSound.hidden=true;
 });
 mcVideo.addEventListener("play",()=>{if(!mcVideo.muted)soloAudio(mcVideo);});
 new IntersectionObserver(([e])=>{
  mcVisible=e.isIntersecting;
  if(mcVisible&&!reduced&&!mcVideo.controls){mcVideo.preload="auto";mcVideo.play().catch(()=>{});}
  else if(!mcVisible)mcVideo.pause();
 },{threshold:.3}).observe(mcScreen);
}

/* ---------- canales: forma de onda ---------- */
document.querySelectorAll(".wave").forEach((w,k)=>{
 let seed=7+k*13;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 const frag=document.createDocumentFragment();
 for(let i=0;i<64;i++){
  const env=.35+.65*Math.abs(Math.sin(i/64*Math.PI*(2.2+k)));
  const b=document.createElement("i");b.style.setProperty("--h",(0.15+rnd()*.85*env).toFixed(2));
  b.style.animationDelay=`${-(i%9)*70}ms`;frag.appendChild(b);
 }
 w.appendChild(frag);
});

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
  x=e.clientX;y=e.clientY;razor.classList.remove("is-idle");
  const el=e.target.closest?e.target.closest("[data-cut]"):null;
  if(el!==target){target=el;if(el)cutLabel.textContent=t(el.dataset.cut);}
  razor.classList.toggle("is-hidden",!!(e.target.closest&&e.target.closest("select,video[controls],dialog")));
  place();
 },{passive:true});
 document.addEventListener("mouseleave",()=>{target=null;razor.classList.add("is-idle");place();});
 window.addEventListener("scroll",()=>{if(target)place();},{passive:true});
 document.addEventListener("click",e=>{
  if(e.target.closest&&e.target.closest("[data-cut]")){cutline.classList.remove("is-snap");void cutline.offsetWidth;cutline.classList.add("is-snap");}
 });
}

/* ---------- aparición al hacer scroll ---------- */
const revealEls=document.querySelectorAll(".sec .sec-head,.sec .screen-wrap,.detail,.thumbs,.col-reel-side,.services li,.col-contact,.export");
if("IntersectionObserver" in window&&!reduced){
 revealEls.forEach(el=>el.classList.add("reveal"));
 document.querySelectorAll(".services li").forEach((li,i)=>{li.style.transitionDelay=`${i*90}ms`;});
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

document.addEventListener("langchange",()=>{
 fitText();
 if(srcCurrent&&$("srcTitle").dataset.i18n)$("srcTitle").textContent=t($("srcTitle").dataset.i18n);
 if(heroToggle)heroToggle.setAttribute("aria-label",t(heroToggle.dataset.i18nAria||"monitor.pause"));
 requestAnimationFrame(()=>{sizeTimeline();onScroll();});
});

/* ---------- titulares: si una palabra no cabe en su caja, la letra baja lo justo ---------- */
const fitEls=[...document.querySelectorAll(".h1-big,h2")];
function fitText(){
 for(const el of fitEls){
  el.style.fontSize="";
  let size=parseFloat(getComputedStyle(el).fontSize),guard=40;
  while(el.scrollWidth>el.clientWidth+1&&size>24&&guard--){size-=2;el.style.fontSize=`${size}px`;}
 }
}

/* ---------- bucle de scroll ---------- */
let ticking=false;
function onScroll(){onScrollUI();ticking=false;}
window.addEventListener("scroll",()=>{if(!ticking){ticking=true;requestAnimationFrame(onScroll);}},{passive:true});
window.addEventListener("resize",()=>{fitText();sizeTimeline();sizeShots();onScroll();});
window.addEventListener("load",()=>{sizeTimeline();onScroll();});
fitText();sizeTimeline();onScroll();
if(document.fonts)document.fonts.ready.then(()=>{fitText();sizeTimeline();onScroll();});
