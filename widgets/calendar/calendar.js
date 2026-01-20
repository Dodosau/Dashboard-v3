fetch('widgets/calendar/events.json')
  .then(r => r.json())
  .then(events => {
    const container = document.getElementById('calendar-events');
    container.innerHTML = '';

    if (!events || events.length === 0) {
      container.innerHTML = '<p>Aucun rendez-vous aujourd’hui.</p>';
      return;
    }

    events.forEach(ev => {
      const div = document.createElement('div');
      div.className = 'event';
      div.innerHTML = `<strong>${ev.time}</strong> — ${ev.summary}`;
      container.appendChild(div);
    });
  })
  .catch(() => {
    document.getElementById('calendar-events').innerHTML =
      '<p>Erreur de chargement du calendrier.</p>';
  });
