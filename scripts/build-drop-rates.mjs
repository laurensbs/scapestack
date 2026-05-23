// Builds data/drop-rates.json — per-boss rare drop rates pulled from the
// OSRS Wiki. The /next hub uses it to convert a player's Hiscores boss-KC
// into an expected-uniques readout ("142 Vorkath KC ≈ 0.85 visages
// expected").
//
// We don't pull every drop — only the **rare** entries that a player
// actually grinds for (denominator >= 100). Common drops are noise here.
//
// Output shape (data/drop-rates.json):
//   { "<wiki page name>": {
//       hiscoresName: "Vorkath",        // matches Hiscores activity name
//       drops: [
//         { name: "Draconic visage", num: 1, denom: 5000, rarity: "1/5000" },
//         { name: "Vorki",           num: 1, denom: 3000, rarity: "1/3000" },
//         …
//       ]
//     }, …
//   }
//
// Run: node scripts/build-drop-rates.mjs

import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "scapestack-bank-organizer/1.0 (drop-rates build script)";
const WIKI = "https://oldschool.runescape.wiki/api.php";

// The bosses worth parsing. Each entry maps the Wiki page name (used for
// the API fetch) to the OSRS Hiscores activity name (used to look up KC).
// Names diverge in a few places (Wiki "K'ril Tsutsaroth" vs Hiscores
// "K'ril Tsutsaroth" — that's actually the same, but TOA uses "Tombs of
// Amascut" on Hiscores while inner-room bosses don't appear).
const BOSSES = [
  // Solo iconic
  { wiki: "Vorkath",            hiscores: "Vorkath" },
  { wiki: "Zulrah",             hiscores: "Zulrah" },
  { wiki: "Alchemical Hydra",   hiscores: "Alchemical Hydra" },
  { wiki: "Cerberus",           hiscores: "Cerberus" },
  { wiki: "Kraken",             hiscores: "Kraken" },
  { wiki: "Abyssal Sire",       hiscores: "Abyssal Sire" },
  { wiki: "Thermonuclear smoke devil", hiscores: "Thermonuclear Smoke Devil" },
  { wiki: "Skotizo",            hiscores: "Skotizo" },
  { wiki: "Giant Mole",         hiscores: "Giant Mole" },
  { wiki: "King Black Dragon",  hiscores: "King Black Dragon" },
  { wiki: "Sarachnis",          hiscores: "Sarachnis" },
  { wiki: "Phantom Muspah",     hiscores: "Phantom Muspah" },
  { wiki: "Araxxor",            hiscores: "Araxxor" },
  { wiki: "Hueycoatl",          hiscores: "The Hueycoatl" },
  { wiki: "Amoxliatl",          hiscores: "Amoxliatl" },
  // God Wars
  { wiki: "General Graardor",   hiscores: "General Graardor" },
  { wiki: "K'ril Tsutsaroth",   hiscores: "K'ril Tsutsaroth" },
  { wiki: "Commander Zilyana",  hiscores: "Commander Zilyana" },
  { wiki: "Kree'arra",          hiscores: "Kree'Arra" },
  { wiki: "Nex",                hiscores: "Nex" },
  // Wildy
  { wiki: "Vet'ion",            hiscores: "Vet'ion" },
  { wiki: "Callisto",           hiscores: "Callisto" },
  { wiki: "Venenatis",          hiscores: "Venenatis" },
  // DT2
  { wiki: "Duke Sucellus",      hiscores: "Duke Sucellus" },
  { wiki: "Vardorvis",          hiscores: "Vardorvis" },
  { wiki: "The Leviathan",      hiscores: "The Leviathan" },
  { wiki: "The Whisperer",      hiscores: "The Whisperer" },
  // Slayer
  { wiki: "Grotesque Guardians", hiscores: "Grotesque Guardians" },
  // Misc iconic
  { wiki: "Dagannoth Rex",      hiscores: "Dagannoth Rex" },
  { wiki: "Dagannoth Prime",    hiscores: "Dagannoth Prime" },
  { wiki: "Dagannoth Supreme",  hiscores: "Dagannoth Supreme" }
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(1000 * (attempt + 1));
    }
  }
}

// Pull every {{DropsLine|name=X|rarity=N/D|...}} from a page. Returns the
// rare ones only (denominator >= 100) — common drops add noise and aren't
// what players grind for.
function parseRareDrops(wikitext) {
  const re = /\{\{DropsLine\|([^}]+)\}\}/g;
  const seen = new Map(); // dedupe by name, keep the rarest entry
  let m;
  while ((m = re.exec(wikitext)) !== null) {
    const body = m[1];
    const name = (body.match(/name=([^|]+?)(?=\||$)/) || [])[1]?.trim();
    const rarity = (body.match(/rarity=([^|]+?)(?=\||$)/) || [])[1]?.trim();
    if (!name || !rarity) continue;
    const r = rarity.match(/(\d+)\/(\d+)/);
    if (!r) continue;
    const num = parseInt(r[1], 10);
    const denom = parseInt(r[2], 10);
    if (!Number.isFinite(num) || !Number.isFinite(denom) || denom < 100) continue;
    const prev = seen.get(name);
    // Keep the rarest (lowest probability) version when same name appears
    // multiple times (post-quest variants, etc.).
    const prob = num / denom;
    if (!prev || prob < prev.num / prev.denom) {
      seen.set(name, { name, num, denom, rarity });
    }
  }
  return [...seen.values()].sort((a, b) => (a.num / a.denom) - (b.num / b.denom));
}

async function main() {
  const out = {};
  let parsed = 0;
  for (const boss of BOSSES) {
    try {
      const data = await getJSON(`${WIKI}?action=parse&page=${encodeURIComponent(boss.wiki)}&prop=wikitext&format=json`);
      const w = data?.parse?.wikitext?.["*"];
      if (!w) { console.warn(`  ! ${boss.wiki}: no wikitext`); continue; }
      const drops = parseRareDrops(w);
      out[boss.wiki] = { hiscoresName: boss.hiscores, drops };
      parsed++;
      console.log(`  ${boss.wiki}: ${drops.length} rare drops (rarest: ${drops[0]?.name ?? "—"} ${drops[0]?.rarity ?? ""})`);
    } catch (e) {
      console.warn(`  ! ${boss.wiki}: ${e.message}`);
    }
    await sleep(150);
  }
  const path = join(ROOT, "data", "drop-rates.json");
  await writeFile(path, JSON.stringify(out, null, 2), "utf8");
  console.log(`✓ Wrote ${parsed}/${BOSSES.length} boss drop tables → data/drop-rates.json`);
}

main().catch((err) => { console.error("✗", err); process.exit(1); });
