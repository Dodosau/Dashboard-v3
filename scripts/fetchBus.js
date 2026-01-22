// Import des modules nécessaires
import fetch from "node-fetch";     // Pour appeler l’API STM
import fs from "fs";                // Pour écrire bus.json
import protobuf from "protobufjs";  // Pour décoder le flux Protobuf STM

// Clé API STM (via GitHub Secrets)
const API_KEY = process.env.STM_API_KEY;

async function fetchBus() {
  try {
    // Vérification de la clé API
    if (!API_KEY) {
      console.error("STM_API_KEY manquant");
      process.exit(1);
    }

    // Chargement du fichier .proto (définition GTFS-RT)
    const root = await protobuf.load("protos/gtfs-realtime.proto");
    const FeedMessage = root.lookupType("transit_realtime.FeedMessage");

    // URL STM officielle (TripUpdates)
    const url = "https://api.stm.info/pub/od/gtfs-rt/ic/v2/tripUpdates";

    console.log("Appel STM:", url);

    // Appel HTTP avec header apikey + accept protobuf
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

    // Récupération du flux binaire
    const buffer = new Uint8Array(await res.arrayBuffer());
    console.log("Taille de la réponse (octets):", buffer.length);

    // Décodage Protobuf → objet JS
    const feed = FeedMessage.decode(buffer);

    // Paramètres de filtrage
    const routeWanted = "55";
    const stopWanted = "52103";
    const nowSec = Math.floor(Date.now() / 1000);

    let times = [];

    // DEBUG : combien d'entités dans le flux ?
    console.log("DEBUG: Nombre total d'entités STM :", feed.entity.length);

    // DEBUG : combien de trips pour la ligne 55 ?
    const trips55 = feed.entity.filter(
      e => e.trip_update && e.trip_update.trip.route_id === routeWanted
    );
    console.log("DEBUG: Trips trouvés pour la ligne 55 :", trips55.length);

    // DEBUG : liste des stop_id trouvés
    let debugStops = new Set();
    for (const e of trips55) {
      for (const stu of e.trip_update.stop_time_update) {
        debugStops.add(stu.stop_id);
      }
    }
    console.log(
      "DEBUG: stop_id présents dans les TripUpdates de la ligne 55 :",
      Array.from(debugStops).slice(0, 50)
    );

    // Parcours des entités
    for (const entity of feed.entity) {
      if (!entity.trip_update) continue;

      const trip = entity.trip_update.trip;
      const routeId = trip.route_id || null;

      // On garde seulement la ligne 55
      if (routeId !== routeWanted) continue;

      // Parcours des arrêts du trip
      for (const stu of entity.trip_update.stop_time_update) {
        const stopId = stu.stop_id || "";

        // MATCH PERMISSIF (comme ton Worker Cloudflare)
        if (!(stopId === stopWanted || stopId.includes(stopWanted))) continue;

        // Lecture de departure.time EN PRIORITÉ (comme Cloudflare)
        const t =
          (stu.departure && stu.departure.time) ||
          (stu.arrival && stu.arrival.time) ||
          null;

        if (!t) continue;
        if (t < nowSec) continue;

        times.push(t);
      }
    }

    // DEBUG : timestamps trouvés
    console.log("DEBUG: timestamps trouvés pour stop 52103 :", times);

    // Tri des timestamps
    times.sort((a, b) => a - b);

    // Sélection des deux prochains bus
    const best1 = times[0] ?? null;
    const best2 = times[1] ?? null;

    // Conversion en minutes
    const nextBusMinutes =
      best1 == null ? null : Math.max(0, Math.round((best1 - nowSec) / 60));

    const nextBus2Minutes =
      best2 == null ? null : Math.max(0, Math.round((best2 - nowSec) / 60));

    // Structure finale
    const output = {
      ok: true,
      routeId: routeWanted,
      stopId: stopWanted,
      nextBusMinutes,
      nextBus2Minutes
    };

    // Création du dossier data/ si nécessaire
    if (!fs.existsSync("data")) fs.mkdirSync("data");

    // Écriture du fichier final
    fs.writeFileSync("data/bus.json", JSON.stringify(output, null, 2));

    console.log("bus.json mis à jour :", output);

  } catch (err) {
    console.error("Erreur STM:", err);
    process.exit(1);
  }
}

// Exécution
fetchBus();
