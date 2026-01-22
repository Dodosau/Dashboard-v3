import fetch from "node-fetch";
import fs from "fs";

const API_KEY = process.env.STM_API_KEY;

async function testFetch() {
  try {
    if (!API_KEY) {
      console.error("STM_API_KEY manquant");
      process.exit(1);
    }

    const url = "https://api.stm.info/pub/od/gtfs-rt/ic/v1/trip-updates";

    console.log("Appel STM:", url);

    const res = await fetch(url, {
      headers: { apikey: API_KEY }
    });

    console.log("Status HTTP:", res.status);

    const buffer = new Uint8Array(await res.arrayBuffer());
    console.log("Taille de la réponse (octets):", buffer.length);

    if (!fs.existsSync("data")) fs.mkdirSync("data");
    fs.writeFileSync("data/stm_raw.bin", buffer);

    console.log("Fichier brut écrit dans data/stm_raw.bin");

  } catch (err) {
    console.error("Erreur STM:", err);
    process.exit(1);
  }
}

testFetch();
