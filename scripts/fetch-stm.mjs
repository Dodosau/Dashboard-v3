import fs from "node:fs";
import path from "node:path";

// =====================
// Config
// =====================
const STM_API_KEY = process.env.STM_API_KEY;
if (!STM_API_KEY) {
  console.error("Missing STM_API_KEY");
  process.exit(1);
}

const upstreamUrl = "https://api.stm.info/pub/od/gtfs-rt/ic/v2/tripUpdates";

// Ligne / arrêt
const ROUTE_ID = "55";
const STOP_ID = "52103";

// Sortie unique
const OUT_DIR = path.join(process.cwd(), "data");
const OUT_FILE = path.join(OUT_DIR, "prochainBus55.json");

// =====================
// Safe fetch (identique à ton code)
// =====================
async function fetchUpstreamSafe(url, apiKey, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 4000;
  const maxBytes = opts.maxBytes ?? 2_500_000;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort("timeout"), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { apiKey, accept: "application/x-protobuf" },
      signal: controller.signal
    });

    if (!res.ok) return { res, bytesOrNull: null };

    const ab = await res.arrayBuffer();
    if (ab.byteLength > maxBytes) {
      return {
        res: new Response(null, { status: 502, statusText: "Upstream payload too large" }),
        bytesOrNull: null
      };
    }

    return { res, bytesOrNull: new Uint8Array(ab) };
  } catch (e) {
    return {
      res: new Response(null, { status: 504, statusText: "Upstream fetch failed" }),
      bytesOrNull: null
    };
  } finally {
    clearTimeout(t);
  }
}

// =====================
// Protobuf Reader + parsers (identique à ton code)
// =====================
class Reader {
  constructor(u8) { this.u8 = u8; this.i = 0; }
  eof() { return this.i >= this.u8.length; }
  _need(n) { if (this.i + n > this.u8.length) throw new Error("Read past end"); }
  varint() {
    let x = 0, s = 0;
    for (let k = 0; k < 10; k++) {
      this._need(1);
      const b = this.u8[this.i++];
      x |= (b & 0x7f) << s;
      if ((b & 0x80) === 0) return x >>> 0;
      s += 7;
    }
    throw new Error("varint overflow");
  }
  varint64() {
    let x = 0n, s = 0n;
    for (let k = 0; k < 12; k++) {
      this._need(1);
      const b = BigInt(this.u8[this.i++]);
      x |= (b & 0x7fn) << s;
      if ((b & 0x80n) === 0n) return Number(x);
      s += 7n;
    }
    throw new Error("varint64 overflow");
  }
  bytes() {
    const len = this.varint();
    this._need(len);
    const start = this.i;
    this.i += len;
    return this.u8.slice(start, start + len);
  }
  string() { return new TextDecoder().decode(this.bytes()); }
  skip(wire) {
    if (wire === 0) return void this.varint64();
    if (wire === 1) return void (this._need(8), this.i += 8);
    if (wire === 2) { const len = this.varint(); this._need(len); this.i += len; return; }
    if (wire === 5) return void (this._need(4), this.i += 4);
    throw new Error("Unsupported wire type");
  }
}

function parseFeedHeader(feedBytes) {
  const r = new Reader(feedBytes);
  let headerBytes = null;

  while (!r.eof()) {
    const tag = r.varint();
    const field = tag >>> 3;
    const wire = tag & 7;
    if (field === 1 && wire === 2) { headerBytes = r.bytes(); break; }
    r.skip(wire);
  }

  if (!headerBytes) return { gtfsRealtimeVersion: null, incrementality: null, timestamp: null };

  const hr = new Reader(headerBytes);
  let gtfsRealtimeVersion = null;
  let incrementality = null;
  let timestamp = null;

  while (!hr.eof()) {
    const tag = hr.varint();
    const field = tag >>> 3;
    const wire = tag & 7;

    if (field === 1 && wire === 2) gtfsRealtimeVersion = hr.string();
    else if (field === 2 && wire === 0) incrementality = hr.varint();
    else if (field === 3 && wire === 0) timestamp = hr.varint64();
    else hr.skip(wire);
  }

  return { gtfsRealtimeVersion, incrementality, timestamp };
}

// ✅ MODIF: 2 -> 3 prochains départs
function nextThreeDeparturesForRouteStop_FAST(feedBytes, routeWanted, stopWanted) {
  const r = new Reader(feedBytes);
  const nowSec = Math.floor(Date.now() / 1000);

  let best1 = null;
  let best2 = null;
  let best3 = null;

  while (!r.eof()) {
    const tag = r.varint();
    const field = tag >>> 3;
    const wire = tag & 7;

    if (field === 2 && wire === 2) {
      const ent = r.bytes();
      const t = findNextInEntity(ent, routeWanted, stopWanted, nowSec);

      if (t != null && t >= nowSec) {
        if (best1 == null || t < best1) {
          if (best2 != null) best3 = best2;
          if (best1 != null && t !== best1) best2 = best1;
          best1 = t;
        } else if (t !== best1 && (best2 == null || t < best2)) {
          if (best2 != null) best3 = best2;
          best2 = t;
        } else if (t !== best1 && t !== best2 && (best3 == null || t < best3)) {
          best3 = t;
        }

        // early exit léger
        if (best1 != null && best2 != null && best3 != null && best3 - best1 <= 180) break;
      }
    } else r.skip(wire);
  }

  if (best1 == null) {
    return {
      nextBusMinutes: null,
      nextBus2Minutes: null,
      nextBus3Minutes: null,
      message: "No predictions found",
      departureTimeUnix: null,
      departure2TimeUnix: null,
      departure3TimeUnix: null
    };
  }

  const m1 = Math.max(0, Math.round((best1 - nowSec) / 60));
  const m2 = best2 == null ? null : Math.max(0, Math.round((best2 - nowSec) / 60));
  const m3 = best3 == null ? null : Math.max(0, Math.round((best3 - nowSec) / 60));

  return {
    nextBusMinutes: m1,
    nextBus2Minutes: m2,
    nextBus3Minutes: m3,
    message: "OK",
    departureTimeUnix: best1,
    departure2TimeUnix: best2,
    departure3TimeUnix: best3
  };
}

function findNextInEntity(entityBytes, routeWanted, stopWanted, nowSec) {
  const er = new Reader(entityBytes);
  while (!er.eof()) {
    const tag = er.varint();
    const field = tag >>> 3;
    const wire = tag & 7;
    if (field === 3 && wire === 2) return findNextInTripUpdate(er.bytes(), routeWanted, stopWanted, nowSec);
    er.skip(wire);
  }
  return null;
}

function findNextInTripUpdate(tripUpdateBytes, routeWanted, stopWanted, nowSec) {
  const tr = new Reader(tripUpdateBytes);
  let routeId = null;
  let best = null;

  while (!tr.eof()) {
    const tag = tr.varint();
    const field = tag >>> 3;
    const wire = tag & 7;

    if (field === 1 && wire === 2) routeId = extractRouteIdFromTripDescriptorSafe(tr.bytes());
    else if (field === 2 && wire === 2) {
      const t = extractDepartureTimeIfStopMatches(tr.bytes(), stopWanted);
      if (t != null && t >= nowSec && (best == null || t < best)) best = t;
    } else tr.skip(wire);
  }

  if (routeId !== routeWanted) return null;
  return best;
}

function extractRouteIdFromTripDescriptorSafe(bytes) {
  try {
    const r = new Reader(bytes);
    while (!r.eof()) {
      const tag = r.varint();
      const field = tag >>> 3;
      const wire = tag & 7;
      if (field === 5 && wire === 2) return r.string();
      r.skip(wire);
    }
  } catch {}
  return null;
}

function extractDepartureTimeIfStopMatches(bytes, stopWanted) {
  try {
    const r = new Reader(bytes);
    let stopId = null;
    let departureEventBytes = null;

    while (!r.eof()) {
      const tag = r.varint();
      const field = tag >>> 3;
      const wire = tag & 7;

      if (field === 4 && wire === 2) stopId = r.string();
      else if (field === 2 && wire === 2) departureEventBytes = r.bytes();
      else r.skip(wire);
    }

    if (!stopId) return null;
    if (!(stopId === stopWanted || stopId.includes(stopWanted))) return null;
    if (!departureEventBytes) return null;

    return extractTimeFromStopTimeEvent(departureEventBytes);
  } catch {
    return null;
  }
}

function extractTimeFromStopTimeEvent(bytes) {
  const r = new Reader(bytes);
  let time = null;
  while (!r.eof()) {
    const tag = r.varint();
    const field = tag >>> 3;
    const wire = tag & 7;
    if (field === 2 && wire === 0) time = r.varint64();
    else r.skip(wire);
  }
  return time;
}

// =====================
// Main
// =====================
async function main() {
  const { res, bytesOrNull } = await fetchUpstreamSafe(upstreamUrl, STM_API_KEY);

  const nowSec = Math.floor(Date.now() / 1000);

  // On écrit toujours un fichier pour ton dashboard (même si upstream down)
  const outBase = {
    ok: !!(res?.ok && bytesOrNull),
    routeId: ROUTE_ID,
    stopId: STOP_ID,
    generatedAtUnix: nowSec,
    error: res?.ok ? null : `Upstream error ${res?.status ?? "?"}`
  };

  let out = outBase;

  if (res.ok && bytesOrNull) {
    const status = parseFeedHeader(bytesOrNull);
    const ageSeconds = status.timestamp ? Math.max(0, nowSec - status.timestamp) : null;

    const next = nextThreeDeparturesForRouteStop_FAST(bytesOrNull, ROUTE_ID, STOP_ID);

    // 1 seul fichier final, avec ce qui t'intéresse + status si tu veux
    out = {
      ...outBase,
      message: next.message,
      nextBusMinutes: next.nextBusMinutes,
      nextBus2Minutes: next.nextBus2Minutes,
      nextBus3Minutes: next.nextBus3Minutes,
      departureTimeUnix: next.departureTimeUnix,
      departure2TimeUnix: next.departure2TimeUnix,
      departure3TimeUnix: next.departure3TimeUnix,
      feedTimestampUnix: status.timestamp ?? null,
      feedAgeSeconds: ageSeconds
    };
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(out), "utf8");

  console.log(`Generated ${OUT_FILE}`);
}

main();
