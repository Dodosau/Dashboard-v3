import fetch from "node-fetch";
import fs from "fs";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";

const API_KEY = process.env.STM_API_KEY;

async function fetchBus() {
  try {
    const response = await fetch(
      "https://api.stm.info/pub/od/gtfs-rt/ic/v1/trip-updates",
      {
        headers: { apikey: API_KEY }
      }
    );

    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );

    const routeId = "55";
    const stopId = "52103";

    let results = [];

    for (const entity of feed.entity) {
      if (!entity.tripUpdate) continue;

      const trip = entity.tripUpdate.trip;
      if (trip.routeId !== routeId) continue;

      for (const stu of entity.tripUpdate.stopTimeUpdate) {
        if (stu.stopId === stopId) {
          results.push({
            routeId,
            stopId,
            arrival: stu.arrival?.time || null,
            departure: stu.departure?.time || null
          });
        }
      }
    }

    if (results.length === 0) {
      console.log("Aucun bus trouvé");
      return;
    }

    // Trier par heure d’arrivée
    results.sort((a, b) => a.arrival - b.arrival);

    const now = Math.floor(Date.now() / 1000);

    const next1 = results[0];
    const next2 = results[1] || null;

    const output = {
      ok: true,
      routeId,
      stopId,
      nextBusMinutes: Math.max(0, Math.floor((next1.arrival - now) / 60)),
      nextBus2Minutes: next2
        ? Math.max(0, Math.floor((next2.arrival - now) / 60))
        : null
    };

    if (!fs.existsSync("data")) {
      fs.mkdirSync("data");
    }

    fs.writeFileSync("data/bus.json", JSON.stringify(output, null, 2));

    console.log("Bus.json mis à jour :", output);

  } catch (err) {
    console.error("Erreur STM:", err);
    process.exit(1);
  }
}

fetchBus();
