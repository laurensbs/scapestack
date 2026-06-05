// Builds data/diaries.json from the OSRS Wiki.
//
// For each of the 12 Achievement Diary regions, fetches the page wikitext
// and parses the {{DiarySkillStats}} block per tier (Easy / Medium / Hard /
// Elite). Skill levels are deduplicated to the highest per tier in case the
// page lists Regular vs Ironman variants side-by-side.
//
// Output shape (data/diaries.json):
//   { "Karamja": {
//       name: "Karamja Diary",
//       tiers: {
//         Easy:   { skills: [{ skill, level }, ...] },
//         Medium: { skills: [...] },
//         Hard:   { skills: [...] },
//         Elite:  { skills: [...] }
//       }
//     }, …
//   }
//
// Run: node scripts/build-diary-data.mjs

import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "scapestack-bank-organizer/1.0 (diary data build script)";
const WIKI = "https://oldschool.runescape.wiki/api.php";

// The 12 canonical OSRS Achievement Diaries — Wiki page titles.
// Region key (used in the output) is the page title minus " Diary".
const DIARIES = [
  "Ardougne Diary", "Desert Diary", "Falador Diary", "Fremennik Diary",
  "Kandarin Diary", "Karamja Diary", "Kourend & Kebos Diary",
  "Lumbridge & Draynor Diary", "Morytania Diary", "Varrock Diary",
  "Western Provinces Diary", "Wilderness Diary"
];
const TIERS = ["Easy", "Medium", "Hard", "Elite"];

// Only these names are real Wiki skill stats — anything else parsed out of
// the template (subheadings, decorative params) is ignored.
const SKILL_NAMES = new Set([
  "Attack","Strength","Defence","Hitpoints","Ranged","Prayer","Magic",
  "Cooking","Woodcutting","Fletching","Fishing","Firemaking","Crafting",
  "Smithing","Mining","Herblore","Agility","Thieving","Slayer","Farming",
  "Runecraft","Hunter","Construction","Sailing"
]);

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

// Balanced-brace extract of a single template instance starting at `start`.
function readTemplate(wikitext, start) {
  let depth = 0;
  for (let i = start; i < wikitext.length; i++) {
    if (wikitext[i] === "{" && wikitext[i + 1] === "{") { depth++; i++; }
    else if (wikitext[i] === "}" && wikitext[i + 1] === "}") {
      depth--; i++;
      if (depth === 0) return { body: wikitext.slice(start, i + 1), end: i + 1 };
    }
  }
  return null;
}

// Parse `|Skill = N` pairs from a DiarySkillStats template body.
// Diaries sometimes show Regular + Ironman side-by-side in the same template;
// we keep the highest level seen per skill so the harder requirement wins.
function parseDiaryStats(body) {
  const re = /\|\s*([A-Z][a-zA-Z]+)\s*=\s*(\d+)/g;
  const max = new Map();
  let m;
  while ((m = re.exec(body)) !== null) {
    const skill = m[1];
    if (!SKILL_NAMES.has(skill)) continue;
    const lvl = parseInt(m[2], 10);
    if (!Number.isFinite(lvl)) continue;
    max.set(skill, Math.max(max.get(skill) ?? 0, lvl));
  }
  return [...max.entries()]
    .map(([skill, level]) => ({ skill, level }))
    .sort((a, b) => b.level - a.level);
}

async function parseDiary(title) {
  const enc = encodeURIComponent(title);
  const data = await getJSON(`${WIKI}?action=parse&page=${enc}&prop=wikitext&format=json`);
  const w = data?.parse?.wikitext?.["*"];
  if (!w) throw new Error("no wikitext");

  // Find each tier marker: either `\n<Tier>=` (tabber block) or
  // `\n==<Tier>==` (H2 section header). Whichever appears first wins; if
  // neither shows up, that tier just gets an empty entry.
  const tierIdx = {};
  for (const tier of TIERS) {
    const tabber = w.indexOf(`\n${tier}=`);
    const section = w.indexOf(`\n==${tier}==`);
    const cands = [tabber, section].filter((x) => x >= 0);
    tierIdx[tier] = cands.length ? Math.min(...cands) : -1;
  }
  const found = TIERS.filter((t) => tierIdx[t] >= 0).sort((a, b) => tierIdx[a] - tierIdx[b]);

  const tiers = {};
  for (let i = 0; i < found.length; i++) {
    const tier = found[i];
    const start = tierIdx[tier];
    // Stop at the next tier's marker to avoid bleed-over between sections.
    const end = i + 1 < found.length ? tierIdx[found[i + 1]] : w.length;
    const slice = w.slice(start, end);
    const statsIdx = slice.indexOf("{{DiarySkillStats");
    if (statsIdx < 0) { tiers[tier] = { skills: [] }; continue; }
    const tmpl = readTemplate(slice, statsIdx);
    if (!tmpl) { tiers[tier] = { skills: [] }; continue; }
    tiers[tier] = { skills: parseDiaryStats(tmpl.body) };
  }
  for (const t of TIERS) if (!tiers[t]) tiers[t] = { skills: [] };
  return tiers;
}

async function main() {
  const out = {};
  let parsed = 0;
  for (const title of DIARIES) {
    const key = title.replace(/ Diary$/, "");
    try {
      const tiers = await parseDiary(title);
      out[key] = { name: title, tiers };
      parsed++;
      const tierSummary = TIERS.map((t) => `${t}:${tiers[t].skills.length}`).join(" ");
      console.log(`  ${title} — ${tierSummary}`);
    } catch (e) {
      console.warn(`  ! ${title}: ${e.message}`);
    }
    await sleep(150);
  }
  const path = join(ROOT, "data", "diaries.json");
  await writeFile(path, JSON.stringify(out, null, 2), "utf8");
  console.log(`✓ Wrote ${parsed}/${DIARIES.length} diaries → data/diaries.json`);
}

main().catch((err) => {
  console.error("✗ build-diary-data failed:", err);
  process.exit(1);
});
