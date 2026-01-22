// On importe les modules nécessaires
import fetch from "node-fetch";   // Pour appeler l’API STM
import fs from "fs";              // Pour écrire bus.json
import protobuf from "protobufjs"; // Pour décoder le flux Protobuf STM

// On récupère la clé API depuis les secrets GitHub
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

    // URL STM officielle (GTFS-RT TripUpdates)
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

    // Si la STM renvoie une erreur HTTP → on arrête
    if (!res.ok) {
      console.error("Erreur HTTP STM:", res.status);
      process.exit(1);
    }

    // On récupère le flux binaire (Protobuf)
    const buffer = new Uint8Array(await res.arrayBuffer());
    console.log("Taille de la réponse (octets):", buffer.length);

    // Décodage Protobuf → objet JS
    const feed = FeedMessage.decode(buffer);

    // Paramètres de filtrage
    const routeWanted = "55";   // Ligne 55
    const stopWanted = "52103"; // Arrêt par défaut
    const nowSec = Math.floor(Date.now() / 1000); // Timestamp actuel

    let times = []; // Liste des timestamps trouvés

    // On parcourt toutes les entités du flux
    for (const entity of feed.entity) {
      if (!entity.trip_update) continue; // On ignore les entités sans TripUpdate

      const trip = entity.trip_update.trip;
      const routeId = trip.route_id || null;

      // On garde seulement la ligne 55
      if (routeId !== routeWanted) continue;

      // On parcourt les arrêts du trip
      for (const stu of entity.trip_update.stop_time_update) {
        const stopId = stu.stop_id || "";

        // MATCH PERMISSIF (comme ton Worker Cloudflare)
        // → accepte stopId === "52103" ou stopId contenant "52103"
        if (!(stopId === stopWanted || stopId.includes(stopWanted))) continue;

        // On lit departure.time EN PRIORITÉ (comme Cloudflare)
        const t =
          (stu.departure && stu.departure.time) ||
          (stu.arrival && stu.arrival.time) ||
          null;

        // Si pas de timestamp → on ignore
        if (!t) continue;

        // On ignore les temps déjà passés
        if (t < nowSec) continue;

        // On ajoute le timestamp valide
        times.push(t);
      }
    }

    // On trie les timestamps du plus proche au plus loin
    times.sort((a, b) => a - b);

    // On prend les deux prochains bus
    const best1 = times[0] ?? null;
    const best2 = times[1] ?? null;

    // Conversion en minutes (arrondi + pas de valeurs négatives)
    const nextBusMinutes =
      best1 == null ? null : Math.max(0, Math.round((best1 - nowSec) / 60));

    const nextBus2Minutes =
      best2 == null ? null : Math.max(0, Math.round((best2 - nowSec) / 60));

    // Structure finale du JSON (comme ton Worker Cloudflare)
    const output = {
      ok: true,
      routeId: routeWanted,
      stopId: stopWanted,
      nextBusMinutes,
      nextBus2Minutes
    };

    // On crée le dossier data/ si nécessaire
    if (!fs.existsSync("data")) fs.mkdirSync("data");

    // On écrit bus.json
    fs.writeFileSync("data/bus.json", JSON.stringify(output, null, 2));

    console.log("bus.json mis à jour :", output);

  } catch (err) {
    // En cas d’erreur → on log et on arrête
    console.error("Erreur STM:", err);
    process.exit(1);
  }
}

// On lance la fonction
fetchBus();
