// Builds data/item-meta.json — a per-item metadata layer derived from the
// OSRS Wiki, so the classifier can decide on *facts* (equipment slot, combat
// style, associated skill, value) instead of guessing from the name string.
//
// Sources:
//   1. OSRS Wiki MediaWiki API — category membership (list=categorymembers).
//      Each target category maps to one tag (slot:body, style:ranged, …).
//   2. prices.runescape.wiki mapping API — value / highalch / members /
//      examine / tradeable for the ~4.5k tradeable items.
//
// Output shape (data/item-meta.json):
//   { "<id>": { slot, style, skills:[…], tags:[…], value, highalch,
//               members, tradeable, examine } }
//
// Run: node scripts/build-item-data.mjs
// Re-run whenever the Wiki gains new items / categories.

import { writeFile, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "scapestack-bank-organizer/1.0 (item-data build script)";
const WIKI = "https://oldschool.runescape.wiki/api.php";
const PRICES = "https://prices.runescape.wiki/api/v1/osrs/mapping";

// ── Category → tag map ──────────────────────────────────────────────────────
// Every page in `Category:<key>` receives the listed tags. Tag namespaces:
//   slot:*   — equipment slot          style:*  — combat style
//   skill:*  — associated skill        kind:*   — coarse item kind
// A page can match several categories and accumulates all their tags.
const CATEGORY_TAGS = {
  // Equipment slots
  "Head slot items":        ["slot:head"],
  "Cape slot items":        ["slot:cape"],
  "Neck slot items":        ["slot:neck"],
  "Ammunition slot items":  ["slot:ammo"],
  "Weapon slot items":      ["slot:weapon"],
  "Two-handed slot items":  ["slot:weapon", "kind:twohand"],
  "Body slot items":        ["slot:body"],
  "Shield slot items":      ["slot:shield"],
  "Legs slot items":        ["slot:legs"],
  "Hands slot items":       ["slot:hands"],
  "Feet slot items":        ["slot:feet"],
  "Ring slot items":        ["slot:ring"],
  // Combat style of armour / weapons
  "Melee armour":   ["style:melee", "kind:armour"],
  "Ranged armour":  ["style:ranged", "kind:armour"],
  "Magic armour":   ["style:magic", "kind:armour"],
  "Melee weapons":  ["style:melee", "kind:weapon"],
  "Ranged weapons": ["style:ranged", "kind:weapon"],
  // Consumables
  "Potions": ["kind:potion"],
  "Food":    ["kind:food"],
  // Skills
  "Herblore":     ["skill:herblore"],
  "Farming":      ["skill:farming"],
  "Fishing":      ["skill:fishing"],
  "Cooking":      ["skill:cooking"],
  "Woodcutting":  ["skill:woodcutting"],
  "Mining":       ["skill:mining"],
  "Smithing":     ["skill:smithing"],
  "Crafting":     ["skill:crafting"],
  "Fletching":    ["skill:fletching"],
  "Runecraft":    ["skill:runecraft"],
  "Construction": ["skill:construction"],
  "Hunter":       ["skill:hunter"],
  "Prayer":       ["skill:prayer"],
  "Magic":        ["skill:magic"],
  // Coarse kinds / specials
  "Pets":                   ["kind:pet"],
  "Tools":                  ["kind:tool"],
  "Runes":                  ["kind:rune"],
  "Logs":                   ["kind:log"],
  "Ores":                   ["kind:ore"],
  "Metal bars":             ["kind:bar"],
  "Gems":                   ["kind:gem"],
  "Seeds":                  ["kind:seed"],
  "Treasure Trails rewards":["kind:clue"],
  "Easy clue rewards":      ["kind:clue", "clue:easy"],
  "Medium clue rewards":    ["kind:clue", "clue:medium"],
  "Hard clue rewards":      ["kind:clue", "clue:hard"],
  "Elite clue rewards":     ["kind:clue", "clue:elite"],
  "Master clue rewards":    ["kind:clue", "clue:master"]
};

// Categories above are tagged by NAME match. That's safe for narrow,
// well-defined categories but NOT for the huge generic ones — "Quest items"
// (~2k pages) and "Untradeable items" (~8k pages) contain pages whose
// titles collide with ordinary item names, smearing a wrong tag across
// every id that shares the name. We derive "tradeable"/"untradeable" from
// the prices mapping instead (a hard fact: in the mapping ⇒ GE-tradeable),
// so those two categories are deliberately omitted here.

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

// Fetch every page title in one category, following cmcontinue pagination.
async function fetchCategory(category) {
  const titles = [];
  let cmcontinue = null;
  do {
    const params = new URLSearchParams({
      action: "query",
      list: "categorymembers",
      cmtitle: `Category:${category}`,
      cmlimit: "500",
      cmtype: "page",
      format: "json"
    });
    if (cmcontinue) params.set("cmcontinue", cmcontinue);
    const data = await getJSON(`${WIKI}?${params}`);
    for (const m of data?.query?.categorymembers ?? []) titles.push(m.title);
    cmcontinue = data?.continue?.cmcontinue ?? null;
    await sleep(120); // be polite to the Wiki
  } while (cmcontinue);
  return titles;
}

// Normalise a name for cross-source matching: lowercase, strip charge/dose
// suffixes like "(4)", "(uncharged)" so "Super combat potion(4)" lines up.
function norm(name) {
  return String(name)
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  console.log("→ Loading data/items.json …");
  const itemsRaw = JSON.parse(await readFile(join(ROOT, "data", "items.json"), "utf8"));
  // name(normalised) → [ids]   (a name can map to several ids: variants)
  const nameToIds = new Map();
  for (const [k, v] of Object.entries(itemsRaw)) {
    const id = Number(k);
    if (!Number.isFinite(id)) continue;
    const name = typeof v === "string" ? v : v?.name;
    if (!name) continue;
    const n = norm(name);
    if (!nameToIds.has(n)) nameToIds.set(n, []);
    nameToIds.get(n).push(id);
  }
  console.log(`  ${nameToIds.size} unique item names across ${Object.keys(itemsRaw).length} ids`);

  // meta keyed by id
  const meta = new Map();
  const ensure = (id) => {
    if (!meta.has(id)) meta.set(id, { tags: new Set() });
    return meta.get(id);
  };

  // ── 1. Wiki category membership ───────────────────────────────────────────
  const cats = Object.keys(CATEGORY_TAGS);
  let unmatched = 0;
  for (let i = 0; i < cats.length; i++) {
    const cat = cats[i];
    process.stdout.write(`→ [${i + 1}/${cats.length}] Category:${cat} … `);
    const titles = await fetchCategory(cat);
    let hits = 0;
    for (const title of titles) {
      const ids = nameToIds.get(norm(title));
      if (!ids) { unmatched++; continue; }
      for (const id of ids) {
        const m = ensure(id);
        for (const tag of CATEGORY_TAGS[cat]) m.tags.add(tag);
      }
      hits++;
    }
    console.log(`${titles.length} pages, ${hits} matched`);
  }
  console.log(`  (${unmatched} category pages had no matching item id — expected: NPCs, scenery, etc.)`);

  // ── 2. prices.runescape.wiki mapping (value / alch / members / examine) ───
  console.log("→ Fetching prices mapping …");
  const mapping = await getJSON(PRICES);
  let priced = 0;
  for (const row of mapping ?? []) {
    if (typeof row?.id !== "number") continue;
    const m = ensure(row.id);
    if (typeof row.value === "number") m.value = row.value;
    if (typeof row.highalch === "number") m.highalch = row.highalch;
    if (typeof row.members === "boolean") m.members = row.members;
    if (typeof row.examine === "string") m.examine = row.examine;
    m.tradeable = true; // present in the mapping ⇒ GE-tradeable
    priced++;
  }
  console.log(`  ${priced} items enriched with price/alch data`);

  // ── 3. Serialise ──────────────────────────────────────────────────────────
  // An item can sit in several combat-style categories at once: Armadyl gear
  // is in BOTH "Ranged armour" and "Melee armour" (ranged armour with a melee
  // defence bonus). Pure melee armour is never also in Ranged/Magic, so when
  // styles conflict the ranged/magic membership is the *defining* one — that's
  // the attack style the item is actually built for. We keep the full list in
  // `styles` and expose the determining pick as `style`.
  const STYLE_PRIORITY = ["magic", "ranged", "melee"]; // most-defining first
  const pickStyle = (styles) => {
    for (const s of STYLE_PRIORITY) if (styles.includes(s)) return s;
    return null;
  };
  const out = {};
  for (const [id, m] of meta) {
    const tags = [...m.tags].sort();
    const slot = tags.find((t) => t.startsWith("slot:"))?.slice(5) ?? null;
    const styles = tags.filter((t) => t.startsWith("style:")).map((t) => t.slice(6));
    const skills = tags.filter((t) => t.startsWith("skill:")).map((t) => t.slice(6));
    const kinds = tags.filter((t) => t.startsWith("kind:")).map((t) => t.slice(5));
    const clue = tags.find((t) => t.startsWith("clue:"))?.slice(5) ?? null;
    out[id] = {
      slot,
      style: pickStyle(styles),
      styles,
      skills,
      kinds,
      clue,
      value: m.value ?? null,
      highalch: m.highalch ?? null,
      members: m.members ?? null,
      tradeable: m.tradeable ?? false,
      examine: m.examine ?? null
    };
  }
  const path = join(ROOT, "data", "item-meta.json");
  await writeFile(path, JSON.stringify(out), "utf8");
  console.log(`✓ Wrote ${Object.keys(out).length} item metadata records → data/item-meta.json`);
}

main().catch((err) => {
  console.error("✗ build-item-data failed:", err);
  process.exit(1);
});
