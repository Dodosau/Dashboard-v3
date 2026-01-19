window.DASH_CONFIG = {
  locale: "fr-CA",
  timezone: "America/Montreal",

  wedding: { dateISO: "2026-06-17" },

  stm: {
    stopId: "52103",
    // IMPORTANT: tu utilises /api/next55 (d’après ton test)
    apiNext55Two: "https://stm-bus.doriansauzede.workers.dev/api/next55",
    refreshMs: 60000,
    cooldownOnErrorMs: 180000
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
