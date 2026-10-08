// Vercel serverless function: live aircraft position for the flight-delay site.
//   GET /api/position?callsign=DAL660  -> the aircraft currently flying that callsign
//   GET /api/position?reg=N389DN       -> that tail number, wherever it is right now
// Data: free community ADS-B feeds (adsb.fi, then adsb.lol). No API key. Answers are cached for 15 s.
const ALLOWED = ["https://kennedyjohnson.github.io", "http://localhost:8812", "http://localhost:8000", "http://127.0.0.1:8812"];
const UA = "flight-live/1.0 (+https://kennedyjohnson.github.io/will-my-flight-be-delayed/)";
const FEEDS = {
  // adsb.fi first: its records include the aircraft model, year and operator; adsb.lol is the fallback
  callsign: [(v) => `https://opendata.adsb.fi/api/v2/callsign/${v}`, (v) => `https://api.adsb.lol/v2/callsign/${v}`],
  reg: [(v) => `https://opendata.adsb.fi/api/v2/registration/${v}`, (v) => `https://api.adsb.lol/v2/reg/${v}`],
};

async function lookup(kind, value, fetchFn = fetch) {
  const trace = [];
  for (const feed of FEEDS[kind]) {
    try {
      const r = await fetchFn(feed(value), { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
      trace.push(r.status);
      if (!r.ok) continue;
      const j = await r.json();
      const a = (j.ac ?? j.aircraft ?? []).find((x) => typeof x.lat === "number" && typeof x.lon === "number");
      if (!a) return { body: { found: false }, trace };
      return {
        trace,
        body: {
          found: true, lat: a.lat, lon: a.lon,
          track: typeof a.track === "number" ? a.track : null,
          alt_ft: typeof a.alt_baro === "number" ? a.alt_baro : a.alt_baro === "ground" ? 0 : null,
          speed_kt: typeof a.gs === "number" ? Math.round(a.gs) : null,
          callsign: String(a.flight ?? "").trim() || null, reg: a.r ?? null, type: a.t ?? null,
          model: a.desc ?? null, year: /^\d{4}$/.test(a.year ?? "") ? Number(a.year) : null, operator: a.ownOp ?? null,
          climb_fpm: typeof a.baro_rate === "number" ? a.baro_rate : null,
          target_alt_ft: typeof a.nav_altitude_mcp === "number" ? a.nav_altitude_mcp : null,
          updated: Math.max(0, Math.round(a.seen_pos ?? a.seen ?? 0)),
        },
      };
    } catch (e) { trace.push(String(e).slice(0, 80)); }
  }
  const unavailable = trace.length > 0 && !trace.includes(200);
  return { body: { found: false, ...(unavailable ? { unavailable: true } : {}) }, trace };
}

function handler(req, res) {
  return run(req, res);
}

async function run(req, res, fetchFn = fetch) {
  const origin = req.headers.origin ?? "";
  res.setHeader("Access-Control-Allow-Origin", ALLOWED.includes(origin) ? origin : ALLOWED[0]);
  res.setHeader("Vary", "Origin");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  const q = new URL(req.url, "http://x").searchParams;
  const kind = q.has("reg") ? "reg" : "callsign";
  const value = String(q.get(kind) ?? "").toUpperCase();
  if (!/^[A-Z0-9-]{3,8}$/.test(value)) { res.statusCode = 400; return res.end(JSON.stringify({ found: false, error: "bad request" })); }
  const { body, trace } = await lookup(kind, value, fetchFn);
  res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=15");
  res.end(JSON.stringify(q.has("debug") ? { ...body, trace } : body));
}

module.exports = handler;
module.exports.run = run;
module.exports.lookup = lookup;
