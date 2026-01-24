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
    ------------------------------ */
    if (calToday) {
      var now = new Date();

      var jours = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
      var mois  = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

      calToday.textContent =
        jours[now.getDay()] + " " +
        now.getDate() + " " +
        mois[now.getMonth()] + " " +
        now.getFullYear();
    }

    /* ------------------------------
       Chargement calendrier
    ------------------------------ */
    loadICS(function (events) {
      render(events, [d1, e1], [d2, e2], [d3, e3], [d4, e4]);
      hideEmptyDays();
    });
  }

  /* ---------------------------------------------------------
     CHARGEMENT ICS (anti-cache Safari)
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
     PARSE ICS
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
     RENDER
  --------------------------------------------------------- */
  function render(events, d1, d2, d3, d4) {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    var days = [];
    for (var i = 0; i < 4; i++) {
      days.push(new Date(today.getTime() + i * 86400000));
    }

    var groups = [[], [], [], []];

    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
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

    var slots = [d1, d2, d3, d4];

    for (var i = 0; i < 4; i++) {
      var dayEl = slots[i][0];
      var evEl = slots[i][1];

      dayEl.textContent = label(i, days[i]);
      evEl.innerHTML = "";

      var list = groups[i];
      if (list.length === 0) continue;

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
     CACHE JOURS VIDES
  --------------------------------------------------------- */
  function hideEmptyDays() {
    for (var i = 1; i <= 4; i++) {
      var events = document.getElementById("calEvents" + i);
      var box = document.getElementById("dayBox" + i);

      if (events && box) {
        box.style.display = events.innerHTML.trim() === "" ? "none" : "block";
      }
    }
  }

  /* --------------------------------------------------------- */
  setInterval(init, 60000);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
