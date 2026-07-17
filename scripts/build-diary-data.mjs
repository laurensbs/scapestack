// Builds data/diaries.json from the OSRS Wiki.
//
// For each of the 12 Achievement Diary regions, fetches the page wikitext
// and parses the {{DiarySkillStats}} block plus the exact task table per tier
// (Easy / Medium / Hard / Elite). Skill levels are deduplicated to the highest
// per tier in case the page lists Regular vs Ironman variants side-by-side.
//
// Output shape (data/diaries.json):
//   { "Karamja": {
//       name: "Karamja Diary",
//       tiers: {
//         Easy:   { skills: [{ skill, level }, ...], tasks: [{ id, label, requirements }] },
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

function stripBalancedTemplates(value, templateName) {
  let output = value;
  const needle = `{{${templateName}`.toLowerCase();
  let start = output.toLowerCase().indexOf(needle);
  while (start >= 0) {
    const parsed = readTemplate(output, start);
    if (!parsed) break;
    output = `${output.slice(0, start)}${output.slice(parsed.end)}`;
    start = output.toLowerCase().indexOf(needle);
  }
  return output;
}

export function cleanDiaryWikitext(value) {
  let output = value
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, " ")
    .replace(/<ref\b[^>]*\/?\s*>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ");
  output = stripBalancedTemplates(output, "efn");
  output = output
    .replace(/\{\{NA\|([^}]+)\}\}/gi, "$1")
    .replace(/\{\{SCP\|Quest(?:\|[^}]*)?\}\}/gi, "Quest")
    .replace(/\{\{SCP\|([^|}]+)\|([^|}]+)(?:\|[^}]*)?\}\}/gi, "$1 $2")
    .replace(/\{\{sic(?:\|[^}]*)?\}\}/gi, "")
    .replace(/\{\{[^{}]*\}\}/g, " ")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, "$1")
    .replace(/\[https?:\/\/[^\]]+\]/g, " ")
    .replace(/<br\s*\/?>/gi, " · ")
    .replace(/<[^>]+>/g, " ")
    .replace(/''+/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  return output;
}

function taskLabel(value) {
  const withoutNotes = value.split(/\n\s*''?Note:/i)[0] ?? value;
  return cleanDiaryWikitext(withoutNotes)
    .replace(/^\d+\.\s*/, "")
    .trim();
}

function taskRequirements(value) {
  const lines = value
    .split(/\n+/)
    .map((line) => line.replace(/^\s*\*+\s*/, "").trim())
    .filter((line) => line && !/^''?Note:/i.test(line))
    .map(cleanDiaryWikitext)
    .filter((line) => line && !/^none$/i.test(line));
  return [...new Set(lines)];
}

export function parseDiaryTaskTable(wikitext, region, tier) {
  const marker = new RegExp(`data-diary-tier=["']${tier}["']`, "i").exec(wikitext);
  if (!marker) return [];
  const tableEnd = wikitext.indexOf("\n|}", marker.index);
  if (tableEnd < 0) return [];
  const table = wikitext.slice(marker.index, tableEnd);
  const rows = table.split(/\n\|-\s*\n/).slice(1);
  const regionId = region.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return rows.flatMap((row, index) => {
    const columns = /^\|\s*([\s\S]*?)\n\|\s*([\s\S]*)$/.exec(row.trim());
    if (!columns) return [];
    const label = taskLabel(columns[1]);
    if (!label) return [];
    return [{
      id: `${regionId}:${tier.toLowerCase()}:${index + 1}`,
      label,
      requirements: taskRequirements(columns[2])
    }];
  });
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
    const tasks = parseDiaryTaskTable(w, title.replace(/ Diary$/, ""), tier);
    if (statsIdx < 0) { tiers[tier] = { skills: [], tasks }; continue; }
    const tmpl = readTemplate(slice, statsIdx);
    if (!tmpl) { tiers[tier] = { skills: [], tasks }; continue; }
    tiers[tier] = { skills: parseDiaryStats(tmpl.body), tasks };
  }
  for (const t of TIERS) if (!tiers[t]) tiers[t] = { skills: [], tasks: parseDiaryTaskTable(w, title.replace(/ Diary$/, ""), t) };
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
      const tierSummary = TIERS.map((t) => `${t}:${tiers[t].skills.length}s/${tiers[t].tasks.length}t`).join(" ");
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

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error("✗ build-diary-data failed:", err);
    process.exit(1);
  });
}
