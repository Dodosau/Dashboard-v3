import fetch from "node-fetch";
import fs from "fs";
import protobuf from "protobufjs";

const API_KEY = process.env.STM_API_KEY;

async function fetchBus() {
  try {
    if (!API_KEY) {
      console.error("STM_API_KEY manquant");
      process.exit(1);
    }

    const root = await protobuf.load("protos/gtfs-realtime.proto");
    const FeedMessage = root.lookupType("transit_realtime.FeedMessage");

    const url = "https://api.stm.info/pub/od/gtfs-rt/ic/v2/tripUpdates";

    console.log("Appel STM:", url);

    const res = await fetch(url, {
      headers: {
        apikey: API_KEY,
        accept: "application/x-protobuf"
      }
    });

    console.log("Status HTTP:", res.status);

    if (!res.ok) {
      console.error("Erreur HTTP STM:", res.status);
      process.exit(1);
    }

    const buffer = new Uint8Array(await res.arrayBuffer());
    console.log("Taille de la réponse (octets):", buffer.length);

    const feed = FeedMessage.decode(buffer);

    const routeWanted = "55";
    const stopWanted = "52103";
    const nowSec = Math.floor(Date.now() / 1000);

    let times = [];

    for (const entity of feed.entity) {
      if (!entity.trip_update) continue;

      const trip = entity.trip_update.trip;
      const routeId = trip.route_id || null;
      if (routeId !== routeWanted) continue;

      for (const stu of entity.trip_update.stop_time_update) {
        const stopId = stu.stop_id || "";
        if (!(stopId === stopWanted || stopId.includes(stopWanted))) continue;

        const t =
          (stu.departure && stu.departure.time) ||
          (stu.arrival && stu.arrival.time) ||
          null;

        if (!t) continue;
        if (t < nowSec) continue;

        times.push(t);
      }
    }

    times.sort((a, b) => a - b);

    const best1 = times[0] ?? null;
    const best2 = times[1] ?? null;

    const nextBusMinutes =
      best1 == null ? null : Math.max(0, Math.round((best1 - nowSec) / 60));
    const nextBus2Minutes =
      best2 == null ? null : Math.max(0, Math.round((best2 - nowSec) / 60));

    const output = {
      ok: true,
      routeId: routeWanted,
      stopId: stopWanted,
      nextBusMinutes,
      nextBus2Minutes
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
