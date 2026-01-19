
(function(){
var el=document.getElementById("weddingDays");
function tick(){
 var t=new Date(); var w=new Date("2026-06-17");
 t.setHours(0,0,0,0); w.setHours(0,0,0,0);
 var d=Math.ceil((w-t)/86400000);
 el.innerHTML=d>0?d:"🎉";
}
tick(); setInterval(tick,3600000);
})();
