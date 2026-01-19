
(function(){
function tick(){
 var d=new Date();
 document.getElementById("clockTime").innerHTML=
  ("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2);
 document.getElementById("clockDate").innerHTML=d.toDateString();
}
tick(); setInterval(tick,10000);
})();
