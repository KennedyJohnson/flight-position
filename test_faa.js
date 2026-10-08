const { parse, run } = require("./api/faa.js");
const fs = require("fs");
const live = fs.readFileSync("faa_sample.xml", "utf8");
console.log("LIVE:", JSON.stringify(parse(live)));
// synthetic blocks in the FAA's ground delay / ground stop layouts (not present in the feed right now)
const synth = `<AIRPORT_STATUS_INFORMATION><Update_Time>t</Update_Time>
<Delay_type><Name>Ground Delay Programs</Name><Ground_Delay_List><Ground_Delay><ARPT>EWR</ARPT><Reason>thunderstorms</Reason><Avg>73 minutes</Avg><Max>2 hours and 10 minutes</Max></Ground_Delay></Ground_Delay_List></Delay_type>
<Delay_type><Name>Ground Stops</Name><Ground_Stop_List><Program><ARPT>DFW</ARPT><Reason>WX:Thunderstorms</Reason><End_Time>8:45 pm EDT</End_Time></Program></Ground_Stop_List></Delay_type>
<Delay_type><Name>General Arrival/Departure Delay Info</Name><Arrival_Departure_Delay_List><Delay><ARPT>CVG</ARPT><Reason>RWY:CONSTRUCTION</Reason><Arrival_Departure Type="Arrival"><Min>1 hour</Min><Max>1 hour and 30 minutes</Max><Trend>Increasing</Trend></Arrival_Departure></Delay></Arrival_Departure_Delay_List></Delay_type></AIRPORT_STATUS_INFORMATION>`;
console.log("SYNTH:", JSON.stringify(parse(synth).delays));
const call = (qs, f) => new Promise((resolve) => { const res = { statusCode: 200, setHeader() {}, end: (b) => resolve([res.statusCode, b]) }; run({ method: "GET", url: "/api/faa?" + qs, headers: {} }, res, f); });
(async () => {
  console.log("filter ORD:", (await call("airports=ORD,DFW")).join(" "));
  console.log("bad:", (await call("airports=ORD;x")).join(" "));
  console.log("faa down:", (await call("airports=ORD", async () => { throw new Error("x"); })).join(" "));
})();
