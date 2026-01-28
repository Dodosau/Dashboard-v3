window.onload=function(){
 window.includeAll(function(widgets){
  for(var i=0;i<widgets.length;i++){
   var s=document.createElement("script");
   s.src="widgets/"+widgets[i]+"/"+widgets[i]+".js";
   document.body.appendChild(s);
  }
 });
};
