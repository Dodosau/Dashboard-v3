import fs from "node:fs";
import path from "node:path";

// =====================
// Config (à adapter si besoin)
// =====================
const STM_API_KEY = process.env.STM_API_KEY;
if (!STM_API_KEY) {
  console.error("Missing STM_API_KEY");
  process.exit(1);
}

const UPSTREAM_URL = "https://api.stm.info/pub/od/gtfs-rt/ic/v2/tripUpdates";

// Ton besoin: ligne 55, stop 52103, 3 prochains bus
const ROUTE_ID = "55";
const STOP_ID = "52103";
const N_NEXT = 3;

// Sortie
const OUT_DIR = path.join(process.cwd(), "data");
const OUT_FILE = path.join(OUT_DIR, "prochainBus55.json");

// =====================
// Safe fetch bytes (protobuf)
// =====================
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

// =====================
// Minimal protobuf reader (varint + length-delimited)
// Enough for GTFS-RT scanning
// =====================
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

const textDecoder = new TextDecoder();

// FeedMessage.entity (field 2) -> FeedEntity.trip_update (field 4)
// TripUpdate.trip (field 1) -> TripDescriptor.route_id (field 5)
// TripUpdate.stop_time_update (field 2) -> StopTimeUpdate.stop_id (field 1)
// StopTimeUpdate.arrival/departure (field 2/3) -> StopTimeEvent.time (field 1)
function getNextDeparturesUnix(feedBytes, routeWanted, stopWanted, nWanted) {
  const nowSec = Math.floor(Date.now() / 1000);
  const best = []; // sorted ascending, distinct

  const r = new Reader(feedBytes);
  while (!r.eof()) {
    const tag = r.varint();
    const field = tag >>> 3;
    const wire = tag & 7;

    if (field === 2 && wire === 2) {
      const entity = r.bytes();
      const t = findEarliestForStopInEntity(entity, routeWanted, stopWanted, nowSec);
      if (t != null && t >= nowSec) {
        insertDistinctSorted(best, t, nWanted);
      }
    } else {
      r.skip(wire);
    }
  }

  return { nowSec, times: best };
}

function insertDistinctSorted(arr, value, maxLen) {
  if (arr.includes(value)) return;
  arr.push(value);
  arr.sort((a, b) => a - b);
  if (arr.length > maxLen) arr.length = maxLen;
}

function findEarliestForStopInEntity(entityBytes, routeWanted, stopWanted, nowSec) {
  const er = new Reader(entityBytes);
  while (!er.eof()) {
    const tag = er.varint();
    const field = tag >>> 3;
    const wire = tag & 7;

    if (field === 4 && wire === 2) {
      const tripUpdate = er.bytes();
      const t = findEarliestForStopInTripUpdate(tripUpdate, routeWanted, stopWanted, nowSec);
      if (t != null) return t;
    } else {
      er.skip(wire);
    }
  }
  return null;
}

function findEarliestForStopInTripUpdate(tripUpdateBytes, routeWanted, stopWanted, nowSec) {
  const tr = new Reader(tripUpdateBytes);

  let routeId = null;
  const stopUpdates = [];

  while (!tr.eof()) {
    const tag = tr.varint();
    const field = tag >>> 3;
    const wire = tag & 7;

    if (field === 1 && wire === 2) {
      // trip descriptor
      const tripDesc = tr.bytes();
      routeId = readRouteIdFromTripDescriptor(tripDesc) ?? routeId;
    } else if (field === 2 && wire === 2) {
      // stop_time_update
      stopUpdates.push(tr.bytes());
    } else {
      tr.skip(wire);
    }
  }

  if (routeId != null && routeId !== routeWanted) return null;

  let best = null;
  for (const stu of stopUpdates) {
    const { stopId, time } = readStopTimeUpdate(stu);
    if (stopId === stopWanted && time != null && time >= nowSec) {
      if (best == null || time < best) best = time;
    }
  }
  return best;
}

function readRouteIdFromTripDescriptor(tripDescBytes) {
  const r = new Reader(tripDescBytes);
  while (!r.eof()) {
    const tag = r.varint();
    const field = tag >>> 3;
    const wire = tag & 7;
    // route_id = field 5 (len)
    if (field === 5 && wire === 2) {
      return textDecoder.decode(r.bytes());
    } else {
      r.skip(wire);
    }
  }
  return null;
}

function readStopTimeUpdate(stuBytes) {
  const r = new Reader(stuBytes);
  let stopId = null;
  let time = null;

  while (!r.eof()) {
    const tag = r.varint();
    const field = tag >>> 3;
    const wire = tag & 7;

    if (field === 1 && wire === 2) {
      stopId = textDecoder.decode(r.bytes());
    } else if ((field === 2 || field === 3) && wire === 2) {
      const ev = r.bytes();
      const t = readTimeFromStopTimeEvent(ev);
      if (t != null) time = time == null ? t : Math.min(time, t);
    } else {
      r.skip(wire);
    }
  }

  return { stopId, time };
}

function readTimeFromStopTimeEvent(evBytes) {
  const r = new Reader(evBytes);
  while (!r.eof()) {
    const tag = r.varint();
    const field = tag >>> 3;
    const wire = tag & 7;

    if (field === 1 && wire === 0) return r.varint(); // time
    r.skip(wire);
  }
  return null;
}

// =====================
// Main
// =====================
async function main() {
  const nowUnix = Math.floor(Date.now() / 1000);

  let feedBytes = null;
  let error = null;

  try {
    feedBytes = await safeFetchBytes(UPSTREAM_URL, { timeoutMs: 5000, maxBytes: 2_500_000 });
  } catch (e) {
    error = String(e?.message || e);
  }

  let nextUnix = [];
  let nextMinutes = [];

  if (feedBytes) {
    const { nowSec, times } = getNextDeparturesUnix(feedBytes, ROUTE_ID, STOP_ID, N_NEXT);
    nextUnix = times;
    nextMinutes = times.map((t) => Math.max(0, Math.round((t - nowSec) / 60)));
  }

  const out = {
    ok: !!feedBytes,
    route: ROUTE_ID,
    stop: STOP_ID,
    updatedAtUnix: nowUnix,
    nextMinutes,
    nextUnix,
    source: "stm-gtfs-rt tripUpdates",
    error,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), "utf8");

  console.log(`Wrote ${OUT_FILE}`);
}

main();
