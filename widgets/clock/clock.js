(function () {
  function tick() {
    var d = new Date();
    var h = ("0" + d.getHours()).slice(-2);
    var m = ("0" + d.getMinutes()).slice(-2);

    document.getElementById("clockTime").textContent = h + ":" + m;
  }

  tick();
  setInterval(tick, 10000); // MAJ toutes les 10s
})();
