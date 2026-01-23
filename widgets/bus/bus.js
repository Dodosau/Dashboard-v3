(function () {

  // ===============================
  // CONFIG DIRECTE (URL en dur)
  // ===============================
  var API_URL =
    "https://raw.githubusercontent.com/Dodosau/Dashboard-v3/main/data/prochainBus55.json";

  var REFRESH_MS = 60000; // 1 min

  // ===============================
  // Utilitaire AJAX
  // ===============================
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

  // ===============================
  // Coloration
  // ===============================
  function applyColor(box, minutes) {
    if (!box) return;
    box.classList.remove("color-green", "color-orange", "color-red");

    // 0–5 rouge, 6–9 orange, 10+ vert
    if (minutes <= 5) {
      box.classList.add("color-red");
    } else if (minutes <= 9) {
      box.classList.add("color-orange");
    } else {
      box.classList.add("color-green");
    }
  }

  function setDash(el) {
    if (el) el.textContent = "—";
  }

  // ===============================
  // Init widget
  // ===============================
  function init() {
    var busNext = document.getElementById("busNext");
    var busNext2 = document.getElementById("busNext2");
    var box1 = document.getElementById("busBox1");
    var box2 = document.getElementById("busBox2");

    if (!busNext || !busNext2 || !box1 || !box2) return;

    function refresh() {
      // anti-cache pour GitHub raw
      var url = API_URL + "?ts=" + Date.now();

      xhr(url, function (err, d) {
        if (err || !d || !d.ok) {
          setDash(busNext);
          setDash(busNext2);
          return;
        }

        var now = Date.now();

        // 3 timestamps (3e = réserve)
        var t1 = d.departureTimeUnix ? d.departureTimeUnix * 1000 : null;
        var t2 = d.departure2TimeUnix ? d.departure2TimeUnix * 1000 : null;
        var t3 = d.departure3TimeUnix ? d.departure3TimeUnix * 1000 : null;

        var m1 = t1 ? Math.floor((t1 - now) / 60000) : null;
        var m2 = t2 ? Math.floor((t2 - now) / 60000) : null;
        var m3 = t3 ? Math.floor((t3 - now) / 60000) : null;

        if (m1 != null) m1 = Math.max(0, m1);
        if (m2 != null) m2 = Math.max(0, m2);
        if (m3 != null) m3 = Math.max(0, m3);

        // ===============================
        // SHIFT INTELLIGENT
        // ===============================
        if (m1 != null && m1 <= 0) {
          m1 = m2;
          m2 = m3;
          m3 = null;
        }
        if (m1 != null && m1 <= 0) {
          m1 = m2;
          m2 = null;
        }
        if (m2 != null && m2 <= 0) {
          m2 = null;
        }

        // ===============================
        // Affichage (2 cases seulement)
        // ===============================
        busNext.textContent = m1 != null ? m1 + " min" : "—";
        busNext2.textContent = m2 != null ? m2 + " min" : "—";

        // ===============================
        // Couleurs
        // ===============================
        if (m1 != null) applyColor(box1, m1);
        if (m2 != null) applyColor(box2, m2);
      });
    }

    refresh();
    setInterval(refresh, REFRESH_MS);
  }

  // ===============================
  // Lancement
  // ===============================
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
