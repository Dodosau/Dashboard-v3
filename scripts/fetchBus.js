import fetch from "node-fetch";
import fs from "fs";
import protobuf from "protobufjs";

const API_KEY = process.env.STM_API_KEY;

// Durée maximale pendant laquelle on accepte un cache "stale"
// Cloudflare utilisait environ 20–30 secondes
const MAX_CACHE_AGE_SEC = 120; // 2 minutes

// Lecture du cache local (bus.json)
function readCache() {
  try {
    if (!fs.existsSync("data/bus.json")) return null;
    const raw = fs.readFileSync("data/bus.json", "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Écriture du cache local
function writeCache(obj) {
  if (!fs.existsSync("data")) fs.mkdirSync("data");
  fs.writeFileSync("data/bus.json", JSON.stringify(obj, null, 2));
}

async function fetchBus() {
  try {
    if (!API_KEY) {
      console.error("STM_API_KEY manquant");
      process.exit(1);
    }

    // Charger le .proto
    const root = await protobuf.load("protos/gtfs-realtime.proto");
    const FeedMessage = root.lookupType("transit_realtime.FeedMessage");

    // Lire le cache existant
    const cache = readCache();
    const nowSec = Math.floor(Date.now() / 1000);

    const url = "https://api.stm.info/pub/od/gtfs-rt/ic/v2/tripUpdates";
    const res = await fetch(url, {
      headers: {
        apikey: API_KEY,
        accept: "application/x-protobuf"
      }
    });

    if (!res.ok) {
      console.error("Erreur HTTP STM:", res.status);

      // Fallback : si le cache est récent → on le renvoie
      if (cache && nowSec - cache.generatedAtUnix < MAX_CACHE_AGE_SEC) {
        console.log("Fallback: utilisation du cache récent");
        writeCache(cache);
        return;
      }

      // Sinon → pas de fallback possible
      writeCache({
        ok: false,
        message: "STM unreachable and cache expired",
        nextBusMinutes: null,
        nextBus2Minutes: null,
        generatedAtUnix: nowSec
      });
      return;
    }

    // Décodage du flux STM
    const buffer = new Uint8Array(await res.arrayBuffer());
    const feed = FeedMessage.decode(buffer);

    const routeWanted = "55";
    const stopWanted = "52103";

    let times = [];

    // Extraction temps réel
    for (const entity of feed.entity) {
      if (!entity.trip_update) continue;

      const trip = entity.trip_update.trip;
      if (trip.route_id !== routeWanted) continue;

      for (const stu of entity.trip_update.stop_time_update) {
        const stopId = stu.stop_id || "";

        // Matching permissif (comme Cloudflare)
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

    // Si on n’a trouvé aucun bus → fallback cache
    if (times.length === 0) {
      console.log("Aucun bus trouvé dans le flux STM → fallback cache");

      if (cache && nowSec - cache.generatedAtUnix < MAX_CACHE_AGE_SEC) {
        // On garde le dernier résultat valide
        cache.message = "STALE (fallback)";
        cache.generatedAtUnix = nowSec;
        writeCache(cache);
        return;
      }

      // Cache trop vieux → on renvoie null
      writeCache({
        ok: true,
        routeId: routeWanted,
        stopId: stopWanted,
        nextBusMinutes: null,
        nextBus2Minutes: null,
        message: "No realtime data and cache expired",
        generatedAtUnix: nowSec
      });
      return;
    }

    // On a trouvé du temps réel → on met à jour le cache
    times.sort((a, b) => a - b);

    const best1 = times[0];
    const best2 = times[1] || null;

    const nextBusMinutes = Math.max(0, Math.round((best1 - nowSec) / 60));
    const nextBus2Minutes =
      best2 == null ? null : Math.max(0, Math.round((best2 - nowSec) / 60));

    const output = {
      ok: true,
      routeId: routeWanted,
      stopId: stopWanted,
      nextBusMinutes,
      nextBus2Minutes,
      departureTimeUnix: best1,
      departure2TimeUnix: best2,
      message: "OK",
      generatedAtUnix: nowSec
    };

    writeCache(output);
    console.log("Temps réel trouvé → cache mis à jour :", output);

  } catch (err) {
    console.error("Erreur STM:", err);
    process.exit(1);
  }
}

fetchBus();
