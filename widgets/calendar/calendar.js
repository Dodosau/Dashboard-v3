(function () {

  function init() {
    var calToday = document.getElementById("calToday");
    var calList = document.getElementById("calList");
    if (!calToday || !calList) return;

    setTopDate(calToday);

    loadICS(function (events) {
      renderAutoFit(calList, events);
    });
  }

  function setTopDate(el) {
    var now = new Date();
    var jours = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
    var mois  = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

    el.textContent =
      jours[now.getDay()] + " " +
      now.getDate() + " " +
      mois[now.getMonth()];
  }

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

  function parseICSTime(str) {
    return new Date(
      parseInt(str.substring(0, 4), 10),
      parseInt(str.substring(4, 6), 10) - 1,
      parseInt(str.substring(6, 8), 10),
      parseInt(str.substring(9, 11), 10),
      parseInt(str.substring(11, 13), 10)
    );
  }

  function renderAutoFit(listEl, events) {
    var now = new Date();

    listEl.innerHTML = "";

    // Events à venir (non terminés)
    var upcoming = [];
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      if (ev.end && ev.end < now) continue;
      upcoming.push(ev);
    }

    // Tri global
    upcoming.sort(function (a, b) { return a.start - b.start; });

    // Groupe par jour (YYYY-MM-DD)
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

      // ignore jours avant aujourd'hui (sécurité)
      var today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (dayDate < today0) continue;

      var section = buildDaySection(dayDate, map[key]);
      listEl.appendChild(section);

      // Stop si dépasse
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

  function dayLabel(d) {
    var now = new Date();
    var today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var diffDays = Math.round((d0 - today0) / 86400000);

    if (diffDays === 0) return "Aujourd’hui — " + fmtDate(d);
    if (diffDays === 1) return "Demain — " + fmtDate(d);
    return weekday(d) + " — " + fmtDate(d);
  }

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

    events.sort(function (a, b) { return a.start - b.start; });

    for (var i = 0; i < events.length; i++) {
      var ev = events[i];

      var row = document.createElement("div");
      row.className = "item-row";

      var left = document.createElement("div");
      left.className = "item-left clamp-2";
      left.textContent = ev.summary;

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

      box.appendChild(row);
    }

    return box;
  }

  setInterval(init, 60000);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
