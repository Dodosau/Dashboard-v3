(function () {
  var el = document.getElementById("calendar");
  if (!el) return;

  el.innerHTML = "Chargement du calendrier…";

  var url = "https://dodosau.github.io/Dashboard-v3/calendar.ics";

  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        var events = parseICS(xhr.responseText);
        displayEvents(events);
      } else {
        el.innerHTML = "Erreur de chargement : " + xhr.status;
      }
    }
  };

  xhr.send();

  // -----------------------------
  // PARSE ICS
  // -----------------------------
  function parseICS(text) {
    var events = [];
    var blocks = text.split("BEGIN:VEVENT");

    for (var i = 1; i < blocks.length; i++) {
      var block = blocks[i];

      var summaryMatch = block.match(/SUMMARY:(.+)/);
      var startMatch = block.match(/DTSTART(?:;TZID=[^:]+)?:([0-9T]+)/);
      var endMatch = block.match(/DTEND(?:;TZID=[^:]+)?:([0-9T]+)/);

      if (summaryMatch && startMatch) {
        var summary = summaryMatch[1].trim();
        var start = parseICSTime(startMatch[1]);
        var end = endMatch ? parseICSTime(endMatch[1]) : null;

        events.push({ summary: summary, start: start, end: end });
      }
    }

    return events;
  }

  // -----------------------------
  // PARSE DATE ICS
  // -----------------------------
  function parseICSTime(str) {
    return new Date(
      parseInt(str.substring(0, 4), 10),
      parseInt(str.substring(4, 6), 10) - 1,
      parseInt(str.substring(6, 8), 10),
      parseInt(str.substring(9, 11), 10),
      parseInt(str.substring(11, 13), 10)
    );
  }

  // -----------------------------
  // FORMAT HEURE
  // -----------------------------
  function formatTime(date) {
    var h = date.getHours();
    var m = date.getMinutes();
    if (h < 10) h = "0" + h;
    if (m < 10) m = "0" + m;
    return h + ":" + m;
  }

  // -----------------------------
  // AFFICHAGE FILTRÉ
  // -----------------------------
  function displayEvents(events) {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var maxDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Garder seulement aujourd’hui → +3 jours
    events = events.filter(function (ev) {
      var d = new Date(ev.start.getFullYear(), ev.start.getMonth(), ev.start.getDate());
      return d >= today && d <= maxDate;
    });

    // Supprimer les événements déjà terminés
    events = events.filter(function (ev) {
      return !ev.end || ev.end > now;
    });

    // Regrouper par jour
    var grouped = {};
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      var key = new Date(ev.start.getFullYear(), ev.start.getMonth(), ev.start.getDate()).getTime();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(ev);
    }

    var keys = Object.keys(grouped).sort(function (a, b) { return a - b; });

    el.innerHTML = "";

    // Affichage
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      var date = new Date(parseInt(key, 10));

      var label = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();

      var block = document.createElement("div");
      block.className = "day-block";

      var title = document.createElement("div");
      title.className = "day-title";
      title.appendChild(document.createTextNode(label));
      block.appendChild(title);

      // Trier les événements du jour
      grouped[key].sort(function (a, b) {
        return a.start - b.start;
      });

      for (var j = 0; j < grouped[key].length; j++) {
        var ev2 = grouped[key][j];

        var table = document.createElement("table");
        var tr1 = document.createElement("tr");
        var tr2 = document.createElement("tr");

        var tdLeft = document.createElement("td");
        tdLeft.rowSpan = "2";
        tdLeft.style.verticalAlign = "top";
        tdLeft.style.paddingRight = "10px";
        tdLeft.appendChild(document.createTextNode(ev2.summary));

        var tdRight1 = document.createElement("td");
        tdRight1.style.textAlign = "right";
        tdRight1.appendChild(document.createTextNode(formatTime(ev2.start)));

        var tdRight2 = document.createElement("td");
        tdRight2.style.textAlign = "right";
        tdRight2.appendChild(document.createTextNode(ev2.end ? formatTime(ev2.end) : ""));

        tr1.appendChild(tdLeft);
        tr1.appendChild(tdRight1);
        tr2.appendChild(tdRight2);

        table.appendChild(tr1);
        table.appendChild(tr2);
        block.appendChild(table);

        var hr = document.createElement("hr");
        block.appendChild(hr);
      }

      el.appendChild(block);
    }
  }
})();
