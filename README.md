# flight-position

Tiny Vercel serverless function that returns a live aircraft position (by callsign or tail number) for [Will My Flight Be Delayed?](https://kennedyjohnson.github.io/will-my-flight-be-delayed/). Browsers cannot read ADS-B feeds directly (no CORS) and the feeds refuse Cloudflare Workers, so this runs on Vercel.

- `GET /api/position?callsign=DAL660` the aircraft flying that callsign now
- `GET /api/position?reg=N389DN` that tail number, wherever it is

Data: community ADS-B feeds ([adsb.lol](https://adsb.lol), [adsb.fi](https://adsb.fi)), no API key. Free on the Vercel Hobby plan.

## Tools used

- JavaScript (Node serverless function)
- Vercel
- adsb.lol and adsb.fi ADS-B feeds
