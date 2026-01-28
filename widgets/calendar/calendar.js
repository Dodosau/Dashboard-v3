(function () {

  // URLs des deux calendriers (GitHub Pages)
  var ICS_MAIN_URL = "https://dodosau.github.io/Dashboard-v3/calendar.ics";
  var ICS_BDAY_URL = "https://dodosau.github.io/Dashboard-v3/calendrierAnniversaires.ics";

  // Fenêtre de génération des occurrences (anniversaires)
  // (on garde large, le rendu auto-fit coupe ce qui dépasse)
  var LOOKAHEAD_DAYS = 60;

  function init() {
    var calToday = document.getElementById("calToday");
    var calList = document.getElementById("calList");
    if (!calToday || !calList) return;

    setTopDate(calToday);

    loadTwoICS(function (allEvents) {
      renderAutoFit(calList, allEvents);
    });
  }

  /* ---------------------------------------------------------
     Date du jour en haut (FR, sans année)
  --------------------------------------------------------- */
  function setTopDate(el) {
    var now = new Date();
    var jours = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
    var mois  = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

    el.textContent =
      jours[now.getDay()] + " " +
      now.getDate() + " " +
      mois[now.getMonth()];
  }

  /* ---------------------------------------------------------
     Chargement de 2 ICS (agenda + anniversaires)
  --------------------------------------------------------- */
  function loadTwoICS(cb) {
    var done = 0;
    var a = [];
    var b = [];

    loadICS(ICS_MAIN_URL, function (events) {
      a = events || [];
      done++;
      if (done === 2) cb(mergeAndExpand(a, b));
    });

    loadICS(ICS_BDAY_URL, function (events) {
      b = events || [];
      done++;
      if (done === 2) cb(mergeAndExpand(a, b));
    });
  }

  function loadICS(url, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url + "?v=" + Date.now(), true);

    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          cb(parseICS(xhr.responseText));
        } else {
          cb([]); // si l'un échoue, on n'explose pas le widget
        }
      }
    };

    xhr.send();
  }

  /* ---------------------------------------------------------
     Parse ICS (support lines foldées + DTSTART/DTEND + RRULE)
  --------------------------------------------------------- */
  function parseICS(text) {
    // Déplie les "folded lines" ICS : \r\n + espace/tab => continuation
    var unfolded = text.replace(/\r\n[ \t]/g, "");

    var events = [];
    var blocks = unfolded.split("BEGIN:VEVENT");

    for (var i = 1; i < blocks.length; i++) {
      var block = blocks[i];

      var summary = (block.match(/SUMMARY:(.+)/) || [])[1];
      var uid = (block.match(/UID:(.+)/) || [])[1];

      var dtstartLine = (block.match(/DTSTART[^:]*:([0-9T]+)/) || [])[1];
      var dtendLine   = (block.match(/DTEND[^:]*:([0-9T]+)/) || [])[1];
      var rruleLine   = (block.match(/RRULE:(.+)/) || [])[1];

      if (!summary || !dtstartLine) continue;

      var isAllDay = (dtstartLine.length === 8); // YYYYMMDD

      events.push({
        uid: uid ? uid.trim() : "",
        summary: cleanText(summary),
        start: parseICSTime(dtstartLine),
        end: dtendLine ? parseICSTime(dtendLine) : null,
        allDay: isAllDay,
        rrule: rruleLine ? rruleLine.trim() : null
      });
    }

    return events;
  }

  function cleanText(s) {
    return String(s).trim().replace(/\\n/g, " ").replace(/\s+/g, " ");
  }

  function parseICSTime(str) {
    // All-day: YYYYMMDD
    if (str && str.length === 8) {
      return new Date(
        parseInt(str.substring(0, 4), 10),
        parseInt(str.substring(4, 6), 10) - 1,
        parseInt(str.substring(6, 8), 10),
        0, 0, 0
      );
    }

    // Timed: YYYYMMDDTHHMM(SS)
    return new Date(
      parseInt(str.substring(0, 4), 10),
      parseInt(str.substring(4, 6), 10) - 1,
      parseInt(str.substring(6, 8), 10),
      parseInt(str.substring(9, 11), 10),
      parseInt(str.substring(11, 13), 10)
    );
  }

  /* ---------------------------------------------------------
     Merge + expansion YEARLY pour anniversaires
     - RRULE:FREQ=YEARLY => occurrences générées dans la fenêtre
     - Les anniversaires sont marqués isBirthday=true + allDay=true
  --------------------------------------------------------- */
  function mergeAndExpand(mainEvents, bdayEvents) {
    var now = new Date();
    var startRange = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // today 00:00
    var endRange = new Date(startRange.getTime() + LOOKAHEAD_DAYS * 86400000);

    var out = [];

    // agenda normal
    for (var i = 0; i < mainEvents.length; i++) out.push(mainEvents[i]);

    // anniversaires
    for (var j = 0; j < bdayEvents.length; j++) {
      var ev = bdayEvents[j];

      var isYearly = ev.rrule && /FREQ=YEARLY/i.test(ev.rrule);
      if (isYearly) {
        var expanded = expandYearly(ev, startRange, endRange);
        for (var k = 0; k < expanded.length; k++) out.push(expanded[k]);
      } else {
        // événement unique (sans RRULE)
        ev.allDay = true;
        ev.isBirthday = true;
        out.push(ev);
      }
    }

    return out;
  }

  function expandYearly(ev, rangeStart, rangeEnd) {
    var res = [];

    // Mois/jour du DTSTART d'origine
    var m = ev.start.getMonth();
    var d = ev.start.getDate();

    // On couvre un peu large
    var y0 = rangeStart.getFullYear() - 1;
    var y1 = rangeEnd.getFullYear() + 1;

    for (var y = y0; y <= y1; y++) {
      var occ = new Date(y, m, d, 0, 0, 0);

      // Cas 29 février: si invalid, JS saute au mois suivant => on ignore
      if (occ.getMonth() !== m || occ.getDate() !== d) continue;

      if (occ >= rangeStart && occ < rangeEnd) {
        res.push({
          uid: ev.uid,
          summary: ev.summary,
          start: occ,
          end: null,
          allDay: true,
          isBirthday: true
        });
      }
    }

    return res;
  }

  /* ---------------------------------------------------------
     AUTO-FIT renderer
  --------------------------------------------------------- */
  function renderAutoFit(listEl, events) {
    var now = new Date();
    var today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    listEl.innerHTML = "";

    // Filtre: on garde les events non terminés
    var upcoming = [];
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      if (ev.end && ev.end < now) continue;
      upcoming.push(ev);
    }

    // Trie global
    upcoming.sort(function (a, b) { return a.start - b.start; });

    // Groupe par jour
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
    for (var k = 0; k < orderedKeys.length; k++) {
      var key = orderedKeys[k];
      var dayDate = keyToDate(key);
      if (dayDate < today0) continue;

      var section = buildDaySection(dayDate, map[key]);
      listEl.appendChild(section);

      // Stop si dépasse (pas de scroll)
      if (listEl.scrollHeight > listEl.clientHeight) {
        listEl.removeChild(section);
        break;
      }
    }

    if (listEl.children.length === 0) {
      var empty = document.createElement("div");
      empty.className = "small text-center";
      empty.textContent = "Aucun événement à venir";
      listEl.appendChild(empty);
    }
  }

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

  function dayDiff(d) {
    var now = new Date();
    var today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((d0 - today0) / 86400000);
  }

  function dayLabel(d) {
    var diffDays = dayDiff(d);
    if (diffDays === 0) return "AUJOURD'HUI — " + fmtDate(d);
    if (diffDays === 1) return "DEMAIN — " + fmtDate(d);
    return weekday(d) + " — " + fmtDate(d);
  }

  /* ---------------------------------------------------------
     Un jour (sub-box) + tri interne
  --------------------------------------------------------- */
  function buildDaySection(dayDate, events) {
    var box = document.createElement("div");
    box.className = "sub-box";
    var diffDays = dayDiff(dayDate);
    if (diffDays === 0) box.className += " sub-box--today";
    if (diffDays === 1) box.className += " sub-box--tomorrow";

    var title = document.createElement("div");
    title.className = "small";
    title.textContent = dayLabel(dayDate);
    box.appendChild(title);

    var sep = document.createElement("div");
    sep.className = "divider divider--tight";
    box.appendChild(sep);

    events.sort(function (a, b) {
      // 1) Anniversaires d’abord
      if (!!a.isBirthday !== !!b.isBirthday) return a.isBirthday ? -1 : 1;

      // 2) All-day ensuite
      if (!!a.allDay !== !!b.allDay) return a.allDay ? -1 : 1;

      // 3) Par heure
      return a.start - b.start;
    });

    for (var i = 0; i < events.length; i++) {
      var ev = events[i];

      var row = document.createElement("div");
      row.className = "item-row";

      var left = document.createElement("div");
      left.className = "item-left clamp-2-safe";
      if (diffDays === 0) left.className += " item-left--today";

      var right = document.createElement("div");
      right.className = "item-right w-64 tabular";

      if (ev.allDay) {
        // 🎂 Anniversaire (rose)
        if (ev.isBirthday) {
          row.className = "item-row allday birthday";
          left.textContent = "🎂 " + ev.summary;

          var b = document.createElement("span");
          b.className = "badge badge-birthday";
          b.textContent = "ANNIV";
          right.appendChild(b);

        // 📌 Journée normale (vert)
        } else {
          row.className = "item-row allday";
          left.textContent = "📌 " + ev.summary;

          var b2 = document.createElement("span");
          b2.className = "badge badge-allday";
          b2.textContent = "JOURNÉE";
          right.appendChild(b2);
        }

      } else {
        // Heures en 2 lignes ultra-stable (texte brut + \n)
        // (CSS: white-space: pre)
        right.textContent = fmtTime(ev.start) + (ev.end ? "\n" + fmtTime(ev.end) : "");
        left.textContent = ev.summary;
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
