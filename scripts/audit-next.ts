// Eerlijkheidstest voor /next.
//
// Doel: drie archetypes uit docs/USER-TEST.md door de echte engine
// halen en de top-aanbevelingen printen, zodat we kunnen zien of het
// advies *zinnig* is voor uiteenlopende accounts — niet alleen of de
// tests groen blijven. Run met:
//
//   npx tsx scripts/audit-next.ts
//
// Geen UI, geen netwerk: alle inputs zijn hier hardcoded zodat het
// script reproduceerbaar is en niet afhangt van Hiscores-uptime.

import { computeNextUp, type Recommendation } from "../src/lib/next-up";
import type { HiscoreSkill } from "../src/lib/hiscores";
import type { CompletionItem } from "../src/lib/goals";

// ── Helpers ────────────────────────────────────────────────────────

// Hiscores volgorde: Overall + 23 skills. xp grof afgeleid van level
// via een lookup-tabel zou pedant zijn — voor de engine matters
// vooral `level`, dus we vullen `xp` met een plausibele waarde.
const SKILL_NAMES = [
  "Overall", "Attack", "Defence", "Strength", "Hitpoints", "Ranged",
  "Prayer", "Magic", "Cooking", "Woodcutting", "Fletching", "Fishing",
  "Firemaking", "Crafting", "Smithing", "Mining", "Herblore", "Agility",
  "Thieving", "Slayer", "Farming", "Runecraft", "Hunter", "Construction"
];

// Approximate XP-at-level (RuneScape formula, truncated). Good enough
// for the engine — it cares about levels, not exact xp.
function xpAtLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 1; l < level; l++) {
    total += Math.floor(l + 300 * Math.pow(2, l / 7));
  }
  return Math.floor(total / 4);
}

// Build a Hiscores-shaped skills array from a level map. Skills not
// given default to 1.
function buildSkills(levels: Partial<Record<string, number>>): HiscoreSkill[] {
  const filled: HiscoreSkill[] = SKILL_NAMES.map((name, id) => ({
    id,
    name,
    rank: 100_000,
    level: levels[name] ?? (name === "Hitpoints" ? 10 : 1),
    xp: xpAtLevel(levels[name] ?? (name === "Hitpoints" ? 10 : 1))
  }));
  // Overall = sum of all non-Overall levels (matches Hiscores convention).
  const overallLevel = filled
    .filter((s) => s.name !== "Overall")
    .reduce((sum, s) => sum + s.level, 0);
  const overallXp = filled
    .filter((s) => s.name !== "Overall")
    .reduce((sum, s) => sum + s.xp, 0);
  filled[0] = { id: 0, name: "Overall", rank: 100_000, level: overallLevel, xp: overallXp };
  return filled;
}

// ── Scenario inputs ─────────────────────────────────────────────────

const SCENARIOS: Array<{
  label: string;
  blurb: string;
  skills: HiscoreSkill[];
  bank: CompletionItem[];
  questPoints: number;
  bossKc: Record<string, number>;
  expected: string[];
  badSigns: string[];
}> = [
  {
    label: "A — Returning casual",
    blurb: "Combat 80, mid stats, 105 QP, no diaries, modest bank.",
    skills: buildSkills({
      Attack: 70, Strength: 75, Defence: 70, Hitpoints: 75, Ranged: 70,
      Magic: 70, Prayer: 52, Slayer: 50,
      Cooking: 70, Woodcutting: 65, Fletching: 65, Fishing: 65,
      Firemaking: 60, Crafting: 60, Smithing: 60, Mining: 65,
      Herblore: 55, Agility: 60, Thieving: 60, Farming: 55,
      Runecraft: 50, Hunter: 60, Construction: 50
    }),
    bank: [
      { id: 4151, name: "Abyssal whip" },
      { id: 1127, name: "Rune platebody" },
      { id: 1079, name: "Rune platelegs" },
      { id: 1163, name: "Rune full helm" },
      { id: 1201, name: "Rune kiteshield" },
      { id: 2503, name: "Black d'hide body" },
      { id: 2497, name: "Black d'hide chaps" },
      { id: 1135, name: "Black d'hide vambraces" },
      { id: 4091, name: "Mystic robe top" },
      { id: 4093, name: "Mystic robe bottom" },
      { id: 1712, name: "Amulet of glory" },
      { id: 11980, name: "Ring of wealth (5)" },
      { id: 12625, name: "Stamina potion(4)" },
      { id: 385, name: "Shark" }
    ],
    questPoints: 105,
    bossKc: {},
    expected: [
      "A quest worth doing now (RFD subs, While Guthix Sleeps, Monkey Madness II, …)",
      "A diary tier they passively meet (Karamja Medium / Falador Medium / Varrock Medium)",
      "A skill push within reach (Slayer 70 / Prayer 70 / Agility 70)"
    ],
    badSigns: [
      "Headline = 'Tidy your bank'",
      "Boss rec requiring gear they don't have (Tbow Vorkath, Shadow CoX)",
      "Maxing-tier milestone (Quest Cape implies more than 50 QP gap)"
    ]
  },
  {
    label: "B — Maxed iron on a grind",
    blurb: "Every 99, full BiS, several boss KCs already.",
    skills: buildSkills(Object.fromEntries(SKILL_NAMES.map((n) => [n, 99]))),
    bank: [
      { id: 20997, name: "Twisted bow" },
      { id: 22325, name: "Scythe of vitur" },
      { id: 27275, name: "Shadow of tumeken" },
      { id: 25865, name: "Bow of faerdhinen (c)" },
      { id: 27226, name: "Masori mask (f)" },
      { id: 27229, name: "Masori body (f)" },
      { id: 27232, name: "Masori chaps (f)" },
      { id: 26382, name: "Torva full helm" },
      { id: 26384, name: "Torva platebody" },
      { id: 26386, name: "Torva platelegs" },
      { id: 28997, name: "Soulreaper axe" },
      { id: 13342, name: "Max cape" },
      { id: 9813, name: "Quest point cape" },
      { id: 26219, name: "Osmumten's fang" }
    ],
    questPoints: 300,
    bossKc: {
      "Vorkath": 1500,
      "Zulrah": 800,
      "Chambers of Xeric": 250,
      "Theatre of Blood": 80,
      "Tombs of Amascut": 400,
      "Alchemical Hydra": 600,
      "Vardorvis": 350,
      "Duke Sucellus": 320,
      "The Leviathan": 280,
      "The Whisperer": 240
    },
    expected: [
      "A pet/unique they're dry on (Vorki at 1500 KC, Tanzanite mutagen, Xeric/Sanguine/Tumeken's heir)",
      "A specific drop chase (Tbow at 250 CoX KC, Shadow ToA — but they have these → next tier)",
      "Collection log / CA tier / completion goal"
    ],
    badSigns: [
      "Sub-99 skill recommendation",
      "Beginner gear set goal (Bandos, Armadyl)",
      "Diary recs (everything is done)"
    ]
  },
  {
    label: "C — Early account, no RSN",
    blurb: "Empty skills, tutorial-island bank.",
    skills: [],
    bank: [
      { id: 1277, name: "Bronze sword" },
      { id: 1095, name: "Leather chaps" },
      { id: 379, name: "Lobster" },
      { id: 315, name: "Shrimps" },
      { id: 556, name: "Air rune" },
      { id: 558, name: "Mind rune" },
      { id: 1167, name: "Leather coif" }
    ],
    questPoints: 0,
    bossKc: {},
    expected: [
      "Flag that an RSN is missing — engine should be honest about its inputs",
      "Quest starters (Cook's Assistant, Sheep Shearer, Romeo & Juliet)",
      "Bank hygiene / early-utility suggestion"
    ],
    badSigns: [
      "Goal completion claim (they have nothing complete)",
      "Skill milestone (no skills > 1)",
      "Boss recommendation"
    ]
  }
];

// ── Render ──────────────────────────────────────────────────────────

function ansi(s: string, code: string): string {
  return `\x1b[${code}m${s}\x1b[0m`;
}
const bold = (s: string) => ansi(s, "1");
const dim = (s: string) => ansi(s, "2");
const gold = (s: string) => ansi(s, "33");
const green = (s: string) => ansi(s, "32");
const red = (s: string) => ansi(s, "31");
const cyan = (s: string) => ansi(s, "36");

function fmtRec(r: Recommendation, index: number): string {
  const kindTag = `[${r.kind}]`;
  return [
    `  ${bold(String(index + 1).padStart(2, " "))}.`,
    gold(kindTag.padEnd(11, " ")),
    `${r.score.toString().padStart(3, " ")}/100`,
    bold(r.title),
    dim(`— ${r.why}`)
  ].join(" ");
}

async function main() {
  console.log("");
  console.log(bold(gold("Scapestack /next — eerlijkheidstest")));
  console.log(dim("Hardcoded scenarios from docs/USER-TEST.md, run against the live engine."));
  console.log(dim("Look for: do the top picks resemble what an OSRS player would actually do next?"));
  console.log("");

  for (const s of SCENARIOS) {
    console.log("");
    console.log(cyan("━".repeat(80)));
    console.log(`${bold(cyan(s.label))}  ${dim(s.blurb)}`);
    console.log(cyan("━".repeat(80)));

    const result = await computeNextUp({
      skills: s.skills,
      bank: s.bank,
      questPoints: s.questPoints,
      bossKc: s.bossKc
    });

    console.log("");
    console.log(`${dim("basis:")}  ${result.summary.basis}` +
      (result.summary.combatLevel !== null ? `   ${dim("CB:")} ${result.summary.combatLevel}` : "") +
      (result.summary.totalLevel !== null ? `   ${dim("Total:")} ${result.summary.totalLevel}` : "") +
      (result.summary.goalPercent !== null ? `   ${dim("Goals:")} ${result.summary.goalPercent}%` : ""));
    console.log("");

    if (result.headline) {
      console.log(green("  ★ Headline:") + " " +
        `${gold(`[${result.headline.kind}]`)} ${bold(result.headline.title)}`);
      console.log(`     ${dim(result.headline.why)}`);
      if (result.headline.payoff) console.log(`     ${dim("payoff: " + result.headline.payoff)}`);
      console.log("");
    } else {
      console.log(red("  ★ No headline — engine returned no recommendations."));
      console.log("");
    }

    console.log(dim("  Rest (top 7):"));
    for (let i = 0; i < Math.min(7, result.rest.length); i++) {
      console.log(fmtRec(result.rest[i], i));
    }

    console.log("");
    console.log(dim("  Expected:"));
    for (const e of s.expected) console.log(`    ${green("✓?")} ${e}`);
    console.log(dim("  Bad signs:"));
    for (const b of s.badSigns) console.log(`    ${red("✗?")} ${b}`);
  }

  console.log("");
  console.log(cyan("━".repeat(80)));
  console.log(dim("How to use: read each scenario's headline + top-7 against the"));
  console.log(dim("expectations and bad signs. Update docs/USER-TEST.md when reality"));
  console.log(dim("disagrees with our taste — the doc is a living reference."));
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
