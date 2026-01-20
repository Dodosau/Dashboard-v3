function loadCalendar() {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'widgets/calendar/events.json', true);

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          renderSection('calendar-today', data.today);
          renderSection('calendar-tomorrow', data.tomorrow);
          renderSection('calendar-upcoming', data.upcoming);
        } catch (e) {
          showError();
        }
      } else {
        showError();
      }
    }
  };

  xhr.send();

  function renderSection(id, events) {
    var container = document.getElementById(id);
    container.innerHTML = '';

    if (!events || events.length === 0) {
      container.innerHTML = '<p>Aucun événement.</p>';
      return;
    }

    events.forEach(function (ev) {
      var div = document.createElement('div');
      div.className = 'event';
      div.innerHTML = '<strong>' + ev.time + '</strong>' + ev.summary;
      container.appendChild(div);
    });
  }

  function showError() {
    ['calendar-today', 'calendar-tomorrow', 'calendar-upcoming'].forEach(function (id) {
      document.getElementById(id).innerHTML = '<p>Erreur de chargement.</p>';
    });
  }
}

loadCalendar();
