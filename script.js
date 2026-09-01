// Miniatura de YouTube en la mejor calidad disponible: no todos los vídeos tienen
// maxresdefault/sddefault en alta resolución. Cuando no existe, YouTube no siempre
// da un error real: a veces responde 200 con un placeholder gris de 120x90, así que
// además de "error" hay que comprobar el tamaño real de la imagen ya cargada.
const YT_THUMB_FALLBACKS=["maxresdefault","sddefault","hqdefault"];
function ytThumbNext(img,youtubeId){
 const tried=Number(img.dataset.thumbTry||0)+1;
 if(tried<YT_THUMB_FALLBACKS.length){
  img.dataset.thumbTry=tried;
  img.src=`https://i.ytimg.com/vi/${youtubeId}/${YT_THUMB_FALLBACKS[tried]}.jpg`;
 }
}

const grid=document.getElementById("videoGrid");
for(const p of projects){
 const card=document.createElement("a");
 card.className="video-card reveal";
 card.href=`https://www.youtube.com/watch?v=${p.youtubeId}`;
 card.target="_blank";card.rel="noopener";
 card.innerHTML=`<div class="video-thumb"><img src="https://i.ytimg.com/vi/${p.youtubeId}/${YT_THUMB_FALLBACKS[0]}.jpg" alt="${p.title}" width="1280" height="720" loading="lazy" decoding="async"><span class="play">▶</span></div><div class="video-info"><h3>${p.title}</h3><span>Ver en YouTube ↗</span></div>`;
 const thumbImg=card.querySelector("img");
 thumbImg.addEventListener("error",function(){ytThumbNext(this,p.youtubeId)});
 thumbImg.addEventListener("load",function(){
  if(this.naturalWidth<=120&&this.naturalHeight<=90)ytThumbNext(this,p.youtubeId);
 });
 grid.appendChild(card);
}

// Scroll reveal: las tarjetas y bloques con clase .reveal entran con fade al hacer scroll
const revealItems=document.querySelectorAll(".reveal");
if("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
 const io=new IntersectionObserver((entries)=>{
  for(const entry of entries){
   if(entry.isIntersecting){
    entry.target.classList.add("is-visible");
    io.unobserve(entry.target);
   }
  }
 },{threshold:0.15,rootMargin:"0px 0px -40px 0px"});
 revealItems.forEach(el=>io.observe(el));
}else{
 revealItems.forEach(el=>el.classList.add("is-visible"));
}

// Cursor "Ver ↗" que sigue al ratón sobre las tarjetas de proyectos web
const cursorChip=document.getElementById("cursorChip");
if(cursorChip && window.matchMedia("(hover: hover) and (pointer: fine)").matches){
 document.addEventListener("mousemove",(e)=>{
  cursorChip.style.left=`${e.clientX}px`;
  cursorChip.style.top=`${e.clientY}px`;
 });
 document.querySelectorAll(".web-card").forEach(card=>{
  card.addEventListener("mouseenter",()=>cursorChip.classList.add("is-active"));
  card.addEventListener("mouseleave",()=>cursorChip.classList.remove("is-active"));
 });
}

// Reels: en dispositivos con ratón, el preview se reproduce al pasar por encima.
// En móvil/táctil no hay hover, así que se reproduce solo al deslizar y que la
// tarjeta quede visible en pantalla (como un feed de reels), y se pausa al salir.
const hasMouseHover=window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const reelCards=document.querySelectorAll(".reel-card");

function playReel(video){video.currentTime=0;video.play().then(()=>video.classList.add("is-playing")).catch(()=>{});}
function pauseReel(video){video.pause();video.classList.remove("is-playing");}

if(hasMouseHover){
 reelCards.forEach(card=>{
  const video=card.querySelector(".reel-video");
  if(!video)return;
  card.addEventListener("mouseenter",()=>playReel(video));
  card.addEventListener("mouseleave",()=>pauseReel(video));
 });
}else if("IntersectionObserver" in window){
 const reelIO=new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
   const video=entry.target.querySelector(".reel-video");
   if(!video)return;
   if(entry.isIntersecting)playReel(video);
   else pauseReel(video);
  });
 },{threshold:0.6});
 reelCards.forEach(card=>reelIO.observe(card));
}