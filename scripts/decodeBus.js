import fs from "fs";
import protobuf from "protobufjs";

async function decodeBus() {
  try {
    const root = await protobuf.load("protos/gtfs-realtime.proto");
    const FeedMessage = root.lookupType("transit_realtime.FeedMessage");

    const buffer = fs.readFileSync("data/stm_raw.bin");
    const feed = FeedMessage.decode(buffer);

    const routeId = "55";
    const stopId = "52103";

    let results = [];

    for (const entity of feed.entity) {
      if (!entity.trip_update) continue;

      const trip = entity.trip_update.trip;
      if (trip.route_id !== routeId) continue;

      for (const stu of entity.trip_update.stop_time_update) {
        if (stu.stop_id === stopId && stu.arrival?.time) {
          results.push(stu.arrival.time);
        }
      }
    }

    results.sort((a, b) => a - b);
    const now = Math.floor(Date.now() / 1000);

    const minutes = results.map(t => Math.max(0, Math.floor((t - now) / 60)));

    console.log("Prochains bus ligne 55 à l’arrêt 52103 :");
    console.log(minutes.slice(0, 2), "minutes");

  } catch (err) {
    console.error("Erreur de décodage:", err);
    process.exit(1);
  }
}

decodeBus();
