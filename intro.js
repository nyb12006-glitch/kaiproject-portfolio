// Se carga en el <head> antes de pintar: decide si se ve la intro de cortes
// (una vez por sesión y nunca con movimiento reducido) para que no haya parpadeo.
(function(){
 var root=document.documentElement;
 root.classList.add("js");
 try{
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  if(sessionStorage.getItem("introSeen"))return;
  sessionStorage.setItem("introSeen","1");
 }catch(e){return;}
 root.classList.add("intro-on");
})();
