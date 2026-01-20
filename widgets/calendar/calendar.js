(function () {
  function esc(s) {
    s = (s === null || s === undefined) ? "" : String(s);
    return s.replace(/[&<>"']/g, function (m) {
      return ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[m];
    });
  }

  function pad2(n) { n = n | 0; return (n < 10 ? "0" : "") + n; }

  // Fallback FR simple si Intl est absent/buggy
  var FR_DAYS = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
  var FR_MONTHS = ["janvier","fevrier","mars","avril","mai","juin","juillet","aout","septembre","octobre","novembre","decembre"];
  var FR_DAYS_SHORT = ["dim.","lun.","mar.","mer.","jeu.","ven.","sam."];
  var FR_MONTHS_SHORT = ["janv.","fevr.","mars","avr.","mai","juin","juil.","aout","sept.","oct.","nov.","dec."];

  function fmtTodayDate(locale) {
    var d = new Date();
    try {
      if (window.Intl && Intl.DateTimeFormat) {
        return new Intl.DateTimeFormat(locale, {
          weekday: "long", day: "numeric", month: "long", year: "numeric"
        }).format(d);
      }
    } catch (e) {}
    return FR_DAYS[d.getDay()] + " " + d.getDate() + " " + FR_MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  function fmtDayShort(locale, unixSec) {
    var d = new Date(unixSec * 1000);
    try {
      if (window.Intl && Intl.DateTimeFormat) {
        return new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }).format(d);
      }
    } catch (e) {}
    return FR_DAYS_SHORT[d.getDay()] + " " + d.getDate() + " " + FR_MONTHS_SHORT[d.getMonth()];
  }

  function fmtTime(locale, unixSec) {
    var d = new Date(unixSec * 1000);
    try {
      if (window.Intl && Intl.DateTimeFormat) {
        return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(d);
      }
    } catch (e) {}
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  function xhr(url, cb) {
    var r = new XMLHttpRequest();
    r.onreadystatechange = function () {
      if (r.readyState === 4) {
        if (r.status === 200) {
          try { cb(null, JSON.parse(r.responseText)); }
          catch (e) { cb(e); }
        } else {
          cb(new Error("HTTP " + r.status));
        }
      }
    };
    r.open("GET", url, true);
    r.send();
  }

  function init() {
    var cfgAll = window.DASH_CONFIG || {};
    var locale = cfgAll.locale || "fr-CA";
    var cfg = cfgAll.calendar || {};

    var API_TODAY = cfg.apiToday;
    var API_UPCOMING = cfg.apiUpcoming;
    var DAYS = cfg.days || 7;
    var REFRESH_MS = cfg.refreshMs || (5 * 60 * 1000);

    var elTodayDate = document.getElementById("calTodayDate");
    var elBadge = document.getElementById("calTodayBadge");
    var elTodayEvents = document.getElementById("calTodayEvents");
    var elNext = document.getElementById("calNextEvents");

    if (!API_TODAY || !API_UPCOMING || !elTodayEvents || !elNext) return;

    function setBadge(countToday) {
      if (!elBadge) return;
      elBadge.className = "todayBadge"; // reset
      if (countToday <= 1) { elBadge.className += " badge-green"; elBadge.innerHTML = "Tranquille ✅"; }
      else if (countToday <= 3) { elBadge.className += " badge-orange"; elBadge.innerHTML = "Occupé"; }
      else { elBadge.className += " badge-red"; elBadge.innerHTML = "Chargé"; }
    }

    function renderToday(today) {
      if (elTodayDate) elTodayDate.innerHTML = esc(fmtTodayDate(locale));

      var events = (today && today.events && today.events.length) ? today.events.slice(0) : [];
      // tri par startUnix
      events.sort(function (a, b) {
        return ((a.startUnix || 0) - (b.startUnix || 0));
      });

      setBadge(today && typeof today.count === "number" ? today.count : events.length);

      if (!events.length) {
        elTodayEvents.innerHTML = '<div class="small">Aucun événement aujourd’hui ✅</div>';
        return;
      }

      var html = "";
      for (var i = 0; i < events.length; i++) {
        var ev = events[i] || {};
        var time = ev.allDay ? "Toute la journée" : fmtTime(locale, ev.startUnix || 0);
        var title = ev.title || "Sans titre";
        var loc = ev.location ? ('<div class="eventMeta">' + esc(ev.location) + "</div>") : "";
        html += '' +
          '<div class="todayEvent">' +
            '<div class="eventTime">' + esc(time) + '</div>' +
            '<div class="eventBody">' +
              '<div class="eventTitle">' + esc(title) + '</div>' +
              loc +
            '</div>' +
          '</div>';
      }
      elTodayEvents.innerHTML = html;
    }

    function renderUpcoming(up) {
      var events = (up && up.events && up.events.length) ? up.events.slice(0) : [];
      events.sort(function (a, b) {
        return ((a.startUnix || 0) - (b.startUnix || 0));
      });

      // limite
      if (events.length > 12) events = events.slice(0, 12);

      if (!events.length) {
        elNext.innerHTML = '<div class="small">Rien de prévu sur les prochains jours.</div>';
        return;
      }

      var html = "";
      for (var i = 0; i < events.length; i++) {
        var ev = events[i] || {};
        var day = fmtDayShort(locale, ev.startUnix || 0);
        var time = ev.allDay ? "Journée" : fmtTime(locale, ev.startUnix || 0);
        var title = ev.title || "Sans titre";

        html += '' +
          '<div class="nextItem">' +
            '<div class="nextDay">' + esc(day) + '</div>' +
            '<div class="nextMain">' +
              '<div class="nextTime">' + esc(time) + '</div>' +
              '<div class="nextTitle">' + esc(title) + '</div>' +
            '</div>' +
          '</div>';
      }
      elNext.innerHTML = html;
    }

    function failUI() {
      elTodayEvents.innerHTML = '<div class="small">Calendrier indisponible</div>';
      elNext.innerHTML = '<div class="small">—</div>';
      if (elBadge) {
        elBadge.className = "todayBadge";
        elBadge.innerHTML = "Erreur";
      }
    }

    function refresh() {
      // cache-buster doux (change toutes les 30s)
      var bucket = Math.floor(new Date().getTime() / 30000);

      xhr(API_TODAY + "?_=" + bucket, function (err1, today) {
        if (err1 || !today || !today.ok) { failUI(); return; }
        renderToday(today);

        var urlUp = API_UPCOMING + "?days=" + encodeURIComponent(DAYS) + "&_=" + bucket;
        xhr(urlUp, function (err2, up) {
          if (err2 || !up || !up.ok) { failUI(); return; }
          renderUpcoming(up);
        });
      });
    }

    if (window.__CAL_TIMER__) { clearInterval(window.__CAL_TIMER__); }
    refresh();
    window.__CAL_TIMER__ = setInterval(refresh, REFRESH_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
