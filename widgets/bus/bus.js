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
    if (minutes <= 5) box.classList.add("color-red");
    else if (minutes <= 9) box.classList.add("color-orange");
    else box.classList.add("color-green");
  }

  function setDash(el) {
    if (el) el.textContent = "—";
  }

  function clearColor(box) {
    if (!box) return;
    box.classList.remove("color-green", "color-orange", "color-red");
  }

  // ===============================
  // Helpers minutes
  // ===============================
  function toMinutes(unixSeconds, nowMs) {
    if (!unixSeconds) return null;
    var t = unixSeconds * 1000;
    var m = Math.floor((t - nowMs) / 60000);
    return m;
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
          clearColor(box1);
          clearColor(box2);
          return;
        }

        var now = Date.now();

        // minutes brutes (peuvent être négatives / null)
        var m1 = toMinutes(d.departureTimeUnix, now);
        var m2 = toMinutes(d.departure2TimeUnix, now);
        var m3 = toMinutes(d.departure3TimeUnix, now);

        // ===============================
        // SHIFT "PROPRE" :
        // - on retire ce qui est <= 0 (bus déjà passé ou "à 0")
        // - on garde l’ordre t1 -> t2 -> t3
        // - on prend les 2 premiers restants
        // ===============================
        var list = [];

        if (m1 != null && m1 > 0) list.push(m1);
        if (m2 != null && m2 > 0) list.push(m2);
        if (m3 != null && m3 > 0) list.push(m3);

        var a = list.length > 0 ? list[0] : null;
        var b = list.length > 1 ? list[1] : null;

        // ===============================
        // Affichage (2 cases seulement)
        // ===============================
        busNext.textContent = a != null ? a + " min" : "—";
        busNext2.textContent = b != null ? b + " min" : "—";

        // ===============================
        // Couleurs
        // ===============================
        if (a != null) applyColor(box1, a);
        else clearColor(box1);

        if (b != null) applyColor(box2, b);
        else clearColor(box2);
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
