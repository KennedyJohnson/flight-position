const { run } = require("./api/position.js");
const call = (qs) => new Promise((resolve) => {
  const h = {}; const res = { statusCode: 200, setHeader: (k, v) => (h[k] = v), end: (b) => resolve({ s: res.statusCode, h, b }) };
  run({ method: "GET", url: "/api/position?" + qs, headers: { origin: "https://kennedyjohnson.github.io" } }, res);
});
(async () => {
  const UA = { headers: { "User-Agent": "flight-live/1.0 (+https://kennedyjohnson.github.io/will-my-flight-be-delayed/)" } };
  const all = await (await fetch("https://opendata.adsb.fi/api/v3/lat/39/lon/-95/dist/250", UA)).json().catch(() => ({}));
  const a = (all.ac ?? []).find((x) => /^(AAL|DAL|UAL|SWA)\d+/.test((x.flight ?? "").trim()) && x.r && typeof x.lat === "number");
  if (a) {
    console.log("callsign", (a.flight).trim(), JSON.stringify((await call("callsign=" + a.flight.trim())).b));
    console.log("reg     ", a.r, JSON.stringify((await call("reg=" + a.r)).b));
  } else console.log("no sample aircraft found; feed said", Object.keys(all));
  console.log("none", JSON.stringify((await call("callsign=ZZZ9999")).b));
  console.log("bad ", JSON.stringify(await call("callsign=a;b")));
})();
