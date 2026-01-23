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
    if (!box) return;
    box.classList.remove("color-green", "color-orange", "color-red");

    // 0–5 rouge, 6–9 orange, 10+ vert (sans trous)
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

  // --- Initialisation du widget ---
  function init() {
    var busNext = document.getElementById("busNext");
    var busNext2 = document.getElementById("busNext2");
    var box1 = document.getElementById("busBox1");
    var box2 = document.getElementById("busBox2");

    if (!busNext || !busNext2 || !box1 || !box2) return;

    var cfg = (window.DASH_CONFIG && window.DASH_CONFIG.stm) ? window.DASH_CONFIG.stm : {};
    // nouveau endpoint (tu peux garder apiNext55Two en fallback si besoin)
    var url = cfg.apiProchainBus55 || cfg.apiNext55Two;
    var refreshMs = cfg.refreshMs || 60000;

    if (!url) {
      setDash(busNext);
      setDash(busNext2);
      return;
    }

    function refresh() {
      // anti-cache (important avec raw github)
      var u = url + (url.indexOf("?") === -1 ? "?" : "&") + "ts=" + Date.now();

      xhr(u, function (err, d) {
        if (err || !d || !d.ok) {
          setDash(busNext);
          setDash(busNext2);
          return;
        }

        var now = Date.now();

        // On prend les 3 timestamps (le 3e est réserve)
        var t1 = d.departureTimeUnix ? d.departureTimeUnix * 1000 : null;
        var t2 = d.departure2TimeUnix ? d.departure2TimeUnix * 1000 : null;
        var t3 = d.departure3TimeUnix ? d.departure3TimeUnix * 1000 : null;

        var m1 = t1 ? Math.floor((t1 - now) / 60000) : null;
        var m2 = t2 ? Math.floor((t2 - now) / 60000) : null;
        var m3 = t3 ? Math.floor((t3 - now) / 60000) : null;

        // clamp négatifs -> 0 (mais on utilise surtout <=0 pour shift)
        if (m1 != null) m1 = Math.max(0, m1);
        if (m2 != null) m2 = Math.max(0, m2);
        if (m3 != null) m3 = Math.max(0, m3);

        // --- Shift intelligent (2 cases affichées, 3e en réserve) ---
        // Si le premier est à 0 (passé / imminent), on décale:
        // (m1,m2) devient (m2,m3)
        if (m1 != null && m1 <= 0) {
          m1 = m2;
          m2 = m3;
          m3 = null;
        }
        // Si après ça le second est aussi à 0, on décale encore:
        if (m1 != null && m1 <= 0) {
          m1 = m2;
          m2 = null;
        }
        if (m2 != null && m2 <= 0) {
          m2 = null;
        }

        // --- Affichage (SEULEMENT 2 cases) ---
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
