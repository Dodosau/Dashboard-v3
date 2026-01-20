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
    var badge = document.getElementById("busBadge");
    var text1 = document.getElementById("busNextText");
    var text2 = document.getElementById("busNext2Text");
    if (!badge || !text1 || !text2) return;

    var cfgAll = window.DASH_CONFIG || {};
    var cfg = cfgAll.stm || {};

    var stopId = cfg.stopId || "52103";
    var apiBase =
      cfg.apiNext55Two ||
      "https://stm-bus.doriansauzede.workers.dev/api/next55";

    var refreshMs = cfg.refreshMs || 120000;
    var cooldownMs = cfg.cooldownOnErrorMs || 900000;

    var timer = null;
    var errCount = 0;

    function setBadge(min) {
      badge.className = "busBadge"; // reset classes

      if (min === null || min === undefined) {
        badge.textContent = "—";
        badge.className += " na";
        return;
      }

      badge.textContent = String(min);

      if (min > 10) badge.className += " good";
      else if (min >= 8) badge.className += " warn";
      else badge.className += " bad";
    }

    function schedule(ms) {
      clearTimeout(timer);

      // ✅ jitter 0–3s : évite sync multi-devices
      var jitter = Math.floor(Math.random() * 3000);

      timer = setTimeout(tick, ms + jitter);
    }

    function fail() {
      errCount++;

      setBadge(null);
      text1.textContent = "STM indisponible";
      text2.textContent = "";

      // ✅ backoff agressif
      if (errCount >= 3) {
        schedule(30 * 60 * 1000); // 30 minutes
      } else {
        schedule(cooldownMs);
      }
    }

    function tick() {
      // ✅ si onglet en arrière-plan : on ralentit
      if (document.hidden) {
        schedule(5 * 60 * 1000);
        return;
      }

      // cache-buster doux (change toutes les 30s)
      var bucket = Math.floor(new Date().getTime() / 30000);

      // IMPORTANT: on passe stop= (même si ton worker l’ignore, c’est ok)
      var url =
        apiBase +
        "?stop=" +
        encodeURIComponent(stopId) +
        "&_=" +
        bucket;

      xhr(url, function (err, data) {
        if (err || !data || !data.ok) {
          fail();
          return;
        }

        errCount = 0;

        var m1 = data.nextBusMinutes;
        var m2 = data.nextBus2Minutes;

        setBadge(m1);
        text1.textContent = m1 === null ? "Aucun passage prévu" : "prochain bus";
        text2.textContent = m2 === null ? "" : "suivant dans " + m2 + " min";

        schedule(refreshMs);
      });
    }

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) schedule(1000);
    });

    tick();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
