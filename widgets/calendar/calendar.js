function loadCalendar() {
  fetch("../../calendar.ics")
    .then(function(r) { return r.text(); })
    .then(function(text) {
      var events = parseICS(text);
      displayGroupedEvents(events);
    })
    .catch(function(e) {
      document.getElementById("calendar").innerHTML = "Erreur : " + e;
    });
}

function parseICS(text) {
  var events = [];
  var blocks = text.split("BEGIN:VEVENT");

  for (var i = 1; i < blocks.length; i++) {
    var block = blocks[i];

    var summaryMatch = block.match(/SUMMARY:(.+)/);
    var dtstartMatch = block.match(/DTSTART(?:;TZID=[^:]+)?:([0-9T]+)/);
    var dtendMatch = block.match(/DTEND(?:;TZID=[^:]+)?:([0-9T]+)/);

    if (summaryMatch && dtstartMatch) {
      var summary = summaryMatch[1].trim();
      var start = parseICSTime(dtstartMatch[1]);
      var end = dtendMatch ? parseICSTime(dtendMatch[1]) : null;

      events.push({ summary: summary, start: start, end: end });
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

function formatTime(date) {
  var h = date.getHours();
  var m = date.getMinutes();

  if (h < 10) h = "0" + h;
  if (m < 10) m = "0" + m;

  return h + ":" + m;
}

function displayGroupedEvents(events) {
  var container = document.getElementById("calendar");
  container.innerHTML = "";

  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var maxDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Filtrer la fenêtre de dates
  events = events.filter(function(ev) {
    var day = new Date(ev.start.getFullYear(), ev.start.getMonth(), ev.start.getDate());
    return day >= today && day <= maxDate;
  });

  // Filtrer les événements déjà terminés
  events = events.filter(function(ev) {
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

  // Trier les jours
  var keys = Object.keys(grouped).sort(function(a, b) { return a - b; });

  // Affichage
  for (var k = 0; k < keys.length; k++) {
    var key = keys[k];
    var date = new Date(parseInt(key, 10));

    var label = date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long"
    });

    var block = document.createElement("div");
    block.className = "day-block";

    var title = document.createElement("div");
    title.className = "day-title";
    title.appendChild(document.createTextNode("📅 " + label));
    block.appendChild(title);

    // Trier les événements du jour
    grouped[key].sort(function(a, b) {
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
      tdRight1.appendChild(document.createTextNode("🕘 " + formatTime(ev2.start)));

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

    container.appendChild(block);
  }
}

loadCalendar();
