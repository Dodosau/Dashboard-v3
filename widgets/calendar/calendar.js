(function () {
  var el = document.getElementById("calendar");
  if (!el) return;

  el.innerHTML = "<div class='small'>Chargement…</div>";

  var url = "https://dodosau.github.io/Dashboard-v3/calendar.ics";

  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        var events = parseICS(xhr.responseText);
        displayEvents(events);
      } else {
        el.innerHTML = "<div class='small'>Erreur : " + xhr.status + "</div>";
      }
    }
  };

  xhr.send();

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

  function displayEvents(events) {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var maxDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

    events = events.filter(function (ev) {
      var d = new Date(ev.start.getFullYear(), ev.start.getMonth(), ev.start.getDate());
      return d >= today && d <= maxDate;
    });

    events = events.filter(function (ev) {
      return !ev.end || ev.end > now;
    });

    var grouped = {};
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      var key = new Date(ev.start.getFullYear(), ev.start.getMonth(), ev.start.getDate()).getTime();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(ev);
    }

    var keys = Object.keys(grouped).sort(function (a, b) { return a - b; });

    el.innerHTML = "";

    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      var date = new Date(parseInt(key, 10));

      var label = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();

      var dayTitle = document.createElement("div");
      dayTitle.className = "small";
      dayTitle.style.marginBottom = "6px";
      dayTitle.textContent = label;
      el.appendChild(dayTitle);

      grouped[key].sort(function (a, b) {
        return a.start - b.start;
      });

      for (var j = 0; j < grouped[key].length; j++) {
        var ev2 = grouped[key][j];

        var wrapper = document.createElement("div");
        wrapper.style.marginBottom = "10px";

        var title = document.createElement("div");
        title.textContent = ev2.summary;
        wrapper.appendChild(title);

        var time = document.createElement("div");
        time.className = "small";
        time.textContent = formatTime(ev2.start) + (ev2.end ? " - " + formatTime(ev2.end) : "");
        wrapper.appendChild(time);

        el.appendChild(wrapper);
      }
    }
  }
})();
