(function () {
  function icon(code) {
    if (code === 0) return "☀️";
    if (code <= 2) return "⛅";
    if (code <= 3) return "☁️";
    if (code >= 61 && code <= 82) return "🌧️";
    if (code >= 71 && code <= 86) return "❄️";
    if (code >= 95) return "⛈️";
    return "🌡️";
  }

  function text(code) {
    if (code === 0) return "Ensoleillé";
    if (code <= 2) return "Partiellement nuageux";
    if (code <= 3) return "Couvert";
    if (code >= 61 && code <= 82) return "Pluie";
    if (code >= 71 && code <= 86) return "Neige";
    if (code >= 95) return "Orage";
    return "Variable";
  }

  function xhr(url, cb) {
    var r = new XMLHttpRequest();
    r.onreadystatechange = function () {
      if (r.readyState === 4) {
        if (r.status === 200) {
          try {
            cb(null, JSON.parse(r.responseText));
          } catch (e) {
            cb(e);
          }
        } else {
          cb(new Error("HTTP " + r.status));
        }
      }
    };
    r.open("GET", url, true);
    r.send();
  }

  function init() {
    var tempNow = document.getElementById("tempNow");
    var weatherIcon = document.getElementById("weatherIcon");
    var weatherText = document.getElementById("weatherText");
    var tempRange = document.getElementById("tempRange");
    var precipProb = document.getElementById("precipProb");

    if (!tempNow || !weatherIcon || !weatherText || !tempRange || !precipProb) {
      return;
    }

    var cfg = window.DASH_CONFIG.weather || {};
    var lat = cfg.latitude || 45.5017;
    var lon = cfg.longitude || -73.5673;
    var tz = window.DASH_CONFIG.timezone || "America/Montreal";
    var refreshMs = cfg.refreshMs || 600000;

    function refresh() {
      var url =
        "https://api.open-meteo.com/v1/forecast" +
        "?latitude=" + encodeURIComponent(lat) +
        "&longitude=" + encodeURIComponent(lon) +
        "&current=temperature_2m,weather_code" +
        "&hourly=precipitation_probability" +
        "&daily=temperature_2m_min,temperature_2m_max" +
        "&timezone=" + encodeURIComponent(tz);

      xhr(url, function (err, d) {
        if (err || !d || !d.current) {
          weatherText.textContent = "Météo indisponible";
          return;
        }

        tempNow.textContent = Math.round(d.current.temperature_2m) + "°C";
        weatherIcon.textContent = icon(d.current.weather_code);
        weatherText.textContent = text(d.current.weather_code);

        if (d.daily && d.daily.temperature_2m_min) {
          tempRange.textContent =
            Math.round(d.daily.temperature_2m_min[0]) +
            "° / " +
            Math.round(d.daily.temperature_2m_max[0]) +
            "°";
        }

        if (d.hourly && d.hourly.precipitation_probability) {
          precipProb.textContent =
            Math.round(d.hourly.precipitation_probability[0]) + "%";
        }
      });
    }

    refresh();
    setInterval(refresh, refreshMs);
  }

  // Lancer après injection HTML
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
