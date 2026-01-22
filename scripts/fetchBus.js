import fetch from "node-fetch";
import fs from "fs";
import protobuf from "protobufjs";

const API_KEY = process.env.STM_API_KEY;

async function fetchBus() {
  try {
    const root = await protobuf.load("protos/gtfs-realtime.proto");
    const FeedMessage = root.lookupType("transit_realtime.FeedMessage");

    const url = "https://api.stm.info/pub/od/gtfs-rt/ic/v2/tripUpdates";

    const res = await fetch(url, {
      headers: { apikey: API_KEY }
    });

    if (!res.ok) {
      console.error("Erreur HTTP STM:", res.status);
      process.exit(1);
    }

    const buffer = new Uint8Array(await res.arrayBuffer());
    const feed = FeedMessage.decode(buffer);

    const routeId = "55";
    const stopId = "52103";

    let arrivals = [];

    for (const entity of feed.entity) {
      if (!entity.trip_update) continue;

      const trip = entity.trip_update.trip;
      if (trip.route_id !== routeId) continue;

      for (const stu of entity.trip_update.stop_time_update) {
        if (stu.stop_id === stopId && stu.arrival?.time) {
          arrivals.push(stu.arrival.time);
        }
      }
    }

    arrivals.sort((a, b) => a - b);

    const now = Math.floor(Date.now() / 1000);

    const next1 = arrivals[0];
    const next2 = arrivals[1];

    const output = {
      ok: true,
      routeId,
      stopId,
      nextBusMinutes: next1 ? Math.max(0, Math.floor((next1 - now) / 60)) : null,
      nextBus2Minutes: next2 ? Math.max(0, Math.floor((next2 - now) / 60)) : null
    };

    if (!fs.existsSync("data")) fs.mkdirSync("data");
    fs.writeFileSync("data/bus.json", JSON.stringify(output, null, 2));

    console.log("bus.json mis à jour :", output);

  } catch (err) {
    console.error("Erreur STM:", err);
    process.exit(1);
  }
}

fetchBus();
