// Slayer-data verifier — vergelijkt onze handmatige monster-data
// tegen de OSRS Wiki API.
//
// Voor elke monster in src/lib/slayer/monsters.ts:
//   1. Probeer de monster-pagina te vinden via het wiki-API (zoekt op
//      monster.name; fallback op id wanneer name+spaces niet matcht)
//   2. Parse de {{Infobox Monster}} template — wiki vult hp, slayerlevel,
//      combat, attack style, weakness in een eenduidig format
//   3. Vergelijk met onze waardes; rapporteer mismatches
//
// Niet-autocorrect: we doen geen schrijfacties. Geeft een report. Jij
// beslist wat te fixen.
//
// Gebruik:
//   npx tsx scripts/verify-slayer-data.mts
//   npx tsx scripts/verify-slayer-data.mts --only=bloodveld    (één monster)

import { MONSTERS } from "../src/lib/slayer/monsters";
import type { SlayerMonster } from "../src/lib/slayer/types";

const UA = "scapestack-data-verify/0.1 (+https://www.scapestack.org)";
const WIKI_API = "https://oldschool.runescape.wiki/api.php";

interface WikiMonsterFields {
  hp?: number;
  slayerlvl?: number;
  combat?: number;
  /** Comma-separated stijl-keys uit het infobox-template. */
  weakness?: string;
  /** Aanvalsstijl van de monster (info, niet gevergeleken). */
  attackStyle?: string;
}

interface Mismatch {
  monsterId: string;
  field: keyof WikiMonsterFields;
  ourValue: unknown;
  wikiValue: unknown;
}

/** Haalt raw wikitext op + volgt #REDIRECT links (één hop diep). */
async function fetchWikitext(title: string, _redirected = false): Promise<string | null> {
  const url = `${WIKI_API}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2`;
  try {
    const res = await fetch(url, { headers: { "user-agent": UA } });
    if (!res.ok) return null;
    const data = await res.json() as { parse?: { wikitext?: string }; error?: unknown };
    if (data.error || !data.parse?.wikitext) return null;
    const text = data.parse.wikitext;
    // Volg #REDIRECT [[Target]] één hop diep.
    const redirect = text.match(/^#REDIRECT\s*\[\[([^\]|]+)/i);
    if (redirect && !_redirected) {
      return fetchWikitext(redirect[1].trim(), true);
    }
    return text;
  } catch {
    return null;
  }
}

/** Probeer alternatieve pagina-titels wanneer de basis-naam niet matcht.
 *  Wiki gebruikt soms 'X (monster)' voor task-monsters die in conflict
 *  staan met een gelijknamig non-monster (bv. "Dog" = pet item). */
async function findMonsterPage(monster: SlayerMonster): Promise<string | null> {
  const candidates = [
    monster.name,
    `${monster.name} (monster)`,
    monster.name.replace(/\s*\(.*\)$/, ""),
    monster.id.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "),
    `${monster.id.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")} (monster)`
  ];
  for (const title of candidates) {
    const text = await fetchWikitext(title);
    if (text && /\{\{Infobox Monster/i.test(text)) {
      return text;
    }
  }
  return null;
}

/** Mini-parser voor {{Infobox Monster|key1=val1|key2=val2|...}}.
 *  Pakt alleen de keys die we nodig hebben; multi-variant monsters
 *  (level1/level2/...) krijgen `1` als suffix. */
function parseInfobox(wikitext: string): WikiMonsterFields | null {
  // Find the Infobox Monster template block (handles nested {{}})
  const start = wikitext.search(/\{\{Infobox Monster/i);
  if (start === -1) return null;
  let depth = 0;
  let end = start;
  for (let i = start; i < wikitext.length - 1; i++) {
    if (wikitext.slice(i, i + 2) === "{{") { depth++; i++; continue; }
    if (wikitext.slice(i, i + 2) === "}}") { depth--; i++; if (depth === 0) { end = i + 1; break; } }
  }
  const block = wikitext.slice(start, end);

  // Split op | maar respecteer nested {{...}} en [[...]]
  const params: Record<string, string> = {};
  let depth2 = 0;
  let buf = "";
  for (let i = 0; i < block.length; i++) {
    const c = block[i];
    if (c === "{" && block[i + 1] === "{") { depth2++; buf += c; continue; }
    if (c === "}" && block[i + 1] === "}") { depth2--; buf += c; continue; }
    if (c === "[" && block[i + 1] === "[") { depth2++; buf += c; continue; }
    if (c === "]" && block[i + 1] === "]") { depth2--; buf += c; continue; }
    if (c === "|" && depth2 === 1) {
      const eq = buf.indexOf("=");
      if (eq > -1) params[buf.slice(0, eq).trim().toLowerCase()] = buf.slice(eq + 1).trim();
      buf = "";
      continue;
    }
    buf += c;
  }
  // Laatste buf
  const eqLast = buf.indexOf("=");
  if (eqLast > -1) params[buf.slice(0, eqLast).trim().toLowerCase()] = buf.slice(eqLast + 1).trim();

  // Pak variant 1 als er meerdere zijn
  const pickNum = (k: string): number | undefined => {
    const v = params[k] ?? params[`${k}1`];
    if (!v) return undefined;
    const n = parseInt(v.replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    hp: pickNum("hitpoints"),
    slayerlvl: pickNum("slaylvl"),
    combat: pickNum("combat"),
    weakness: (params["weakness"] ?? params["weakness1"])?.toLowerCase(),
    attackStyle: (params["attack style"] ?? params["attack style1"])?.toLowerCase()
  };
}

function compareField<K extends keyof WikiMonsterFields>(
  monster: SlayerMonster,
  field: K,
  ourValue: unknown,
  wikiValue: unknown
): Mismatch | null {
  if (wikiValue == null) return null; // wiki geen data → skip
  if (ourValue == null) return null;  // wij geen data → skip
  if (typeof ourValue === "number" && typeof wikiValue === "number") {
    if (ourValue === wikiValue) return null;
    return { monsterId: monster.id, field, ourValue, wikiValue };
  }
  return null;
}

async function verifyOne(monster: SlayerMonster): Promise<Mismatch[]> {
  const text = await findMonsterPage(monster);
  if (!text) {
    console.log(`  ⚠ ${monster.id.padEnd(28)} wiki page not found`);
    return [];
  }
  const wiki = parseInfobox(text);
  if (!wiki) {
    console.log(`  ⚠ ${monster.id.padEnd(28)} infobox unparseable`);
    return [];
  }
  const mismatches: Mismatch[] = [];
  const hp = compareField(monster, "hp", monster.hp, wiki.hp);
  if (hp) mismatches.push(hp);
  const slay = compareField(monster, "slayerlvl", monster.slayerLevel, wiki.slayerlvl);
  if (slay) mismatches.push(slay);
  const combat = compareField(monster, "combat", monster.combatLevel, wiki.combat);
  if (combat) mismatches.push(combat);

  if (mismatches.length === 0) {
    console.log(`  ✓ ${monster.id.padEnd(28)} ok  (wiki: hp=${wiki.hp} slay=${wiki.slayerlvl} cmb=${wiki.combat})`);
  } else {
    for (const m of mismatches) {
      console.log(`  ✗ ${monster.id.padEnd(28)} ${m.field}: ours=${m.ourValue} wiki=${m.wikiValue}`);
    }
  }
  return mismatches;
}

async function main() {
  const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
  const targets = only
    ? MONSTERS.filter((m) => m.id === only)
    : MONSTERS;
  if (targets.length === 0) {
    console.error(`No monster matched --only=${only}`);
    process.exit(1);
  }
  console.log(`Verifying ${targets.length} monster(s) against OSRS Wiki...\n`);
  const allMismatches: Mismatch[] = [];
  // Sequentieel — wiki rate-limit; 1 request per 200ms is safe.
  for (const monster of targets) {
    const mismatches = await verifyOne(monster);
    allMismatches.push(...mismatches);
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log(`\n${allMismatches.length} mismatch(es) across ${targets.length} monster(s).`);
  if (allMismatches.length > 0) {
    console.log("\nSummary (group by field):");
    const byField = allMismatches.reduce((acc, m) => {
      (acc[m.field] ??= []).push(m);
      return acc;
    }, {} as Record<string, Mismatch[]>);
    for (const [field, list] of Object.entries(byField)) {
      console.log(`  ${field}: ${list.length} mismatch(es)`);
    }
  }
  process.exit(allMismatches.length > 0 ? 1 : 0);
}

main();
