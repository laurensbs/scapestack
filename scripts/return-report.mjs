#!/usr/bin/env node
// Which route brings players back?
//
// One question, one table, no dashboard. Reads the route:visit and
// route:engaged events from the Plausible Stats API and prints return rate and
// bounce rate per route.
//
// Usage:
//   PLAUSIBLE_API_KEY=... node scripts/return-report.mjs [--days 30]
//
// The key is a Plausible Stats API key (Settings -> API keys). It is read from
// the environment and never written anywhere.
//
// Reading the result:
//   visits      how many times the route was opened
//   returning   share of those that were a repeat visit within 7 days
//   engaged     share of visits where the player did something on the route
//
// `returning` is the number the retention argument turns on. A high `visits`
// with a low `engaged` is the worse shape: the promise reads well and the page
// does not deliver.

const API = "https://plausible.io/api/v2/query";
const SITE = process.env.PLAUSIBLE_DOMAIN ?? "scapestack.org";
const KEY = process.env.PLAUSIBLE_API_KEY;

const daysArg = process.argv.indexOf("--days");
const DAYS = daysArg > -1 ? Number(process.argv[daysArg + 1]) || 30 : 30;

if (!KEY) {
  console.error("PLAUSIBLE_API_KEY is not set.");
  console.error("");
  console.error("  PLAUSIBLE_API_KEY=xxx node scripts/return-report.mjs --days 30");
  console.error("");
  console.error("Get one under Plausible -> Settings -> API keys.");
  process.exit(1);
}

async function query(eventName, dimensions) {
  const response = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      site_id: SITE,
      metrics: ["events"],
      date_range: `${DAYS}d`,
      filters: [["is", "event:name", [eventName]]],
      dimensions
    })
  });
  if (!response.ok) {
    throw new Error(`Plausible ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const body = await response.json();
  return body.results ?? [];
}

function tally(rows, dimensionCount) {
  // rows look like { dimensions: [...], metrics: [events] }
  const out = new Map();
  for (const row of rows) {
    const key = row.dimensions.slice(0, dimensionCount).join("|");
    out.set(key, (out.get(key) ?? 0) + (row.metrics?.[0] ?? 0));
  }
  return out;
}

function pct(part, whole) {
  if (!whole) return "  —  ";
  return `${((part / whole) * 100).toFixed(1).padStart(5)}%`;
}

const visits = tally(
  await query("route:visit", ["event:props:route", "event:props:visitor"]),
  2
);
const engaged = tally(await query("route:engaged", ["event:props:route"]), 1);

const routes = new Set();
for (const key of visits.keys()) routes.add(key.split("|")[0]);
for (const key of engaged.keys()) routes.add(key);

const table = [...routes]
  .map((route) => {
    const first = visits.get(`${route}|first`) ?? 0;
    const back7 = visits.get(`${route}|returning_7d`) ?? 0;
    const later = visits.get(`${route}|returning_later`) ?? 0;
    const total = first + back7 + later;
    return { route, total, back7, engaged: engaged.get(route) ?? 0 };
  })
  .filter((row) => row.total > 0)
  .sort((a, b) => b.total - a.total);

console.log(`\nReturn behaviour, last ${DAYS} days — ${SITE}\n`);
console.log("  route      visits   returning≤7d   engaged");
console.log("  ─────────────────────────────────────────────");
for (const row of table) {
  console.log(
    `  ${row.route.padEnd(9)} ${String(row.total).padStart(6)}` +
    `        ${pct(row.back7, row.total)}    ${pct(row.engaged, row.total)}`
  );
}
if (table.length === 0) {
  console.log("  (no route:visit events yet — give it a few days)");
}
console.log("");
console.log("  returning≤7d = the retention signal. Compare routes, not absolutes.");
console.log("  engaged      = visits where the player did something on the route.");
console.log("");
