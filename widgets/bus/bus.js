(function () {

  function init() {
    fetch("data/bus.json?v=" + Date.now())
      .then(r => r.json())
      .then(showBus)
      .catch(err => console.error("Erreur bus:", err));
  }

  function showBus(data) {
    var box = document.getElementById("busBox");
    if (!box) return;

    if (!data || !data.arrival) {
      box.textContent = "Aucune donnée STM";
      return;
    }

    var now = Math.floor(Date.now() / 1000);
    var diff = data.arrival - now;

    if (diff < 0) {
      box.textContent = "Bus passé";
      return;
    }

    var min = Math.floor(diff / 60);
    var sec = diff % 60;

    box.innerHTML =
      "<div class='title'>Bus 55</div>" +
      "<div class='temp'>" + min + " min</div>" +
      "<div class='small'>Arrêt 52103</div>";
  }

  // Mise à jour toutes les 30 secondes
  setInterval(init, 30000);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
