window.DASH_CONFIG = {
  locale: "fr-CA",
  timezone: "America/Montreal",

  wedding: { dateISO: "2026-06-17" },

  // ✅ BUS STM — réglages anti-1102
  stm: {
    stopId: "52103",
    apiNext55Two: "https://stm-bus.doriansauzede.workers.dev/api/next55",

    // ✅ moins de requêtes
    refreshMs: 120000,          // 2 minutes

    // ✅ si erreur/1102 : pause longue
    cooldownOnErrorMs: 900000   // 15 minutes
  },

  weather: {
    latitude: 45.5017,
    longitude: -73.5673,
    refreshMs: 10 * 60 * 1000
  },

  calendar: {
    apiToday: "https://calendar.doriansauzede.workers.dev/api/today",
    apiUpcoming: "https://calendar.doriansauzede.workers.dev/api/upcoming",
    days: 7,
    refreshMs: 5 * 60 * 1000
  },

  maps: {
    origin: "267 Rue Rachel Est, Montréal, QC",
    destination: "6666 Rue Saint-Urbain, Montréal, QC"
  }
};
