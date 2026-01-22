(function () {

  // --- Utilitaire AJAX ---
  function xhr(url, cb) {
    var r = new XMLHttpRequest();
    r.onreadystatechange = function () {
      if (r.readyState === 4) {
        if (r.status === 200) {
          try {
            cb(null, JSON.parse(r.responseText));
          } catch (e) {
            cb(e);
          }
        } else {
          cb(new Error("HTTP " + r.status));
        }
      }
    };
    r.open("GET", url, true);
    r.send();
  }

  // --- Coloration générique des sous-cases ---
  function applyColor(box, minutes) {
    box.classList.remove("color-green", "color-orange", "color-red");

    if (minutes < 6) {
      box.classList.add("color-red");
    } else if (minutes >= 7 && minutes <= 9) {
      box.classList.add("color-orange");
    } else if (minutes >= 10) {
      box.classList.add("color-green");
    }
  }

  // --- Initialisation du widget ---
  function init() {
    var busNext = document.getElementById("busNext");
    var busNext2 = document.getElementById("busNext2");
    var box1 = document.getElementById("busBox1");
    var box2 = document.getElementById("busBox2");

    if (!busNext || !busNext2 || !box1 || !box2) {
      return;
    }

    var cfg = window.DASH_CONFIG.stm;
    var url = cfg.apiNext55Two;
    var refreshMs = cfg.refreshMs || 60000;

    function refresh() {
      xhr(url, function (err, d) {
        if (err || !d || !d.ok) {
          busNext.textContent = "—";
          busNext2.textContent = "—";
          return;
        }

        var now = Date.now();

        // Minutes restantes basées sur l’heure d’arrivée prévue
        var m1 = Math.max(0, Math.floor((d.departureTimeUnix * 1000 - now) / 60000));
        var m2 = Math.max(0, Math.floor((d.departure2TimeUnix * 1000 - now) / 60000));

        // --- Décalage automatique si le premier bus est passé ---
        if (m1 <= 0) {
          m1 = m2;
          m2 = null;
        }

        // --- Affichage ---
        busNext.textContent = m1 != null ? m1 + " min" : "—";
        busNext2.textContent = m2 != null ? m2 + " min" : "—";

        // --- Coloration ---
        if (m1 != null) applyColor(box1, m1);
        if (m2 != null) applyColor(box2, m2);
      });
    }

    refresh();
    setInterval(refresh, refreshMs);
  }

  // --- Lancement ---
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
