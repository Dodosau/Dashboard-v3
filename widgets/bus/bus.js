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
    var busUpdated = document.getElementById("busUpdated");
    var busIcon = document.getElementById("busIcon");

    if (!busNext || !busNext2 || !busUpdated || !busIcon) {
      return;
    }

    var cfg = window.DASH_CONFIG.bus || {};
    var url = cfg.url ||
      "https://dodosau.github.io/STM/api/next55-two-52103.json";

    var refreshMs = cfg.refreshMs || 30000; // 30 sec

    function refresh() {
      xhr(url, function (err, d) {
        if (err || !d || !d.ok) {
          busNext.textContent = "—";
          busNext2.textContent = "—";
          busUpdated.textContent = "Erreur";
          return;
        }

        busNext.textContent = d.nextBusMinutes + " min";
        busNext2.textContent = d.nextBus2Minutes + " min";

        var dt = new Date(d.generatedAtUnix * 1000);
        busUpdated.textContent =
          dt.getHours().toString().padStart(2, "0") + ":" +
          dt.getMinutes().toString().padStart(2, "0");
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
