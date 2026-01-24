(function () {

  /* ---------------------------------------------------------
     POINT D’ENTRÉE : initialise le widget
  --------------------------------------------------------- */
  function init() {
    var calToday = document.getElementById("calToday");

    var d1 = document.getElementById("calDay1");
    var e1 = document.getElementById("calEvents1");
    var d2 = document.getElementById("calDay2");
    var e2 = document.getElementById("calEvents2");
    var d3 = document.getElementById("calDay3");
    var e3 = document.getElementById("calEvents3");
    var d4 = document.getElementById("calDay4");
    var e4 = document.getElementById("calEvents4");

    if (!d1 || !e1) return;

    /* ------------------------------
       DATE DU JOUR EN HAUT
       Format: "Samedi 24 Janvier 2026"
    ------------------------------ */
    if (calToday) {
      var nowTop = new Date();

      var jours = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
      var mois  = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

      calToday.textContent =
        jours[nowTop.getDay()] + " " +
        nowTop.getDate() + " " +
        mois[nowTop.getMonth()] + " " +
        nowTop.getFullYear();
    }

    /* ------------------------------
       Chargement ICS puis rendu
    ------------------------------ */
    loadICS(function (events) {
      render(events, [d1, e1], [d2, e2], [d3, e3], [d4, e4]);
      hideEmptyDays();
    });
  }

  /* ---------------------------------------------------------
     CHARGEMENT DU FICHIER ICS (anti-cache Safari)
  --------------------------------------------------------- */
  function loadICS(cb) {
    var xhr = new XMLHttpRequest();
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
     PARSE ICS → extraction des événements
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
     CONVERSION date ICS → Date JS
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
     RENDER : 4 jours, titres + séparateur + events
     Layout générique (component.css):
       - item-row
       - item-left clamp-2
       - item-right w-64 tabular
       - muted
       - divider divider--tight
  --------------------------------------------------------- */
  function render(events, d1, d2, d3, d4) {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 4 jours : aujourd'hui + 3
    var days = [];
    for (var i = 0; i < 4; i++) {
      days.push(new Date(today.getTime() + i * 86400000));
    }

    // groupés par jour
    var groups = [[], [], [], []];

    // filtre + classement par jour
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];

      // ignore les événements terminés
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

    // tri par heure de début
    for (var g = 0; g < 4; g++) {
      groups[g].sort(function (a, b) {
        return a.start - b.start;
      });
    }

    function fmtDate(d) {
      var dd = d.getDate();
      var mm = d.getMonth() + 1;
      var yy = d.getFullYear();
      if (dd < 10) dd = "0" + dd;
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
      var names = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
      return names[d.getDay()];
    }

    function label(i, d) {
      if (i === 0) return "Aujourd’hui — " + fmtDate(d);
      if (i === 1) return "Demain — " + fmtDate(d);
      return weekday(d) + " — " + fmtDate(d);
    }

    var slots = [d1, d2, d3, d4];

    for (var i = 0; i < 4; i++) {
      var dayEl = slots[i][0];
      var evEl = slots[i][1];

      // Titre de sous-case
      dayEl.textContent = label(i, days[i]);

      // Reset zone events
      evEl.innerHTML = "";

      // Séparateur juste sous le titre
      var sep = document.createElement("div");
      sep.className = "divider divider--tight";
      evEl.appendChild(sep);

      var list = groups[i];
      if (list.length === 0) continue;

      // Events
      for (var j = 0; j < list.length; j++) {
        var ev = list[j];

        // Ligne "gauche / droite"
        var row = document.createElement("div");
        row.className = "item-row";

        // Texte à gauche (2 lignes max)
        var left = document.createElement("div");
        left.className = "item-left clamp-2";
        left.textContent = ev.summary;

        // Heures à droite (2 lignes, alignées, largeur fixe)
        var right = document.createElement("div");
        right.className = "item-right w-64 tabular";

        var tStart = document.createElement("div");
        tStart.textContent = fmtTime(ev.start);

        var tEnd = document.createElement("div");
        tEnd.className = "muted";
        tEnd.textContent = ev.end ? fmtTime(ev.end) : "";

        right.appendChild(tStart);
        right.appendChild(tEnd);

        row.appendChild(left);
        row.appendChild(right);

        evEl.appendChild(row);
      }
    }
  }

  /* ---------------------------------------------------------
     CACHE LES SOUS-CASES QUI N’ONT AUCUN ÉVÉNEMENT
     (on cache si aucun .item-row)
  --------------------------------------------------------- */
  function hideEmptyDays() {
    for (var i = 1; i <= 4; i++) {
      var events = document.getElementById("calEvents" + i);
      var box = document.getElementById("dayBox" + i);

      if (events && box) {
        var hasEvent = events.querySelector && events.querySelector(".item-row");
        box.style.display = hasEvent ? "block" : "none";
      }
    }
  }

  /* ---------------------------------------------------------
     AUTO-REFRESH
  --------------------------------------------------------- */
  setInterval(init, 60000);

  /* ---------------------------------------------------------
     LANCEMENT
  --------------------------------------------------------- */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
