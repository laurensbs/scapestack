#!/usr/bin/env node
/**
 * Four things that must never be in the source again.
 *
 * Separate from scripts/rebrand-lint.mjs on purpose. That one enforces
 * REBRAND.md Section 3's visual forbidden list — radii, shadows, greys,
 * glassmorphism — and it is a design gate. This one is narrower and blunter:
 * four specific artefacts that each mark a decision the product already
 * reversed, and that each came back at least once.
 *
 *   shadcn        the component library this design deliberately is not
 *   Inter         the face every product reaches for
 *   stat counters "59 bosses checked · 183 quests tracked" — REBRAND F6
 *   Setup / Boss  nav labels replaced by Kit / Bestiary — REBRAND 4.3
 *
 * Exits non-zero on any hit, and prints file:line for each.
 *
 * Run: node scripts/lint-forbidden.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["src/app", "src/components", "src/lib"];

/**
 * Where global navigation labels actually live.
 *
 * REBRAND 4.3 renames NAV ITEMS. A <th scope="col">Boss</th> is a table
 * column of boss names and is the correct word for it; the first version of
 * this rule fired on six of those and zero real nav labels, which is a lint
 * that trains you to ignore it.
 */
const NAV_SURFACES = /src\/(lib\/tools\.ts|components\/(header|mobile-action-bar)\.tsx)$/;
const EXTENSIONS = /\.(tsx?|jsx?|css)$/;

/**
 * A line carrying this marker is exempt.
 *
 * Deliberately verbose. An exemption should cost a sentence explaining
 * itself, or the list rots into decoration — which is how the forbidden nav
 * labels survived a rebrand the first time.
 */
const ALLOW = "lint-forbidden-allow";

const RULES = [
  {
    id: "shadcn",
    label: "shadcn reference",
    test: (line) => /shadcn/i.test(line),
    why: "This design is not a shadcn dashboard. An import, a class name or a copied comment all drag the defaults back in."
  },
  {
    id: "inter",
    label: "the Inter typeface",
    // Word-bounded: "interface", "internal", "interval" and "interactive" are
    // ordinary words and matched a naive /Inter/ on 200+ lines. A lint that
    // cries wolf on its first run is a lint nobody runs twice.
    test: (line) => /\bInter\b/.test(line) && !/\bInterface\b/i.test(line),
    // The forbidden LIST has to be allowed to name what it forbids. Without
    // this, design-tokens.ts's FORBIDDEN_FONTS array and globals.css's own
    // comment are permanent failures — the rule eating its own documentation.
    skipComments: true,
    why: "REBRAND.md Section 2: Cinzel, Fraunces and Pixelify Sans. Inter is the face every product reaches for."
  },
  {
    id: "stat-counter",
    label: "raw stat-counter row",
    test: (line) =>
      /\d+\s*(bosses\s+checked|quests\s+tracked|items\s+priced)/i.test(line)
      || /\b(bosses\s+checked|quests\s+tracked|items\s+priced)\b/i.test(line),
    why: "REBRAND.md F6: big numbers presented as impressive metrics are the clearest 'this is a SaaS product' signal a page can carry."
  },
  {
    id: "nav-label",
    label: "forbidden nav label",
    // Two shapes, both genuinely nav. `navLabel:` is the tool registry's own
    // key and is unambiguous anywhere. Bare JSX text is only a nav label
    // inside a nav surface — everywhere else "Boss" is a table column and
    // "Setup" is a section of prose.
    test: (line, file) =>
      /\bnavLabel\s*[:=]\s*["'`](?:Setup|Boss)["'`]/.test(line)
      || (NAV_SURFACES.test(file) && />\s*(?:Setup|Boss)\s*</.test(line)),
    why: "REBRAND.md 4.3: Setup became Kit, Boss became Bestiary. 'Setup' is a configuration screen; 'Kit' is what a player calls their gear."
  }
];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.test(full)) out.push(full);
  }
  return out;
}

const failures = [];
let scanned = 0;

for (const root of ROOTS) {
  for (const file of walk(root)) {
    scanned += 1;
    const lines = readFileSync(file, "utf8").split("\n");
    // Block-aware, because a CSS comment runs over many lines and its
    // continuations start with an ordinary word. A line-shape check called
    // globals.css's own "Forbidden here and everywhere: Inter, Roboto…" a
    // violation — the rule eating its own documentation.
    let inBlock = false;
    lines.forEach((line, index) => {
      if (line.includes(ALLOW)) return;
      const trimmed = line.trim();
      const opens = line.includes("/*") && !line.includes("*/");
      const isComment = inBlock || opens || trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*");
      if (opens) inBlock = true;
      if (inBlock && line.includes("*/")) inBlock = false;
      for (const rule of RULES) {
        if (rule.skipComments && isComment) continue;
        if (rule.test(line, file)) {
          failures.push({
            rule,
            where: `${relative(process.cwd(), file)}:${index + 1}`,
            line: line.trim().slice(0, 130)
          });
        }
      }
    });
  }
}

if (failures.length === 0) {
  console.log(`lint-forbidden: ${scanned} files, none of the four artefacts found.`);
  process.exit(0);
}

const byRule = new Map();
for (const failure of failures) {
  if (!byRule.has(failure.rule.id)) byRule.set(failure.rule.id, { rule: failure.rule, hits: [] });
  byRule.get(failure.rule.id).hits.push(failure);
}

console.error(`lint-forbidden: ${failures.length} hit(s) across ${scanned} files.\n`);
for (const { rule, hits } of byRule.values()) {
  console.error(`── ${rule.id} — ${rule.label} (${hits.length})`);
  console.error(`   ${rule.why}\n`);
  for (const hit of hits) console.error(`   ${hit.where}\n     ${hit.line}`);
  console.error("");
}
process.exit(1);
