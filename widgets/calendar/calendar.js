function loadCalendar() {
  fetch("calendar.ics")
    .then(r => r.text())
    .then(text => {
      const events = parseICS(text);
      displayGroupedEvents(events);
    })
    .catch(e => {
      document.getElementById("calendar").innerHTML = "Erreur : " + e;
    });
}

function parseICS(text) {
  const events = [];
  const blocks = text.split("BEGIN:VEVENT");

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];

    const summaryMatch = block.match(/SUMMARY:(.+)/);
    const dtstartMatch = block.match(/DTSTART(?:;TZID=[^:]+)?:([0-9T]+)/);
    const dtendMatch = block.match(/DTEND(?:;TZID=[^:]+)?:([0-9T]+)/);

    if (summaryMatch && dtstartMatch) {
      const summary = summaryMatch[1].trim();
      const start = parseICSTime(dtstartMatch[1]);
      const end = dtendMatch ? parseICSTime(dtendMatch[1]) : null;

      events.push({ summary, start, end });
    }
  }

  return events;
}

function parseICSTime(str) {
  return new Date(
    parseInt(str.slice(0, 4)),
    parseInt(str.slice(4, 6)) - 1,
    parseInt(str.slice(6, 8)),
    parseInt(str.slice(9, 11)),
    parseInt(str.slice(11, 13))
  );
}

function formatTime(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return h + ":" + m;
}

function displayGroupedEvents(events) {
  const container = document.getElementById("calendar");
  container.innerHTML = "";

  const now = new Date();

  // -----------------------------
  // 1️⃣ Définir la fenêtre : aujourd’hui → +3 jours
  // -----------------------------
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const maxDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

  // -----------------------------
  // 2️⃣ Garder seulement les événements dans cette fenêtre
  // -----------------------------
  events = events.filter(ev => {
    const day = new Date(ev.start.getFullYear(), ev.start.getMonth(), ev.start.getDate());
    return day >= today && day <= maxDate;
  });

  // -----------------------------
  // 3️⃣ Supprimer les événements déjà terminés
  // -----------------------------
  events = events.filter(ev => !ev.end || ev.end > now);

  // -----------------------------
  // 4️⃣ Regrouper par jour
  // -----------------------------
  const grouped = {};
  for (const ev of events) {
    const key = new Date(ev.start.getFullYear(), ev.start.getMonth(), ev.start.getDate()).getTime();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ev);
  }

  // -----------------------------
  // 5️⃣ Trier les jours
  // -----------------------------
  const keys = Object.keys(grouped).sort((a, b) => a - b);

  // -----------------------------
  // 6️⃣ Affichage
  // -----------------------------
  for (const key of keys) {
    const date = new Date(parseInt(key));
    const label = date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long"
    });

    const block = document.createElement("div");
    block.className = "day-block";

    const title = document.createElement("div");
    title.className = "day-title";
    title.textContent = "📅 " + label;
    block.appendChild(title);

    // Trier les événements du jour par heure
    grouped[key].sort((a, b) => a.start - b.start);

    for (const ev of grouped[key]) {
      const table = document.createElement("table");
      table.style.width = "100%";

      const tr1 = document.createElement("tr");
      const tr2 = document.createElement("tr");

      const tdLeft = document.createElement("td");
      tdLeft.rowSpan = "2";
      tdLeft.style.verticalAlign = "top";
      tdLeft.style.paddingRight = "10px";
      tdLeft.textContent = ev.summary;

      const tdRight1 = document.createElement("td");
      tdRight1.style.textAlign = "right";
      tdRight1.textContent = "🕘 " + formatTime(ev.start);

      const tdRight2 = document.createElement("td");
      tdRight2.style.textAlign = "right";
      tdRight2.textContent = ev.end ? formatTime(ev.end) : "";

      tr1.appendChild(tdLeft);
      tr1.appendChild(tdRight1);
      tr2.appendChild(tdRight2);

      table.appendChild(tr1);
      table.appendChild(tr2);

      block.appendChild(table);

      const hr = document.createElement("hr");
      block.appendChild(hr);
    }

    container.appendChild(block);
  }
}

loadCalendar();
