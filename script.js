const grid=document.getElementById("videoGrid");
for(const p of projects){
 const card=document.createElement("a");
 card.className="video-card";
 card.href=`https://www.youtube.com/watch?v=${p.youtubeId}`;
 card.target="_blank";card.rel="noopener";
 card.innerHTML=`<div class="video-thumb"><img src="https://i.ytimg.com/vi/${p.youtubeId}/hqdefault.jpg" alt="${p.title}" width="480" height="360" loading="lazy" decoding="async"><span class="play">▶</span></div><div class="video-info"><h3>${p.title}</h3><span>Ver en YouTube ↗</span></div>`;
 grid.appendChild(card);
}