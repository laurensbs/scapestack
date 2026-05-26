// Auto-fix HP-waardes in src/lib/slayer/monsters.ts naar wiki defaults.
//
// Werkwijze:
//   1. Voor elke monster: zoek de wiki-pagina (zelfde logic als
//      verify-slayer-data.mts) en parse hp uit de Infobox
//   2. Lees monsters.ts als tekst
//   3. Vervang per monster de eerste 'hp: NN,' regel die volgt na de
//      'id: "{id}"' lijn met de wiki-waarde
//   4. Schrijf terug
//
// Schrijft alleen wanneer wiki HP afwijkt van onze HP. Pakt alleen
// variant 1 van de infobox (de meest-aangevallen variant per wiki).
//
// Verwachtte exit: 0 op success, 1 wanneer >5 monsters niet gevonden
// werden (dan handmatig verder).
//
// Gebruik:
//   npx tsx scripts/fix-slayer-hp.mts
//   npx tsx scripts/fix-slayer-hp.mts --dry  (alleen rapporteren)

import { readFile, writeFile } from "node:fs/promises";
import { MONSTERS } from "../src/lib/slayer/monsters";

const UA = "scapestack-data-fix/0.1 (+https://www.scapestack.org)";
const WIKI_API = "https://oldschool.runescape.wiki/api.php";
const SOURCE_FILE = "src/lib/slayer/monsters.ts";

async function fetchWikitext(title: string, redirected = false): Promise<string | null> {
  const url = `${WIKI_API}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2`;
  try {
    const res = await fetch(url, { headers: { "user-agent": UA } });
    if (!res.ok) return null;
    const data = await res.json() as { parse?: { wikitext?: string }; error?: unknown };
    if (data.error || !data.parse?.wikitext) return null;
    const text = data.parse.wikitext;
    const redirect = text.match(/^#REDIRECT\s*\[\[([^\]|]+)/i);
    if (redirect && !redirected) return fetchWikitext(redirect[1].trim(), true);
    return text;
  } catch { return null; }
}

async function findMonsterPage(name: string, id: string): Promise<string | null> {
  const candidates = [
    name,
    `${name} (monster)`,
    name.replace(/\s*\(.*\)$/, ""),
    id.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "),
    `${id.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")} (monster)`
  ];
  for (const title of candidates) {
    const text = await fetchWikitext(title);
    if (text && /\{\{Infobox Monster/i.test(text)) return text;
  }
  return null;
}

function parseHp(wikitext: string): number | null {
  const start = wikitext.search(/\{\{Infobox Monster/i);
  if (start === -1) return null;
  // Pak block tot matching }}
  let depth = 0, end = start;
  for (let i = start; i < wikitext.length - 1; i++) {
    if (wikitext.slice(i, i + 2) === "{{") { depth++; i++; continue; }
    if (wikitext.slice(i, i + 2) === "}}") { depth--; i++; if (depth === 0) { end = i + 1; break; } }
  }
  const block = wikitext.slice(start, end);
  // Pak hitpoints of hitpoints1
  const m = block.match(/\|\s*hitpoints1?\s*=\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

async function main() {
  const dryRun = process.argv.includes("--dry");
  const source = await readFile(SOURCE_FILE, "utf8");
  let updated = source;
  let fixes = 0;
  let notFound = 0;

  for (const monster of MONSTERS) {
    const text = await findMonsterPage(monster.name, monster.id);
    if (!text) {
      console.log(`  ⚠ ${monster.id.padEnd(28)} not found`);
      notFound++;
      await new Promise((r) => setTimeout(r, 200));
      continue;
    }
    const wikiHp = parseHp(text);
    if (wikiHp === null) {
      console.log(`  ⚠ ${monster.id.padEnd(28)} no hp in infobox`);
      await new Promise((r) => setTimeout(r, 200));
      continue;
    }
    if (wikiHp === monster.hp) {
      // Geen log; te veel ruis
      await new Promise((r) => setTimeout(r, 200));
      continue;
    }
    // Vind 'id: "{id}"' regel, dan de eerstvolgende 'hp: NN,'
    const idMarker = `id: "${monster.id}"`;
    const idIdx = updated.indexOf(idMarker);
    if (idIdx === -1) {
      console.log(`  ⚠ ${monster.id.padEnd(28)} id-marker niet gevonden in source`);
      await new Promise((r) => setTimeout(r, 200));
      continue;
    }
    const hpRegex = /hp:\s*(\d+),/;
    const after = updated.slice(idIdx);
    const hpMatch = after.match(hpRegex);
    if (!hpMatch) {
      console.log(`  ⚠ ${monster.id.padEnd(28)} hp-veld niet gevonden`);
      await new Promise((r) => setTimeout(r, 200));
      continue;
    }
    const hpStart = idIdx + after.indexOf(hpMatch[0]);
    const newLine = `hp: ${wikiHp},`;
    console.log(`  ✓ ${monster.id.padEnd(28)} hp: ${monster.hp} -> ${wikiHp}`);
    updated = updated.slice(0, hpStart) + newLine + updated.slice(hpStart + hpMatch[0].length);
    fixes++;
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n${fixes} hp-waardes ${dryRun ? "zouden worden" : "zijn"} gefixt. ${notFound} monsters niet gevonden.`);
  if (!dryRun && fixes > 0) {
    await writeFile(SOURCE_FILE, updated, "utf8");
    console.log(`Wrote ${SOURCE_FILE}.`);
  }
  process.exit(notFound > 5 ? 1 : 0);
}

main();
