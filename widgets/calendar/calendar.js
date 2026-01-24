(function () {

  /* ---------------------------------------------------------
     POINT D’ENTRÉE : initialise / refresh le widget
  --------------------------------------------------------- */
  function init() {
    var calToday = document.getElementById("calToday");
    var calList = document.getElementById("calList");
    if (!calToday || !calList) return;

    // Date du jour en haut : "Samedi 24 Janvier 2026"
    setTopDate(calToday);

    loadICS(function (events) {
      renderAutoFit(calList, events);
    });
  }

  /* ---------------------------------------------------------
     Date du jour en haut (FR)
  --------------------------------------------------------- */
  function setTopDate(el) {
    var now = new Date();
    var jours = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
    var mois  = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

    el.textContent =
      jours[now.getDay()] + " " +
      now.getDate() + " " +
      mois[now.getMonth()] + " " +
      now.getFullYear();
  }

  /* ---------------------------------------------------------
     CHARGEMENT DU FICHIER ICS (avec anti-cache Safari)
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
     - support événements "all-day" (DTSTART;VALUE=DATE:YYYYMMDD)
  --------------------------------------------------------- */
  function parseICS(text) {
    var events = [];
    var blocks = text.split("BEGIN:VEVENT");

    for (var i = 1; i < blocks.length; i++) {
      var block = blocks[i];

      var summary = (block.match(/SUMMARY:(.+)/) || [])[1];

      // DTSTART et DTEND (support avec ou sans TZID, et VALUE=DATE)
      var startMatch = block.match(/DTSTART(?:;[^:]+)?:([0-9T]+)/);
      var endMatch   = block.match(/DTEND(?:;[^:]+)?:([0-9T]+)/);

      var start = startMatch ? startMatch[1] : null;
      var end   = endMatch ? endMatch[1] : null;

      if (summary && start) {
        var isAllDay = (start.length === 8); // YYYYMMDD

        events.push({
          summary: summary.trim(),
          start: parseICSTime(start),
          end: end ? parseICSTime(end) : null,
          allDay: isAllDay
        });
      }
    }

    return events;
  }

  /* ---------------------------------------------------------
     CONVERSION D’UNE DATE ICS → objet Date JS
     - All-day : YYYYMMDD (pas d'heure)
     - Timed   : YYYYMMDDTHHMM(SS)
  --------------------------------------------------------- */
  function parseICSTime(str) {
    // All-day
    if (str && str.length === 8) {
      return new Date(
        parseInt(str.substring(0, 4), 10),
        parseInt(str.substring(4, 6), 10) - 1,
        parseInt(str.substring(6, 8), 10),
        0, 0, 0
      );
    }

    // Timed
    return new Date(
      parseInt(str.substring(0, 4), 10),
      parseInt(str.substring(4, 6), 10) - 1,
      parseInt(str.substring(6, 8), 10),
      parseInt(str.substring(9, 11), 10),
      parseInt(str.substring(11, 13), 10)
    );
  }

  /* ---------------------------------------------------------
     RENDER "AUTO-FIT"
     Affiche autant de jours/événements que possible
     tant que ça rentre dans la hauteur du widget (sans scroll).
  --------------------------------------------------------- */
  function renderAutoFit(listEl, events) {
    var now = new Date();

    // Clear
    listEl.innerHTML = "";

    // Filtre: on garde les events non terminés
    var upcoming = [];
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      if (ev.end && ev.end < now) continue;
      upcoming.push(ev);
    }

    // Trie global par start
    upcoming.sort(function (a, b) { return a.start - b.start; });

    // Groupe par date YYYY-MM-DD
    var map = {};
    var orderedKeys = [];

    for (var i = 0; i < upcoming.length; i++) {
      var ev = upcoming[i];
      var key = dayKey(ev.start);

      if (!map[key]) {
        map[key] = [];
        orderedKeys.push(key);
      }
      map[key].push(ev);
    }

    // Ajoute les jours tant que ça rentre
    var today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (var k = 0; k < orderedKeys.length; k++) {
      var key = orderedKeys[k];
      var dayDate = keyToDate(key);

      // ignore jours avant aujourd'hui
      if (dayDate < today0) continue;

      var section = buildDaySection(dayDate, map[key]);
      listEl.appendChild(section);

      // Stop si dépasse (pas de scroll)
      if (listEl.scrollHeight > listEl.clientHeight) {
        listEl.removeChild(section);
        break;
      }
    }

    // Message si rien à afficher
    if (listEl.children.length === 0) {
      var empty = document.createElement("div");
      empty.className = "small text-center";
      empty.textContent = "Aucun événement à venir";
      listEl.appendChild(empty);
    }
  }

  /* ---------------------------------------------------------
     Helpers date/heure
  --------------------------------------------------------- */
  function dayKey(d) {
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var dd = d.getDate();
    if (m < 10) m = "0" + m;
    if (dd < 10) dd = "0" + dd;
    return y + "-" + m + "-" + dd;
  }

  function keyToDate(key) {
    var y = parseInt(key.substring(0, 4), 10);
    var m = parseInt(key.substring(5, 7), 10) - 1;
    var d = parseInt(key.substring(8, 10), 10);
    return new Date(y, m, d);
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

  function dayLabel(d) {
    var now = new Date();
    var today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var diffDays = Math.round((d0 - today0) / 86400000);

    if (diffDays === 0) return "Aujourd’hui — " + fmtDate(d);
    if (diffDays === 1) return "Demain — " + fmtDate(d);
    return weekday(d) + " — " + fmtDate(d);
  }

  /* ---------------------------------------------------------
     Construit une "sub-box" pour un jour (avec tri all-day en haut)
  --------------------------------------------------------- */
  function buildDaySection(dayDate, events) {
    var box = document.createElement("div");
    box.className = "sub-box";

    var title = document.createElement("div");
    title.className = "small";
    title.textContent = dayLabel(dayDate);
    box.appendChild(title);

    var sep = document.createElement("div");
    sep.className = "divider divider--tight";
    box.appendChild(sep);

    // ✅ Tri: all-day en premier, puis par heure
    events.sort(function (a, b) {
      if (!!a.allDay !== !!b.allDay) return a.allDay ? -1 : 1;
      return a.start - b.start;
    });

    for (var i = 0; i < events.length; i++) {
      var ev = events[i];

      var row = document.createElement("div");
      row.className = "item-row";

      var left = document.createElement("div");
      // ✅ IMPORTANT: on évite -webkit-line-clamp (bug iOS 12 possible) → clamp-2-safe
      left.className = "item-left clamp-2-safe";
      left.textContent = ev.summary;

      var right = document.createElement("div");
      right.className = "item-right w-64 tabular";

      if (ev.allDay) {
        // Style spécial (dans calendar.css)
        row.className = "item-row allday";

        // Option: icône pour visibilité immédiate
        left.textContent = "📌 " + ev.summary;

        var b = document.createElement("span");
        b.className = "badge badge-allday";
        b.textContent = "JOURNÉE";
        right.appendChild(b);
      } else {
        var tStart = document.createElement("div");
        tStart.textContent = fmtTime(ev.start);
        right.appendChild(tStart);

        // ✅ Ne créer la ligne "fin" que si ev.end existe (évite chevauchements)
        if (ev.end) {
          var tEnd = document.createElement("div");
          tEnd.className = "muted";
          tEnd.textContent = fmtTime(ev.end);
          right.appendChild(tEnd);
        }
      }

      row.appendChild(left);
      row.appendChild(right);
      box.appendChild(row);
    }

    return box;
  }

  /* ---------------------------------------------------------
     Auto-refresh
  --------------------------------------------------------- */
  setInterval(init, 60000);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
