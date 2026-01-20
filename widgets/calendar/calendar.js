(function () {
  var el = document.getElementById("calendar");
  if (!el) return;

  el.innerHTML = "Chargement du fichier ICS…";

  var url = "https://dodosau.github.io/Dashboard-v3/calendar.ics";

  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        el.innerHTML = "<pre style='white-space:pre-wrap; font-size:12px;'>" +
                       xhr.responseText.replace(/</g, "&lt;") +
                       "</pre>";
      } else {
        el.innerHTML = "Erreur de chargement : " + xhr.status;
      }
    }
  };

  xhr.send();
})();
