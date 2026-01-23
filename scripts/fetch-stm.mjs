import fs from "node:fs";
import path from "node:path";

const STM_API_KEY = process.env.STM_API_KEY;
if (!STM_API_KEY) {
  console.error("Missing STM_API_KEY");
  process.exit(1);
}

const UPSTREAM_URL = "https://api.stm.info/pub/od/gtfs-rt/ic/v2/tripUpdates";

// Ce que TU veux
const DESIRED_ROUTE = "55";
const DESIRED_STOP = "52103";
const N_NEXT = 3;

// Sortie
const OUT_DIR = path.join(process.cwd(), "data");
const OUT_FILE = path.join(OUT_DIR, "prochainBus55.json");

// -------- safe fetch (protobuf bytes)
async function safeFetchBytes(url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 5000;
  const maxBytes = opts.maxBytes ?? 2_500_000;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort("timeout"), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/x-protobuf",
        ApiKey: STM_API_KEY,
      },
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);

    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) throw new Error(`Upstream too large (${buf.byteLength} bytes)`);
    return buf;
  } finally {
    clearTimeout(t);
  }
}

// -------- minimal protobuf reader
class Reader {
  constructor(u8) {
    this.u8 = u8;
    this.i = 0;
    this.n = u8.length;
  }
  eof() {
    return this.i >= this.n;
  }
  varint() {
    let x = 0;
    let s = 0;
    while (true) {
      if (this.i >= this.n) return 0;
      const b = this.u8[this.i++];
      x |= (b & 0x7f) << s;
      if ((b & 0x80) === 0) return x >>> 0;
      s += 7;
      if (s > 35) return x >>> 0;
    }
  }
  bytes() {
    const len = this.varint();
    const start = this.i;
    const end = Math.min(this.n, start + len);
    this.i = end;
    return this.u8.slice(start, end);
  }
  skip(wire) {
    // 0=varint, 1=64-bit, 2=len, 5=32-bit
    if (wire === 0) this.varint();
    else if (wire === 1) this.i = Math.min(this.n, this.i + 8);
    else if (wire === 2) {
      const len = this.varint();
      this.i = Math.min(this.n, this.i + len);
    } else if (wire === 5) this.i = Math.min(this.n, this.i + 4);
    else this.i = this.n;
  }
}

const td = new TextDecoder();

// -------- decode helpers (GTFS-RT TripUpdates scanning)
function readTripDescriptor(tripDescBytes) {
  // TripDescriptor: trip_id=field 1 (len), route_id=field 5 (len)
  const r = new Reader(tripDescBytes);
  let tripId = null;
  let routeId = null;

  while (!r.eof()) {
    const tag = r.varint();
    const field = tag >>> 3;
    const wire = tag & 7;

    if (field === 1 && wire === 2) tripId = td.decode(r.bytes());
    else if (field === 5 && wire === 2) routeId = td.decode(r.bytes());
    else r.skip(wire);
  }
  return { tripId, routeId };
}

function readStopTimeEventTime(evBytes) {
  // StopTimeEvent: time=field 1 (varint)
  const r = new Reader(evBytes);
  while (!r.eof()) {
    const tag = r.varint();
    const field = tag >>> 3;
    const wire = tag & 7;
    if (field === 1 && wire === 0) return r.varint();
    r.skip(wire);
  }
  return null;
}

function readStopTimeUpdate(stuBytes) {
  // StopTimeUpdate: stop_id=field 1 (len), arrival=field2 (len), departure=field3 (len)
  const r = new Reader(stuBytes);
  let stopId = null;
  let time = null;

  while (!r.eof()) {
    const tag = r.varint();
    const field = tag >>> 3;
    const wire = tag & 7;

    if (field === 1 && wire === 2) {
      stopId = td.decode(r.bytes());
    } else if ((field === 2 || field === 3) && wire === 2) {
      const ev = r.bytes();
      const t = readStopTimeEventTime(ev);
      if (t != null) time = time == null ? t : Math.min(time, t);
    } else {
      r.skip(wire);
    }
  }

  return { stopId, time };
}

// On scan TOUT le flux et on récupère des candidats au stop voulu,
// en gardant routeId/tripId pour ensuite filtrer “intelligemment”.
function collectCandidates(feedBytes, desiredStop, nowSec) {
  const candidates = [];
  const seenStops = new Map(); // stopId -> count (pour debug)
  const seenRouteIds = new Map(); // routeId -> count (pour debug)

  const r = new Reader(feedBytes);
  while (!r.eof()) {
    const tag = r.varint();
    const field = tag >>> 3;
    const wire = tag & 7;

    // FeedMessage.entity = field 2 (len)
    if (field === 2 && wire === 2) {
      const entityBytes = r.bytes();
      const ent = new Reader(entityBytes);

      while (!ent.eof()) {
        const etag = ent.varint();
        const ef = etag >>> 3;
        const ew = etag & 7;

        // FeedEntity.trip_update = field 4 (len)
        if (ef === 4 && ew === 2) {
          const tripUpdateBytes = ent.bytes();
          parseTripUpdate(tripUpdateBytes, desiredStop, nowSec, candidates, seenStops, seenRouteIds);
        } else {
          ent.skip(ew);
        }
      }
    } else {
      r.skip(wire);
    }
  }

  // Top debug
  const topStops = [...seenStops.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topRouteIds = [...seenRouteIds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  return { candidates, topStops, topRouteIds };
}

function parseTripUpdate(tripUpdateBytes, desiredStop, nowSec, candidates, seenStops, seenRouteIds) {
  const tr = new Reader(tripUpdateBytes);
  let tripId = null;
  let routeId = null;

  while (!tr.eof()) {
    const tag = tr.varint();
    const field = tag >>> 3;
    const wire = tag & 7;

    if (field === 1 && wire === 2) {
      const tripDesc = tr.bytes();
      const t = readTripDescriptor(tripDesc);
      tripId = t.tripId ?? tripId;
      routeId = t.routeId ?? routeId;
    } else if (field === 2 && wire === 2) {
      const stuBytes = tr.bytes();
      const { stopId, time } = readStopTimeUpdate(stuBytes);

      if (stopId) seenStops.set(stopId, (seenStops.get(stopId) ?? 0) + 1);
      if (routeId) seenRouteIds.set(routeId, (seenRouteIds.get(routeId) ?? 0) + 1);

      if (stopId === desiredStop && time != null && time >= nowSec) {
        candidates.push({ time, stopId, routeId, tripId });
      }
    } else {
      tr.skip(wire);
    }
  }
}

// Filtre intelligent : on essaie route_id exact, sinon trip_id qui contient "55" (ou "route 55")
// Sinon fallback : on prend sans filtre route (au moins on ne renvoie pas vide)
function pickNextN(candidates, desiredRoute, n) {
  const sorted = [...candidates].sort((a, b) => a.time - b.time);

  const byRouteId = sorted.filter((c) => c.routeId === desiredRoute);
  if (byRouteId.length > 0) return { picked: byRouteId.slice(0, n), filterUsed: "routeId === desiredRoute" };

  const byTripHeuristic = sorted.filter((c) => {
    const t = (c.tripId ?? "").toLowerCase();
    return t.includes(desiredRoute) || t.includes(`_${desiredRoute}_`) || t.includes(`-${desiredRoute}-`);
  });
  if (byTripHeuristic.length > 0) return { picked: byTripHeuristic.slice(0, n), filterUsed: "tripId heuristic contains desiredRoute" };

  return { picked: sorted.slice(0, n), filterUsed: "fallback: no route match, used stop-only" };
}

async function main() {
  const nowUnix = Math.floor(Date.now() / 1000);

  let feedBytes = null;
  let error = null;

  try {
    feedBytes = await safeFetchBytes(UPSTREAM_URL);
  } catch (e) {
    error = String(e?.message || e);
  }

  let out;

  if (!feedBytes) {
    out = {
      ok: false,
      route: DESIRED_ROUTE,
      stop: DESIRED_STOP,
      updatedAtUnix: nowUnix,
      nextMinutes: [],
      nextUnix: [],
      filterUsed: null,
      debug: { topStops: [], topRouteIds: [], sampleCandidates: [] },
      source: "stm-gtfs-rt tripUpdates",
      error,
    };
  } else {
    const nowSec = Math.floor(Date.now() / 1000);
    const { candidates, topStops, topRouteIds } = collectCandidates(feedBytes, DESIRED_STOP, nowSec);

    const { picked, filterUsed } = pickNextN(candidates, DESIRED_ROUTE, N_NEXT);
    const nextUnix = picked.map((p) => p.time);
    const nextMinutes = picked.map((p) => Math.max(0, Math.round((p.time - nowSec) / 60)));

    out = {
      ok: true,
      route: DESIRED_ROUTE,
      stop: DESIRED_STOP,
      updatedAtUnix: nowUnix,
      nextMinutes,
      nextUnix,
      filterUsed,
      // Debug utile pour identifier les vrais IDs STM (route_id/stop_id) si besoin
      debug: {
        candidatesCountForStop: candidates.length,
        sampleCandidates: candidates
          .sort((a, b) => a.time - b.time)
          .slice(0, 10)
          .map(({ time, routeId, tripId, stopId }) => ({ time, routeId, tripId, stopId })),
        topStops,
        topRouteIds,
      },
      source: "stm-gtfs-rt tripUpdates",
      error: null,
    };
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), "utf8");
  console.log(`Wrote ${OUT_FILE}`);
}

main();
