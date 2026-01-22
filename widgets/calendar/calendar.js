(function () {

  /* ---------------------------------------------------------
     POINT D’ENTRÉE : initialise le widget
  --------------------------------------------------------- */
  function init() {
    // Récupère les éléments HTML pour les 4 jours
    var d1 = document.getElementById("calDay1");
    var e1 = document.getElementById("calEvents1");
    var d2 = document.getElementById("calDay2");
    var e2 = document.getElementById("calEvents2");
    var d3 = document.getElementById("calDay3");
    var e3 = document.getElementById("calEvents3");
    var d4 = document.getElementById("calDay4");
    var e4 = document.getElementById("calEvents4");

    // Si le widget n’est pas encore chargé → on arrête
    if (!d1 || !e1) return;

    // Charge le fichier ICS puis affiche les événements
    loadICS(function (events) {
      render(events, [d1, e1], [d2, e2], [d3, e3], [d4, e4]);
      hideEmptyDays(); // 🔥 Cache les sous-cases vides
    });
  }

  /* ---------------------------------------------------------
     CHARGEMENT DU FICHIER ICS (avec anti-cache Safari)
  --------------------------------------------------------- */
  function loadICS(cb) {
    var xhr = new XMLHttpRequest();

    // Ajout d’un timestamp pour forcer Safari à recharger le fichier
    var url = "https://dodosau.github.io/Dashboard-v3/calendar.ics?v=" + Date.now();

    xhr.open("GET", url, true);

    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4 && xhr.status === 200) {
        cb(parseICS(xhr.responseText));
      }
    };

    xhr.send();
  }

  /* ---------------------------------------------------------
     PARSE DU FICHIER ICS → extraction des événements
  --------------------------------------------------------- */
  function parseICS(text) {
    var events = [];
    var blocks = text.split("BEGIN:VEVENT");

    for (var i = 1; i < blocks.length; i++) {
      var block = blocks[i];

      var summary = (block.match(/SUMMARY:(.+)/) || [])[1];
      var start = (block.match(/DTSTART(?:;TZID=[^:]+)?:([0-9T]+)/) || [])[1];
      var end = (block.match(/DTEND(?:;TZID=[^:]+)?:([0-9T]+)/) || [])[1];

      if (summary && start) {
        events.push({
          summary: summary.trim(),
          start: parseICSTime(start),
          end: end ? parseICSTime(end) : null
        });
      }
    }

    return events;
  }

  /* ---------------------------------------------------------
     CONVERSION D’UNE DATE ICS → objet Date JS
  --------------------------------------------------------- */
  function parseICSTime(str) {
    return new Date(
      parseInt(str.substring(0, 4), 10),
      parseInt(str.substring(4, 6), 10) - 1,
      parseInt(str.substring(6, 8), 10),
      parseInt(str.substring(9, 11), 10),
      parseInt(str.substring(11, 13), 10)
    );
  }

  /* ---------------------------------------------------------
     AFFICHAGE DES ÉVÉNEMENTS DANS LES 4 SOUS-CASES
  --------------------------------------------------------- */
  function render(events, d1, d2, d3, d4) {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Les 4 jours à afficher : aujourd’hui + 3 jours
    var days = [];
    for (var i = 0; i < 4; i++) {
      days.push(new Date(today.getTime() + i * 86400000));
    }

    // Tableau contenant les événements groupés par jour
    var groups = [[], [], [], []];

    // Filtre les événements passés et les classe par jour
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];

      // Ignore les événements déjà terminés
      if (ev.end && ev.end < now) continue;

      for (var d = 0; d < 4; d++) {
        var day = days[d];
        if (
          ev.start.getFullYear() === day.getFullYear() &&
          ev.start.getMonth() === day.getMonth() &&
          ev.start.getDate() === day.getDate()
        ) {
          groups[d].push(ev);
        }
      }
    }

    /* ------------------------------
       Fonctions utilitaires
    ------------------------------ */
    function fmtDate(d) {
      var dd = d.getDate();
      var mm = d.getMonth() + 1;
      var yy = d.getFullYear();
      if (mm < 10) mm = "0" + mm;
      return dd + "/" + mm + "/" + yy;
    }

    function fmtTime(d) {
      var h = d.getHours();
      var m = d.getMinutes();
      if (h < 10) h = "0" + h;
      if (m < 10) m = "0" + m;
      return h + ":" + m;
    }

    function weekday(d) {
      var days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
      return days[d.getDay()];
    }

    function label(i, d) {
      if (i === 0) return "Aujourd’hui — " + fmtDate(d);
      if (i === 1) return "Demain — " + fmtDate(d);
      return weekday(d) + " — " + fmtDate(d);
    }

    /* ------------------------------
       Injection dans le HTML
    ------------------------------ */
    var slots = [d1, d2, d3, d4];

    for (var i = 0; i < 4; i++) {
      var dayEl = slots[i][0];
      var evEl = slots[i][1];

      // Titre du jour
      dayEl.textContent = label(i, days[i]);

      // Reset des événements
      evEl.innerHTML = "";

      var list = groups[i];

      // Si aucun événement → on laisse vide (sera caché ensuite)
      if (list.length === 0) continue;

      // Ajout des événements
      for (var j = 0; j < list.length; j++) {
        var ev = list[j];

        var wrap = document.createElement("div");
        wrap.style.marginBottom = "8px";

        var name = document.createElement("div");
        name.textContent = ev.summary;
        wrap.appendChild(name);

        var time = document.createElement("div");
        time.className = "small";
        time.textContent =
          fmtTime(ev.start) + (ev.end ? " - " + fmtTime(ev.end) : "");
        wrap.appendChild(time);

        evEl.appendChild(wrap);
      }
    }
  }

  /* ---------------------------------------------------------
     CACHE LES SOUS-CASES QUI N’ONT AUCUN ÉVÉNEMENT
  --------------------------------------------------------- */
  function hideEmptyDays() {
    for (var i = 1; i <= 4; i++) {
      var events = document.getElementById("calEvents" + i);
      var box = document.getElementById("dayBox" + i);

      // Si la sous-case existe
      if (events && box) {
        // Si aucun événement → on cache la sous-case
        if (events.innerHTML.trim() === "") {
          box.style.display = "none";
        } else {
          box.style.display = "block";
        }
      }
    }
  }

  /* ---------------------------------------------------------
     AUTO-REFRESH TOUTES LES 60 SECONDES
  --------------------------------------------------------- */
  setInterval(init, 60000);

  /* ---------------------------------------------------------
     LANCEMENT AU CHARGEMENT DE LA PAGE
  --------------------------------------------------------- */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
