// What the wiki says versus what we typed.
//
// Usage: npx tsx scripts/wiki-reconcile.mts [--json]
//
// This is the report that justifies the whole wiki-sync exercise. It joins the
// hand-maintained tables in src/lib to data/wiki/*.json and prints every place
// they disagree. Run it before switching anything over, so the switch is a
// measured change rather than a hopeful one.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BOSSES } from "../src/lib/bosses.ts";
import { GEAR } from "../src/lib/gear.ts";

const ROOT = process.cwd();
const wiki = (file: string) =>
  JSON.parse(readFileSync(join(ROOT, "data", "wiki", file), "utf8")).rows as Array<Record<string, unknown>>;

const monsters = wiki("monsters.json");
const equipment = wiki("equipment.json");

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * A monster page often has several rows — Vorkath at 460 during the quest and
 * 750 after, Araxxor at two defence levels. Picking one silently is how a
 * hand-typed table gets the wrong one, so this returns them all and the
 * comparison below says "matches one of" rather than "matches".
 */
function monsterRows(name: string): Array<Record<string, unknown>> {
  const lower = name.toLowerCase();
  return monsters.filter((row) => String(row.page_name ?? "").toLowerCase() === lower);
}

interface Diff {
  subject: string;
  field: string;
  ours: unknown;
  wiki: unknown;
  note?: string;
}

const diffs: Diff[] = [];
const unmatched: string[] = [];

for (const boss of BOSSES) {
  const rows = monsterRows(boss.name);
  if (rows.length === 0) {
    unmatched.push(boss.name);
    continue;
  }
  const compare = (field: string, ours: number | null | undefined, wikiField: string) => {
    if (ours === null || ours === undefined) return;
    const values = rows.map((row) => num(row[wikiField])).filter((value): value is number => value !== null);
    if (values.length === 0) return;
    if (values.includes(ours)) return;
    diffs.push({
      subject: boss.name,
      field,
      ours,
      wiki: values.length === 1 ? values[0] : values,
      note: values.length > 1 ? `${rows.length} versions on the wiki` : undefined
    });
  };
  compare("hp", boss.hp, "hitpoints");
  compare("defenceLevel", boss.defenceLevel, "defence_level");
  compare("def.stab", boss.defenceBonuses?.stab, "stab_defence_bonus");
  compare("def.slash", boss.defenceBonuses?.slash, "slash_defence_bonus");
  compare("def.crush", boss.defenceBonuses?.crush, "crush_defence_bonus");
  compare("def.magic", boss.defenceBonuses?.magic, "magic_defence_bonus");
  compare("def.ranged", boss.defenceBonuses?.ranged, "range_defence_bonus");
  compare("magicLevel", boss.magicLevel, "magic_level");

  // The Salve check. dps.ts decides "undead" with a regex over the boss NAME —
  // /vorkath|skotizo|barrows|zombi/i — which is a guess dressed as a rule. The
  // wiki carries the real attribute, so this compares one against the other.
  const attributes = new Set(
    rows.flatMap((row) => (Array.isArray(row.attribute) ? row.attribute : [row.attribute]))
      .filter(Boolean)
      .map((value) => String(value).toLowerCase())
  );
  const oursUndead = /vorkath|skotizo|barrows|zombi/i.test(boss.name);
  const wikiUndead = attributes.has("undead");
  if (oursUndead !== wikiUndead) {
    diffs.push({ subject: boss.name, field: "undead", ours: oursUndead, wiki: wikiUndead });
  }
}

const equipmentByName = new Map<string, Array<Record<string, unknown>>>();
for (const row of equipment) {
  const key = String(row.page_name ?? "").toLowerCase();
  const list = equipmentByName.get(key) ?? [];
  list.push(row);
  equipmentByName.set(key, list);
}

const gearUnmatched: string[] = [];
for (const item of GEAR) {
  const rows = equipmentByName.get(item.name.toLowerCase());
  if (!rows) {
    gearUnmatched.push(item.name);
    continue;
  }
  const compare = (field: string, ours: number | null | undefined, wikiField: string) => {
    if (ours === null || ours === undefined) return;
    const values = rows.map((row) => num(row[wikiField])).filter((value): value is number => value !== null);
    if (values.length === 0 || values.includes(ours)) return;
    diffs.push({ subject: item.name, field, ours, wiki: values.length === 1 ? values[0] : values });
  };
  compare("atk.stab", item.attack?.stab, "stab_attack_bonus");
  compare("atk.slash", item.attack?.slash, "slash_attack_bonus");
  compare("atk.crush", item.attack?.crush, "crush_attack_bonus");
  compare("atk.magic", item.attack?.magic, "magic_attack_bonus");
  compare("atk.ranged", item.attack?.ranged, "range_attack_bonus");
  compare("strength", item.other?.strength, "strength_bonus");
  compare("rangedStrength", item.other?.rangedStrength, "ranged_strength_bonus");
  compare("prayer", item.other?.prayer, "prayer_bonus");
  if (item.slot === "weapon") compare("speed", item.speed, "weapon_attack_speed");
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ diffs, unmatched, gearUnmatched }, null, 2));
} else {
  const bossDiffs = diffs.filter((diff) => BOSSES.some((boss) => boss.name === diff.subject));
  const gearDiffs = diffs.filter((diff) => !BOSSES.some((boss) => boss.name === diff.subject));

  const table = (rows: Diff[]) => {
    for (const row of rows) {
      const note = row.note ? `  (${row.note})` : "";
      console.log(
        `  ${row.subject.padEnd(26)} ${row.field.padEnd(15)} ours ${String(row.ours).padStart(8)}   wiki ${JSON.stringify(row.wiki)}${note}`
      );
    }
  };

  console.log(`\nBOSSES — ${bossDiffs.length} disagreements across ${BOSSES.length} entries`);
  table(bossDiffs);
  if (unmatched.length) {
    console.log(`\n  no wiki row for: ${unmatched.join(", ")}`);
  }

  console.log(`\nGEAR — ${gearDiffs.length} disagreements across ${GEAR.length} entries`);
  table(gearDiffs);
  if (gearUnmatched.length) {
    console.log(`\n  no wiki row for: ${gearUnmatched.join(", ")}`);
  }

  console.log(`\nwiki rows available: ${monsters.length} monsters, ${equipment.length} equipment`);
  console.log(`hand-maintained:     ${BOSSES.length} bosses, ${GEAR.length} items`);
}
