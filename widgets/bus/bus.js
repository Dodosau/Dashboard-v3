(function () {

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

  function init() {
    var busNext = document.getElementById("busNext");
    var busNext2 = document.getElementById("busNext2");

    if (!busNext || !busNext2) {
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

        // 🔥 Décalage automatique si le premier bus est passé
        if (m1 <= 0) {
          m1 = m2;
          m2 = null;
        }

        busNext.textContent = m1 != null ? m1 + " min" : "—";
        busNext2.textContent = m2 != null ? m2 + " min" : "—";
      });
    }

    refresh();
    setInterval(refresh, refreshMs);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
