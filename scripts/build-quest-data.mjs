// Builds data/quests.json from the OSRS Wiki.
//
// For each quest in Category:Quests, fetches the page's wikitext, extracts
// the {{Quest details}} template, and parses:
//   - skill requirements (deduplicated to the HIGHEST level per skill)
//   - quest prerequisites (filtered to titles that are themselves quests)
//   - difficulty + length + quest-point requirement
//
// Output shape (data/quests.json):
//   { "<canonical title>": {
//       name, difficulty, length, qpReq,
//       skillReqs: [{ skill, level }, ...],
//       questReqs: [<canonical title>, ...]   // direct prereqs only
//     }
//   }
//
// Re-run whenever the Wiki gains new quests or revises requirements.
// Run: node scripts/build-quest-data.mjs

import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "scapestack-bank-organizer/1.0 (quest data build script)";
const WIKI = "https://oldschool.runescape.wiki/api.php";

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

// ── Wikitext parsing helpers (validated via POC) ────────────────────────────

// Pull the balanced {{Quest details … }} block out of a wikitext blob.
function extractQuestDetails(wikitext) {
  const start = wikitext.indexOf("{{Quest details");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < wikitext.length; i++) {
    if (wikitext[i] === "{" && wikitext[i + 1] === "{") { depth++; i++; }
    else if (wikitext[i] === "}" && wikitext[i + 1] === "}") {
      depth--; i++;
      if (depth === 0) return wikitext.slice(start, i + 1);
    }
  }
  return null;
}

// Extract a named parameter from a single template body. Walks balanced
// braces AND wiki-link brackets so a `|` inside `{{tmpl}}` or `[[link|alt]]`
// doesn't terminate the param value early. (Discovered during the POC:
// Monkey Madness II's prereq `[[Balloon transport system#Grand Tree|Balloon
// flight route]]` broke a naive splitter.)
function getParam(templateBody, name) {
  const needle = `|${name}`;
  const idx = templateBody.indexOf(needle);
  if (idx < 0) return null;
  let i = idx + needle.length;
  while (i < templateBody.length && /\s/.test(templateBody[i])) i++;
  if (templateBody[i] !== "=") return null;
  i++;
  let braceDepth = 0;
  let linkDepth = 0;
  let value = "";
  for (; i < templateBody.length; i++) {
    const c = templateBody[i];
    const n = templateBody[i + 1];
    if (c === "{" && n === "{") { braceDepth++; value += "{{"; i++; continue; }
    if (c === "}" && n === "}") {
      if (braceDepth === 0) break;
      braceDepth--; value += "}}"; i++; continue;
    }
    if (c === "[" && n === "[") { linkDepth++; value += "[["; i++; continue; }
    if (c === "]" && n === "]") {
      if (linkDepth > 0) linkDepth--;
      value += "]]"; i++; continue;
    }
    if (c === "|" && braceDepth === 0 && linkDepth === 0) break;
    value += c;
  }
  return value.trim();
}

// Skill-stat templates: {{SCP|<Skill>|<level>|link=yes}}. We pull every
// match then dedupe by skill, keeping the highest level — a quest line like
// RFD lists both sub-quest reqs (Cooking 10) and the master req (Cooking 70);
// only the latter matters for "can the player start this".
const SKILL_NAMES = new Set([
  "Attack","Strength","Defence","Hitpoints","Ranged","Prayer","Magic",
  "Cooking","Woodcutting","Fletching","Fishing","Firemaking","Crafting",
  "Smithing","Mining","Herblore","Agility","Thieving","Slayer","Farming",
  "Runecraft","Hunter","Construction","Sailing"
]);

function parseSkillReqs(requirementsField) {
  const re = /\{\{SCP\|([A-Za-z]+)\|(\d+)/g;
  const highest = new Map();
  let m;
  while ((m = re.exec(requirementsField)) !== null) {
    const skill = m[1];
    if (!SKILL_NAMES.has(skill)) continue;
    const level = parseInt(m[2], 10);
    if (!Number.isFinite(level)) continue;
    const prev = highest.get(skill) ?? 0;
    if (level > prev) highest.set(skill, level);
  }
  return [...highest.entries()]
    .map(([skill, level]) => ({ skill, level }))
    .sort((a, b) => b.level - a.level);
}

// Quest-point requirement: {{SCP|Quest|<n>}}.
function parseQpReq(requirementsField) {
  const m = requirementsField.match(/\{\{SCP\|Quest\|(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

// Quest prerequisites: every [[Page]] link inside the requirements field
// that maps to a real quest title in our known set. Drops fragment + alt
// text, dedupes, and filters out NPCs / locations the link list inevitably
// catches alongside actual quests.
function parseQuestPrereqs(requirementsField, knownTitles) {
  const links = [...requirementsField.matchAll(/\[\[([^\]|#]+?)(?:\|[^\]]+)?\]\]/g)]
    .map((m) => m[1].trim());
  const seen = new Set();
  const out = [];
  for (const l of links) {
    if (!knownTitles.has(l)) continue;
    if (seen.has(l)) continue;
    seen.add(l);
    out.push(l);
  }
  return out;
}

// ── Pipeline ────────────────────────────────────────────────────────────────

async function fetchQuestTitles() {
  const data = await getJSON(`${WIKI}?action=query&list=categorymembers&cmtitle=Category:Quests&cmlimit=500&cmtype=page&format=json`);
  const members = data?.query?.categorymembers ?? [];
  // Filter out meta / list pages (anything with a "/" or starting with
  // "Quest" — those are like "Quests/List", "Quest Speedrunning").
  return members
    .map((m) => m.title)
    .filter((t) => !t.includes("/") && !t.startsWith("Quest "));
}

async function fetchWikitext(title) {
  const url = `${WIKI}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json`;
  const data = await getJSON(url);
  if (data.error) throw new Error(`Wiki error: ${data.error.info}`);
  return data?.parse?.wikitext?.["*"] ?? null;
}

async function main() {
  console.log("→ Fetching quest list …");
  const titles = await fetchQuestTitles();
  console.log(`  ${titles.length} quest titles`);

  const knownTitles = new Set(titles);
  const out = {};
  let parsed = 0, noBlock = 0, errors = 0;

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    try {
      const w = await fetchWikitext(title);
      if (!w) { noBlock++; continue; }
      const block = extractQuestDetails(w);
      if (!block) { noBlock++; continue; }
      const requirements = getParam(block, "requirements") ?? "";
      const difficulty = getParam(block, "difficulty");
      const length = getParam(block, "length");
      out[title] = {
        name: title,
        difficulty: difficulty || null,
        length: length || null,
        qpReq: parseQpReq(requirements),
        skillReqs: parseSkillReqs(requirements),
        questReqs: parseQuestPrereqs(requirements, knownTitles)
      };
      parsed++;
    } catch (e) {
      errors++;
      console.warn(`  ! ${title}: ${e.message}`);
    }
    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\r  parsed ${i + 1}/${titles.length}`);
    }
    await sleep(120);
  }
  console.log(`\n  ${parsed} parsed, ${noBlock} missing Quest details, ${errors} errors`);

  const path = join(ROOT, "data", "quests.json");
  await writeFile(path, JSON.stringify(out, null, 2), "utf8");
  console.log(`✓ Wrote ${parsed} quest records → data/quests.json`);
}

main().catch((err) => {
  console.error("✗ build-quest-data failed:", err);
  process.exit(1);
});
