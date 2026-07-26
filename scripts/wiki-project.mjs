// Project the wiki snapshot onto the things Scapestack actually reasons about.
//
// Usage: node scripts/wiki-project.mjs   (run by `npm run wiki:sync`)
//
// data/wiki/*.json is 7MB of everything the wiki knows. The app needs 59 boss
// rows and the bonuses for whatever is in a player's bank, so this emits two
// small generated files instead of shipping the whole snapshot to a serverless
// function or a browser.
//
// The split that matters:
//
//   FACTS are the wiki's.        hp, defence, magic level, size, attributes,
//                                item bonuses, attack speed
//   JUDGEMENT is ours.           which encounters a single DPS number can
//                                honestly answer, what a player should be told,
//                                which style to recommend, what fits an hour
//
// So the roster in src/lib/bosses.ts keeps only judgement plus a wiki page
// name, and the numbers arrive from here. Nobody types a boss's HP again.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WIKI_DIR = join(ROOT, "data", "wiki");
const OUT_DIR = join(ROOT, "data", "wiki", "derived");

const load = (file) => JSON.parse(readFileSync(join(WIKI_DIR, file), "utf8")).rows;

const monsters = load("monsters.json");
const equipment = load("equipment.json");
const items = load("items.json");

const int = (value) => (typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null);
const lower = (value) => String(value ?? "").toLowerCase();

/**
 * Several monsters have more than one row. Vorkath is 460 HP during Dragon
 * Slayer II and 750 after; Vardorvis has Quest, Post-quest and Awakened.
 *
 * The first version of this function said "take the most hitpoints", which
 * reads like a sensible rule and picked **Awakened Vardorvis** — 1400 HP,
 * combat 1136, an optional superhard mode almost nobody fights. Inventing a
 * heuristic is the exact habit this whole exercise exists to stop.
 *
 * The wiki already answers it. `default_version` marks the row a reader lands
 * on, and Bucket renders that boolean as an empty string when set and omits it
 * otherwise. So: keep only the wiki's own default rows, then take the largest
 * HP among them — that last step is for encounters like the Hueycoatl, whose
 * default rows cover a 300 HP phase and the 2500 HP body.
 *
 * A roster entry can still name a version anchor explicitly.
 */
function isDefaultRow(row) {
  return row.default_version !== undefined && row.default_version !== null;
}

function pickVersion(rows, anchor) {
  if (anchor) {
    const exact = rows.find((row) => lower(row.version_anchor) === lower(anchor));
    if (exact) return exact;
  }
  const defaults = rows.filter(isDefaultRow);
  const pool = defaults.length > 0 ? defaults : rows;
  return [...pool].sort((left, right) => (int(right.hitpoints) ?? 0) - (int(left.hitpoints) ?? 0))[0];
}

const monstersByName = new Map();
for (const row of monsters) {
  const key = lower(row.page_name);
  const list = monstersByName.get(key) ?? [];
  list.push(row);
  monstersByName.set(key, list);
}

/** Every attribute the DPS engine cares about, from the wiki rather than a regex. */
function attributesOf(row) {
  const raw = Array.isArray(row.attribute) ? row.attribute : [row.attribute];
  return raw.filter(Boolean).map((value) => lower(value)).sort();
}

export function projectMonster(pageName, anchor) {
  const rows = monstersByName.get(lower(pageName));
  if (!rows?.length) return null;
  const row = pickVersion(rows, anchor);
  return {
    page: row.page_name,
    version: row.version_anchor || null,
    versions: rows.length,
    hp: int(row.hitpoints),
    combatLevel: int(row.combat_level),
    size: int(row.size),
    attack: int(row.attack_level),
    strength: int(row.strength_level),
    defenceLevel: int(row.defence_level),
    ranged: int(row.ranged_level),
    magicLevel: int(row.magic_level),
    defenceBonuses: {
      stab: int(row.stab_defence_bonus) ?? 0,
      slash: int(row.slash_defence_bonus) ?? 0,
      crush: int(row.crush_defence_bonus) ?? 0,
      magic: int(row.magic_defence_bonus) ?? 0,
      ranged: int(row.range_defence_bonus) ?? 0
    },
    flatArmour: int(row.flat_armour),
    attributes: attributesOf(row),
    slayerLevel: int(row.slayer_level),
    attackSpeed: int(row.attack_speed),
    elementalWeakness: row.elemental_weakness || null,
    elementalWeaknessPercent: int(row.elemental_weakness_percent)
  };
}

/**
 * Bonuses are keyed by page name; item ids live in a different bucket. A bank
 * row is an id, so this walks id -> page -> bonuses and stores the id.
 */
const idsByPage = new Map();
for (const row of items) {
  const ids = (Array.isArray(row.item_id) ? row.item_id : [row.item_id])
    .map((value) => Number.parseInt(String(value), 10))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!ids.length) continue;
  const key = lower(row.page_name);
  const list = idsByPage.get(key) ?? [];
  list.push(...ids);
  idsByPage.set(key, list);
}

export function projectEquipment(pageName) {
  const rows = equipment.filter((row) => lower(row.page_name) === lower(pageName));
  if (!rows.length) return null;
  // Charged/uncharged and (i)/(non-i) variants collapse onto one page name
  // because infobox_bonuses carries no version anchor. Take the strongest
  // offensive row: a player who owns the item owns its best form often enough
  // that understating it is the worse error, and /dps says which setup it used.
  const score = (row) => (int(row.strength_bonus) ?? 0)
    + (int(row.ranged_strength_bonus) ?? 0)
    + (int(row.magic_damage_bonus) ?? 0);
  const row = [...rows].sort((left, right) => score(right) - score(left))[0];
  return {
    page: row.page_name,
    variants: rows.length,
    itemIds: idsByPage.get(lower(pageName)) ?? [],
    slot: row.equipment_slot || null,
    speed: int(row.weapon_attack_speed),
    combatStyle: row.combat_style || null,
    attack: {
      stab: int(row.stab_attack_bonus) ?? 0,
      slash: int(row.slash_attack_bonus) ?? 0,
      crush: int(row.crush_attack_bonus) ?? 0,
      magic: int(row.magic_attack_bonus) ?? 0,
      ranged: int(row.range_attack_bonus) ?? 0
    },
    defence: {
      stab: int(row.stab_defence_bonus) ?? 0,
      slash: int(row.slash_defence_bonus) ?? 0,
      crush: int(row.crush_defence_bonus) ?? 0,
      magic: int(row.magic_defence_bonus) ?? 0,
      ranged: int(row.range_defence_bonus) ?? 0
    },
    other: {
      strength: int(row.strength_bonus) ?? 0,
      rangedStrength: int(row.ranged_strength_bonus) ?? 0,
      magicDamage: (int(row.magic_damage_bonus) ?? 0) / 100,
      prayer: int(row.prayer_bonus) ?? 0
    }
  };
}

// Run as a script: project everything the current roster names, so the output
// is exactly what the app imports and nothing more.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const { BOSS_WIKI_PAGES } = await import("./wiki-roster.mjs");
  const { GEAR_WIKI_PAGES } = await import("./wiki-roster.mjs");

  mkdirSync(OUT_DIR, { recursive: true });

  const bossStats = {};
  const missingBosses = [];
  for (const [slug, spec] of Object.entries(BOSS_WIKI_PAGES)) {
    const projected = projectMonster(spec.page, spec.version);
    if (!projected) { missingBosses.push(slug); continue; }
    bossStats[slug] = projected;
  }

  const gearStats = {};
  const missingGear = [];
  for (const page of GEAR_WIKI_PAGES) {
    const projected = projectEquipment(page);
    if (!projected) { missingGear.push(page); continue; }
    gearStats[page] = projected;
  }

  writeFileSync(join(OUT_DIR, "boss-stats.json"), `${JSON.stringify(bossStats, null, 1)}\n`);
  writeFileSync(join(OUT_DIR, "gear-stats.json"), `${JSON.stringify(gearStats, null, 1)}\n`);
  console.log(`  wrote derived/boss-stats.json (${Object.keys(bossStats).length} bosses)`);
  console.log(`  wrote derived/gear-stats.json (${Object.keys(gearStats).length} items)`);
  if (missingBosses.length) console.log(`  no wiki row: ${missingBosses.join(", ")}`);
  if (missingGear.length) console.log(`  no wiki row: ${missingGear.join(", ")}`);
}
