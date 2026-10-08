// Vercel serverless function: current FAA airport delays, ground stops and ground delay programs.
//   GET /api/faa?airports=DFW,CVG -> { updated, delays: [{ airport, kind, text, trend, reason }] }
// Source: FAA National Airspace System Status (public XML, no key). It sends no CORS headers, so browsers
// can't read it directly; this function relays it. Answers are cached for 60 s.
const ALLOWED = ["https://kennedyjohnson.github.io", "http://localhost:8812", "http://localhost:8000", "http://127.0.0.1:8812"];
const FAA = "https://nasstatus.faa.gov/api/airport-status-information";

const tag = (s, t) => (s.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) ?? [])[1]?.trim() ?? null;

function reason(raw) {
  if (!raw) return null;
  const r = raw.toLowerCase();
  if (/thunder|\btstm|\bts\b/.test(r)) return "thunderstorms";
  if (/wind/.test(r)) return "wind";
  if (/snow|ice|winter/.test(r)) return "snow and ice";
  if (/fog|low (ceiling|visib)|lifr|ifr|\bcig\b/.test(r)) return "low clouds or visibility";
  if (/volume|vol:/.test(r)) return "high traffic volume";
  if (/rwy|runway/.test(r)) return "runway work";
  if (/eq:|equip/.test(r)) return "equipment problems";
  if (/wx|weather/.test(r)) return "weather";
  if (/initiatives|mit/.test(r)) return "traffic management";
  const tail = raw.split(":").pop().trim();
  return tail && tail.length < 40 ? tail.toLowerCase() : null;
}

// Parse the FAA XML into one plain item per airport program.
function parse(xml) {
  const out = [];
  const updated = tag(xml, "Update_Time");
  for (const sec of xml.matchAll(/<Delay_type>([\s\S]*?)<\/Delay_type>/g)) {
    const name = tag(sec[1], "Name") ?? "";
    if (/closure/i.test(name)) continue; // mostly general-aviation notices, not airline delays
    for (const blk of sec[1].matchAll(/<(Delay|Program|Ground_Delay|Ground_Stop|Airport)>([\s\S]*?)<\/\1>/g)) {
      const b = blk[2], airport = tag(b, "ARPT");
      if (!airport) continue;
      const why = reason(tag(b, "Reason"));
      if (/ground stop/i.test(name) || tag(b, "End_Time")) {
        const end = tag(b, "End_Time");
        out.push({ airport, kind: "ground stop", text: `ground stop (flights to ${airport} are being held at their departure airports)${end ? `, expected to end ${end}` : ""}`, trend: null, reason: why });
      } else if (/ground delay/i.test(name) || tag(b, "Avg")) {
        const avg = tag(b, "Avg"), max = tag(b, "Max");
        out.push({ airport, kind: "ground delay program", text: `flights to ${airport} are being held for about ${avg ?? "a while"}${max ? ` (up to ${max})` : ""}`, trend: null, reason: why });
      } else {
        for (const ad of b.matchAll(/<Arrival_Departure Type="(\w+)">([\s\S]*?)<\/Arrival_Departure>/g)) {
          const kind = ad[1].toLowerCase(), min = tag(ad[2], "Min"), max = tag(ad[2], "Max"), trend = (tag(ad[2], "Trend") ?? "").toLowerCase();
          out.push({
            airport, kind: `${kind} delay`, trend: trend || null, reason: why,
            text: `${kind}s are delayed ${min && max ? `${min.replace(" minutes", "")} to ${max}` : (min ?? max ?? "")}`.trim(),
          });
        }
      }
    }
  }
  return { updated, delays: out };
}

async function run(req, res, fetchFn = fetch) {
  const origin = req.headers.origin ?? "";
  res.setHeader("Access-Control-Allow-Origin", ALLOWED.includes(origin) ? origin : ALLOWED[0]);
  res.setHeader("Vary", "Origin");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  const q = new URL(req.url, "http://x").searchParams;
  const want = String(q.get("airports") ?? "").toUpperCase().split(",").filter(Boolean);
  if (!want.length || want.length > 4 || !want.every((a) => /^[A-Z]{3}$/.test(a))) { res.statusCode = 400; return res.end(JSON.stringify({ error: "bad request" })); }
  try {
    const r = await fetchFn(FAA, { signal: AbortSignal.timeout(7000) });
    if (!r.ok) throw new Error(`FAA ${r.status}`);
    const { updated, delays } = parse(await r.text());
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=60");
    res.end(JSON.stringify({ updated, delays: delays.filter((d) => want.includes(d.airport)) }));
  } catch {
    res.setHeader("Cache-Control", "public, s-maxage=30");
    res.end(JSON.stringify({ unavailable: true, delays: [] }));
  }
}

module.exports = (req, res) => run(req, res);
module.exports.run = run;
module.exports.parse = parse;
