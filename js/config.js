window.DASH_CONFIG = {
  locale: "fr-CA",
  timezone: "America/Montreal",

  wedding: { dateISO: "2026-06-17" },

stm: {
  stopId: "52103",

  // Nouveau backend statique GitHub Pages
  apiNext55Two: "https://dodosau.github.io/STM/api/next55-two-52103.json",

  refreshMs: 60000,         // rafraîchit toutes les 60s dans ton dashboard
  cooldownOnErrorMs: 180000 // si erreur, attend 3 min avant retry
},


  weather: {
    latitude: 45.5017,
    longitude: -73.5673,
    refreshMs: 600000
  },

  calendar: {
    apiToday: "https://calendar.doriansauzede.workers.dev/api/today",
    apiUpcoming: "https://calendar.doriansauzede.workers.dev/api/upcoming",
    days: 7,
    refreshMs: 300000
  }
};
