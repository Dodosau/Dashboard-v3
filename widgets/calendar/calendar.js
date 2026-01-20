function loadCalendar() {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'widgets/calendar/events.json', true);

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      var container = document.getElementById('calendar-events');

      if (xhr.status === 200) {
        try {
          var events = JSON.parse(xhr.responseText);
          container.innerHTML = '';

          if (!events || events.length === 0) {
            container.innerHTML = '<p>Aucun rendez-vous aujourd’hui.</p>';
            return;
          }

          events.forEach(function (ev) {
            var div = document.createElement('div');
            div.className = 'event';
            div.innerHTML = '<strong>' + ev.time + '</strong> — ' + ev.summary;
            container.appendChild(div);
          });
        } catch (e) {
          container.innerHTML = '<p>Erreur de lecture du calendrier.</p>';
        }
      } else {
        container.innerHTML = '<p>Impossible de charger le calendrier.</p>';
      }
    }
  };

  xhr.send();
}

loadCalendar();
