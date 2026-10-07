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
const heroVideo=$("heroVideo"),heroTc=$("heroTc"),heroToggle=$("heroToggle");
if(heroVideo){
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

/* ---------- 01 webs: el visor recorre cada web con el scroll ---------- */
const scrub=$("web"),webScreen=$("webScreen"),webAmb=$("webAmb");
const shots=[...document.querySelectorAll(".web-shot")];
const webItems=[...document.querySelectorAll("#webList .clip")];
const webBars=webItems.map(li=>li.querySelector(".clip-bar i"));
const shotColors=[];
let webIdx=-1;
shots.forEach((s,k)=>{const read=()=>{shotColors[k]=avgColor(s,true);if(k===webIdx&&shotColors[k])webAmb.style.setProperty("--amb",shotColors[k]);};s.complete?read():s.addEventListener("load",read);});
function setWeb(i){
 if(i===webIdx)return;
 const first=webIdx===-1;webIdx=i;
 shots.forEach((s,k)=>s.classList.toggle("is-on",k===i));
 webItems.forEach((li,k)=>li.classList.toggle("is-on",k===i));
 const a=webItems[i].querySelector("a");
 $("webUrl").textContent=a.hostname.replace(/^www\./,"");$("webLink").href=a.href;
 if(shotColors[i])webAmb.style.setProperty("--amb",shotColors[i]);
 if(!first&&!reduced){webScreen.classList.remove("is-cutting");void webScreen.offsetWidth;webScreen.classList.add("is-cutting");}
}
const ease=x=>x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2;
function onScrollWeb(){
 if(!scrub||reduced)return;
 const range=scrub.offsetHeight-scrub.firstElementChild.offsetHeight;
 const p=clamp((scrollY-scrub.offsetTop)/range,0,1);
 const n=webItems.length,pos=p*n,i=Math.min(n-1,Math.floor(pos));
 setWeb(i);
 webBars.forEach((b,k)=>{b.style.transform=`scaleX(${clamp(pos-k,0,1)})`;});
 const shot=shots[i],travel=Math.max(0,shot.offsetHeight-webScreen.clientHeight);
 // un respiro al principio y al final de cada web para leer la portada y el pie
 shot.style.transform=`translateY(${-travel*ease(clamp((pos-i-.12)/.76,0,1))}px)`;
}
setWeb(0);
if(reduced){
 webItems.forEach((li,k)=>{const a=li.querySelector("a");a.addEventListener("mouseenter",()=>setWeb(k));a.addEventListener("focus",()=>setWeb(k));});
}

/* ---------- 02 videoclips: monitor de origen ---------- */
const srcScreen=$("srcScreen"),srcPoster=$("srcPoster"),srcVideo=$("srcVideo"),srcPlay=$("srcPlay"),srcYt=$("srcYt"),srcAmb=$("srcAmb");
const vitems=[...document.querySelectorAll(".vitem")];
let srcCurrent=vitems[0];
function loadSource(b,cut){
 srcCurrent=b;
 vitems.forEach(x=>x.classList.toggle("is-on",x===b));
 srcVideo.pause();srcVideo.removeAttribute("src");srcVideo.load();srcVideo.hidden=true;
 srcPoster.src=b.dataset.poster;srcPoster.hidden=false;
 const yt=b.dataset.kind==="yt";
 srcPlay.hidden=yt;srcYt.hidden=!yt;
 if(yt)srcYt.href=`https://www.youtube.com/watch?v=${b.dataset.yt}`;
 if(cut&&!reduced){srcScreen.classList.remove("is-cutting");void srcScreen.offsetWidth;srcScreen.classList.add("is-cutting");}
}
if(srcScreen){
 srcVideo.hidden=true;
 srcPoster.addEventListener("load",()=>setAmb(srcAmb,srcPoster));
 if(srcPoster.complete)setAmb(srcAmb,srcPoster);
 followVideo(srcVideo,srcAmb);
 vitems.forEach(b=>b.addEventListener("click",()=>{
  loadSource(b,true);
  if(matchMedia("(max-width: 960px)").matches)srcScreen.scrollIntoView({behavior:reduced?"auto":"smooth",block:"center"});
 }));
 srcPlay.addEventListener("click",()=>{
  srcVideo.src=srcCurrent.dataset.src;srcVideo.poster=srcCurrent.dataset.poster;
  srcVideo.hidden=false;srcPoster.hidden=true;srcPlay.hidden=true;
  srcVideo.play().catch(()=>{});
 });
 new IntersectionObserver(([e])=>{if(!e.isIntersecting)srcVideo.pause();}).observe(srcScreen);
}

/* ---------- 03 contenido: multicámara ---------- */
const mcVideo=$("mcVideo"),mcScreen=$("mcScreen"),mcLink=$("mcLink"),mcFull=$("mcFull"),mcAmb=$("mcAmb");
const angles=[...document.querySelectorAll(".angle")];
let mcVisible=false;
function setAngle(a,cut){
 angles.forEach(x=>x.classList.toggle("is-on",x===a));
 mcVideo.controls=false;mcVideo.muted=true;mcVideo.loop=true;
 mcVideo.poster=a.dataset.poster;mcVideo.src=a.dataset.src;
 if(mcVisible&&!reduced)mcVideo.play().catch(()=>{});
 mcLink.hidden=!a.dataset.href;mcFull.hidden=!a.dataset.full;
 if(a.dataset.href)mcLink.href=a.dataset.href;
 if(cut&&!reduced){mcScreen.classList.remove("is-cutting");void mcScreen.offsetWidth;mcScreen.classList.add("is-cutting");}
}
if(mcVideo){
 followVideo(mcVideo,mcAmb);
 angles.forEach(a=>a.addEventListener("click",()=>setAngle(a,true)));
 mcFull.addEventListener("click",()=>{
  const a=angles.find(x=>x.classList.contains("is-on"));if(!a||!a.dataset.full)return;
  mcVideo.src=a.dataset.full;mcVideo.loop=false;mcVideo.muted=false;mcVideo.controls=true;mcVideo.play().catch(()=>{});
 });
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
const revealEls=document.querySelectorAll(".sec .sec-head,.sec .screen-wrap,.vlist,.col-reel-side,.services li,.col-contact,.export");
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
 if(heroToggle)heroToggle.setAttribute("aria-label",t(heroToggle.dataset.i18nAria||"monitor.pause"));
 requestAnimationFrame(()=>{sizeTimeline();onScroll();});
});

/* ---------- bucle de scroll ---------- */
let ticking=false;
function onScroll(){onScrollUI();onScrollWeb();ticking=false;}
window.addEventListener("scroll",()=>{if(!ticking){ticking=true;requestAnimationFrame(onScroll);}},{passive:true});
window.addEventListener("resize",()=>{sizeTimeline();onScroll();});
shots.forEach(s=>s.addEventListener("load",onScroll));
window.addEventListener("load",()=>{sizeTimeline();onScroll();});
sizeTimeline();onScroll();
