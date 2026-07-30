// Pull the game's facts from the OSRS Wiki instead of typing them.
//
// Usage:
//   node scripts/wiki-sync.mjs            write data/wiki/*.json
//   node scripts/wiki-sync.mjs --check    compare the committed files against
//                                         the live wiki and exit 1 on drift
//
// Why this exists
// ---------------
// Every boss stat, item bonus and quest length in this repo used to be a line
// somebody typed. An audit found Araxxor at 460 HP against a real 1020, the
// Hueycoatl at 700 against 2500, Skotizo marked undead when it is not, and a
// Twisted bow formula fed by a Zulrah magic level that was 50 too low. None of
// those are hard facts to look up — they are hard facts to keep looking up.
//
// The wiki publishes all of it as queryable structured data through Bucket
// (Weird Gloop's extension; Cargo and SMW are both disabled on this wiki).
// No API key, no auth. So: the wiki owns what the GAME contains, the plugin
// and the Hiscores own what an ACCOUNT has, and Scapestack owns only the
// judgement that joins them.
//
// Build-time, not request-time
// ----------------------------
// The output is committed JSON. A page render must not depend on the wiki
// being up, and 3,234 monsters is not something to fetch per request. `--check`
// is what keeps the snapshot honest: it re-queries live and fails on drift, so
// a stale file is a red build rather than a wrong kill time.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "data", "wiki");
const API = "https://oldschool.runescape.wiki/api.php";

// The wiki asks tools to identify themselves and to be gentle. Same string the
// prices client already sends from src/lib/wiki.ts.
const USER_AGENT = "scapestack/0.6 wiki-sync (+https://www.scapestack.org)";
const PAGE_SIZE = 500;
const DELAY_MS = 250;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One Bucket query, paged to exhaustion.
 *
 * Bucket's DSL is a string: bucket('x').select('a','b').limit(n).offset(n).run()
 * There is no cursor, so paging is offset-based and we stop on a short page.
 */
async function fetchBucket(bucket, fields) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const query = `bucket('${bucket}')`
      + `.select(${fields.map((field) => `'${field}'`).join(",")})`
      + `.limit(${PAGE_SIZE}).offset(${offset}).run()`;
    const url = `${API}?action=bucket&format=json&query=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) throw new Error(`${bucket} HTTP ${response.status} at offset ${offset}`);
    const body = await response.json();
    if (body.error) throw new Error(`${bucket}: ${body.error.info ?? JSON.stringify(body.error)}`);
    const page = body.bucket ?? [];
    rows.push(...page);
    process.stdout.write(`\r  ${bucket}: ${rows.length} rows`);
    if (page.length < PAGE_SIZE) break;
    await sleep(DELAY_MS);
  }
  process.stdout.write("\n");
  return rows;
}

/**
 * What we pull, and why each field is here.
 *
 * Nothing is pulled "because it might be useful" — every field below is read
 * by something, or is the join key that lets it be read.
 */
const SOURCES = [
  {
    file: "monsters.json",
    bucket: "infobox_monster",
    // page_name is the join key to our roster. version_anchor and
    // default_version exist because a lot of monsters have several rows:
    // Vorkath is 460 HP during the quest and 750 after, Araxxor has two
    // defence levels. Dropping that distinction is how a hand-typed table
    // ends up with the wrong one.
    fields: [
      "page_name", "version_anchor", "default_version",
      "hitpoints", "combat_level", "size",
      "attack_level", "strength_level", "defence_level", "ranged_level", "magic_level",
      "stab_defence_bonus", "slash_defence_bonus", "crush_defence_bonus",
      "magic_defence_bonus", "range_defence_bonus", "flat_armour",
      // attribute carries "undead" and "demon" — the Salve and Slayer-helm
      // checks the engine currently guesses at, and got wrong for Skotizo.
      "attribute",
      // The Scythe's multiplier depends on target size; we applied it flat.
      "elemental_weakness", "elemental_weakness_percent",
      "slayer_level", "slayer_category", "attack_speed", "max_hit"
    ],
    key: (row) => `${row.page_name} ${row.version_anchor ?? ""}`
  },
  {
    file: "equipment.json",
    bucket: "infobox_bonuses",
    // 5,698 rows against the 116 items gear.ts holds by hand.
    // No version_anchor here: infobox_bonuses does not carry one, so a page
    // with several equipment versions collapses to several rows under one
    // name. The loader has to handle that rather than assume uniqueness.
    fields: [
      "page_name",
      "stab_attack_bonus", "slash_attack_bonus", "crush_attack_bonus",
      "magic_attack_bonus", "range_attack_bonus",
      "stab_defence_bonus", "slash_defence_bonus", "crush_defence_bonus",
      "magic_defence_bonus", "range_defence_bonus",
      "strength_bonus", "ranged_strength_bonus", "magic_damage_bonus", "prayer_bonus",
      "equipment_slot", "weapon_attack_speed", "weapon_attack_range", "combat_style"
    ],
    // Without a version anchor the only stable identity is the name plus the
    // stats themselves. Good enough for a sort order and for drift detection.
    key: (row) => `${row.page_name} ${row.equipment_slot ?? ""} ${row.strength_bonus ?? ""}`
  },
  {
    file: "items.json",
    bucket: "infobox_item",
    // The bridge: infobox_bonuses has no item id, only a page name. This is
    // what turns a bank row (id) into a set of bonuses.
    fields: ["page_name", "item_name", "item_id", "version_anchor", "default_version", "tradeable"],
    key: (row) => `${row.page_name} ${row.version_anchor ?? ""}`
  },
  {
    file: "quests.json",
    bucket: "quest",
    // official_length is the field this product has been guessing at since it
    // started claiming a quest fits in 60 minutes. start_point is the "START"
    // line, written by the wiki rather than by us. ironman_concerns is the
    // one thing every Ironman tool is missing.
    fields: [
      "page_name", "official_length", "official_difficulty",
      "start_point", "requirements", "items_required", "enemies_to_defeat",
      "ironman_concerns", "description"
    ],
    key: (row) => row.page_name
  },
  {
    file: "money-making-guide.json",
    bucket: "money_making_guide",
    // Bucket:Money making guide declares value/recurring/json. page_name is
    // the Bucket origin key exposed by the API and is what lets the derived
    // projection retain a stable Wiki URL for every method.
    fields: ["page_name", "value", "recurring", "json"],
    key: (row) => row.page_name
  },
  {
    file: "recommended-equipment.json",
    bucket: "recommended_equipment",
    // Bucket:Recommended equipment declares only json. As above, page_name
    // is the API's origin key; one page can publish several named loadouts.
    fields: ["page_name", "json"],
    // Duplicate page/style pairs exist on the live wiki. The full declared
    // payload is therefore the only non-invented stable discriminator.
    key: (row) => `${row.page_name} ${row.json}`
  }
];

function stableSort(rows, key) {
  return [...rows].sort((left, right) => String(key(left)).localeCompare(String(key(right))));
}

async function pull(source) {
  const rows = await fetchBucket(source.bucket, source.fields);
  return {
    // Recorded so a reader knows exactly what produced this file and can
    // re-run the identical query. No timestamp: it would churn the diff on
    // every sync and tell us nothing --check does not tell us better.
    _source: {
      wiki: "oldschool.runescape.wiki",
      bucket: source.bucket,
      fields: source.fields,
      rows: rows.length
    },
    rows: stableSort(rows, source.key)
  };
}

function outPath(file) {
  return join(OUT_DIR, file);
}

async function write() {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const source of SOURCES) {
    const data = await pull(source);
    writeFileSync(outPath(source.file), `${JSON.stringify(data, null, 1)}\n`);
    console.log(`  wrote data/wiki/${source.file} (${data.rows.length} rows)`);
  }
}

/**
 * Drift check.
 *
 * The point is to produce a NEGATIVE. A check that only confirms the file
 * parses would pass forever while Araxxor sat at 460 HP, which is exactly the
 * failure this whole exercise is correcting.
 */
async function check() {
  let drifted = 0;
  for (const source of SOURCES) {
    const path = outPath(source.file);
    if (!existsSync(path)) {
      console.error(`  MISSING data/wiki/${source.file} — run: npm run wiki:sync`);
      drifted += 1;
      continue;
    }
    const committed = JSON.parse(readFileSync(path, "utf8"));
    const live = await pull(source);
    const before = new Map(committed.rows.map((row) => [source.key(row), JSON.stringify(row)]));
    const after = new Map(live.rows.map((row) => [source.key(row), JSON.stringify(row)]));

    const added = [...after.keys()].filter((key) => !before.has(key));
    const removed = [...before.keys()].filter((key) => !after.has(key));
    const changed = [...after.keys()].filter((key) => before.has(key) && before.get(key) !== after.get(key));

    if (added.length || removed.length || changed.length) {
      drifted += 1;
      console.error(`  DRIFT data/wiki/${source.file}: +${added.length} -${removed.length} ~${changed.length}`);
      for (const key of changed.slice(0, 5)) {
        console.error(`    changed: ${key.split(" ")[0]}`);
        console.error(`      was:  ${before.get(key)}`);
        console.error(`      now:  ${after.get(key)}`);
      }
    } else {
      console.log(`  ok data/wiki/${source.file} (${live.rows.length} rows)`);
    }
  }
  if (drifted > 0) {
    console.error(`\n${drifted} file(s) out of date. Run: npm run wiki:sync`);
    process.exit(1);
  }
  console.log("\nSnapshot matches the wiki.");
}

const mode = process.argv.includes("--check") ? "check" : "write";
console.log(`wiki-sync (${mode})`);
await (mode === "check" ? check() : write());
