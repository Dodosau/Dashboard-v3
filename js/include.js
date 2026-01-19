
(function(){
function xhr(url,cb){
 var r=new XMLHttpRequest();
 r.onreadystatechange=function(){
  if(r.readyState===4){
   if(r.status===200)cb(null,r.responseText);
   else cb(new Error(r.status));
  }
 };
 r.open("GET",url,true); r.send();
}
window.includeAll=function(cb){
 var nodes=document.querySelectorAll("[data-widget]");
 var left=nodes.length, widgets=[];
 if(!left){cb(widgets);return;}
 for(var i=0;i<nodes.length;i++){
  (function(el){
   var name=el.getAttribute("data-widget");
   xhr("widgets/"+name+"/"+name+".html",function(err,html){
    if(!err){ el.outerHTML=html; widgets.push(name); }
    left--; if(!left)cb(widgets);
   });
  })(nodes[i]);
 }
};
})();
