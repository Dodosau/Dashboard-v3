(function () {

  function init() {
    fetch("data/bus.json?v=" + Date.now())
      .then(r => r.json())
      .then(showBus)
      .catch(err => {
        console.error("Erreur bus:", err);
        document.getElementById("busBox").textContent = "Erreur de chargement";
      });
  }

  function showBus(data) {
    var box = document.getElementById("busBox");
    if (!box) return;

    // Si le JSON est vide ou invalide
    if (!data || !data.arrival) {
      box.textContent = "Aucun bus trouvé";
      return;
    }

    // Timestamp actuel (en secondes)
    var now = Math.floor(Date.now() / 1000);

    // Différence en secondes
    var diff = data.arrival - now;

    if (diff <= 0) {
      box.textContent = "Bus en approche";
      return;
    }

    // Conversion en minutes
    var minutes = Math.floor(diff / 60);

    // Affichage final
    box.innerHTML =
      "<div class='title'>Bus " + data.routeId + "</div>" +
      "<div class='temp'>" + minutes + " min</div>" +
      "<div class='small'>Arrêt " + data.stopId + "</div>";
  }

  // Mise à jour toutes les 30 secondes
  setInterval(init, 30000);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
