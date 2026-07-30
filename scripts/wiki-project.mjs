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
const quests = load("quests.json");
const moneyMakingGuide = load("money-making-guide.json");
const recommendedEquipment = load("recommended-equipment.json");

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

function list(value) {
  return Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
}

function positiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function wikiLinks(value) {
  const links = [];
  const source = String(value ?? "");
  const pattern = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;
  for (const match of source.matchAll(pattern)) {
    const page = match[1].trim();
    if (!page || /^File:/i.test(page)) continue;
    links.push(page);
  }
  return [...new Set(links)];
}

function plainWikiText(value) {
  return String(value ?? "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function methodId(pageName) {
  return String(pageName ?? "")
    .replace(/^Money making guide\//i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function idsFromItemRow(row) {
  return list(row.item_id)
    .flatMap((value) => String(value ?? "").split(/[;,]/))
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function isTradeable(row) {
  // Bucket booleans are presence markers: true is an empty string, false is
  // an absent key. This is the same representation as default_version.
  return row.tradeable !== undefined && row.tradeable !== null;
}

const itemFactsByName = new Map();
for (const row of items) {
  const facts = {
    itemIds: idsFromItemRow(row),
    tradeable: isTradeable(row)
  };
  for (const name of [row.item_name, row.page_name]) {
    const key = lower(name).trim();
    if (!key) continue;
    const current = itemFactsByName.get(key) ?? { itemIds: [], tradeable: false };
    itemFactsByName.set(key, {
      itemIds: [...new Set([...current.itemIds, ...facts.itemIds])].sort((a, b) => a - b),
      tradeable: current.tradeable || facts.tradeable
    });
  }
}

function itemFact(name) {
  return itemFactsByName.get(lower(name).trim()) ?? { itemIds: [], tradeable: false };
}

function projectItemAmount(entry, killsPerHour) {
  const name = String(entry?.name ?? "").trim();
  if (!name) return null;
  const quantity = positiveNumber(entry.qty);
  const perHour = entry.isph === true;
  const perAction = perHour && killsPerHour > 0 ? quantity / killsPerHour : quantity;
  const fact = itemFact(name);
  return {
    name,
    itemIds: fact.itemIds,
    tradeable: fact.tradeable,
    quantity,
    perHour,
    requiredToStart: Math.max(1, Math.ceil(perAction || 1)),
    wikiUnitValue: positiveNumber(entry.value),
    priceType: String(entry.pricetype ?? "") || null
  };
}

function projectSkillRequirements(value) {
  const source = String(value ?? "");
  const requirements = [];
  const spanPattern = /<span\b([^>]*)>[\s\S]*?<\/span>/gi;
  const spans = [...source.matchAll(spanPattern)];
  for (let index = 0; index < spans.length; index += 1) {
    const match = spans[index];
    const attributes = match[1];
    const skill = attributes.match(/data-skill=["']([^"']+)["']/i)?.[1]?.trim();
    const levelText = attributes.match(/data-level=["']([^"']+)["']/i)?.[1];
    const level = Number.parseInt(String(levelText ?? ""), 10);
    if (!skill || !Number.isFinite(level) || level <= 0) continue;
    const afterStart = (match.index ?? 0) + match[0].length;
    const afterEnd = spans[index + 1]?.index ?? source.length;
    const immediate = plainWikiText(source.slice(afterStart, afterEnd).split("\n")[0]);
    // The wiki distinguishes `44 (91 recommended)` from `70 recommended`.
    // Only the latter makes the data-level itself advisory.
    if (/^(?:recommended|or higher recommended)\b/i.test(immediate)) continue;
    requirements.push({ skill, level });
  }
  const strongest = new Map();
  for (const requirement of requirements) {
    const key = lower(requirement.skill);
    const current = strongest.get(key);
    if (!current || requirement.level > current.level) strongest.set(key, requirement);
  }
  return [...strongest.values()].sort((left, right) => left.skill.localeCompare(right.skill));
}

const questNameByPage = new Map(quests.map((row) => [lower(row.page_name).trim(), row.page_name]));

function projectQuestRequirements(value) {
  // The Bucket field is prose, not a structured quest array. Keep only links
  // that resolve to the live quest Bucket, and honor the Wiki's explicit
  // optional/recommended labels at their comma-or-line clause boundary.
  const source = String(value ?? "").replace(/<br\s*\/?\s*>/gi, "\n");
  const requirements = [];
  for (const line of source.split("\n")) {
    for (const clause of line.split(",")) {
      const plain = plainWikiText(clause);
      if (!plain || /^\*?\s*none\b/i.test(plain)) continue;
      if (/\b(?:strongly |highly )?recommended\b|\boptional(?:ly)?\b/i.test(plain)) continue;
      for (const link of wikiLinks(clause)) {
        const quest = questNameByPage.get(lower(link).trim());
        if (quest) requirements.push(quest);
      }
    }
  }
  return [...new Set(requirements)].sort((left, right) => left.localeCompare(right));
}

const recommendedByPage = new Map();
for (const row of recommendedEquipment) {
  const key = lower(row.page_name);
  const rows = recommendedByPage.get(key) ?? [];
  rows.push(row);
  recommendedByPage.set(key, rows);
}

function projectLoadout(row) {
  let body;
  try {
    body = JSON.parse(row.json);
  } catch {
    return null;
  }
  const slots = body?.["Recommended Equipment"];
  if (!slots || typeof slots !== "object" || Array.isArray(slots)) return null;
  const projectedSlots = Object.entries(slots).map(([slot, entries]) => {
    const names = [...new Set(list(entries).flatMap(wikiLinks))];
    const alternatives = names.map((name) => ({ name, ...itemFact(name) }));
    return { slot, alternatives };
  }).filter((slot) => slot.alternatives.length > 0);
  if (!projectedSlots.length) return null;
  return {
    page: row.page_name,
    style: String(body.style ?? "").trim() || null,
    slots: projectedSlots
  };
}

function loadoutsForMethod(method) {
  const activityLinks = wikiLinks(method.activity);
  const candidatePages = new Set();
  for (const link of activityLinks) {
    candidatePages.add(lower(link));
    candidatePages.add(lower(`${link}/Strategies`));
    candidatePages.add(lower(`${link}/Strategy`));
  }
  return [...candidatePages]
    .flatMap((page) => recommendedByPage.get(page) ?? [])
    .map(projectLoadout)
    .filter(Boolean);
}

export function projectMoneyMethod(row) {
  let body;
  try {
    body = JSON.parse(row.json);
  } catch {
    return null;
  }
  const activity = String(body.activity ?? row.page_name?.replace(/^Money making guide\//i, "") ?? "").trim();
  const killsPerHour = positiveNumber(body.prices?.default_kph);
  return {
    id: methodId(row.page_name),
    page: row.page_name,
    activity: plainWikiText(activity),
    category: String(body.category ?? "").trim() || null,
    intensity: String(body.intensity ?? "").trim() || null,
    members: body.members === true,
    wikiGpPerHour: Math.round(positiveNumber(row.value) || positiveNumber(body.prices?.default_value)),
    killsPerHour,
    skillRequirements: projectSkillRequirements(body.skill),
    questRequirements: projectQuestRequirements(body.quest),
    inputs: list(body.inputs).map((entry) => projectItemAmount(entry, killsPerHour)).filter(Boolean),
    outputs: list(body.outputs).map((entry) => projectItemAmount(entry, killsPerHour)).filter(Boolean),
    loadouts: loadoutsForMethod({ ...body, activity })
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

  const moneyMethods = moneyMakingGuide
    .map(projectMoneyMethod)
    .filter(Boolean)
    .sort((left, right) => left.page.localeCompare(right.page));

  writeFileSync(join(OUT_DIR, "boss-stats.json"), `${JSON.stringify(bossStats, null, 1)}\n`);
  writeFileSync(join(OUT_DIR, "gear-stats.json"), `${JSON.stringify(gearStats, null, 1)}\n`);
  writeFileSync(join(OUT_DIR, "money-methods.json"), `${JSON.stringify(moneyMethods, null, 1)}\n`);
  console.log(`  wrote derived/boss-stats.json (${Object.keys(bossStats).length} bosses)`);
  console.log(`  wrote derived/gear-stats.json (${Object.keys(gearStats).length} items)`);
  console.log(`  wrote derived/money-methods.json (${moneyMethods.length} methods)`);
  if (missingBosses.length) console.log(`  no wiki row: ${missingBosses.join(", ")}`);
  if (missingGear.length) console.log(`  no wiki row: ${missingGear.join(", ")}`);
}
