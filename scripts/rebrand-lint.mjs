#!/usr/bin/env node
/**
 * REBRAND.md Section 3 — the forbidden list, enforced.
 *
 * Each rule below marks a design that reads as machine-made SaaS. The file
 * that specifies them is explicit that landing any one is build-blocking, not
 * advisory, so this exits non-zero.
 *
 * The reason it is a script and not a code review: the failure mode being
 * guarded against is drift back to the statistical average, and drift is
 * exactly what a human reviewer stops noticing. A regex does not get used to
 * anything.
 *
 * Run: node scripts/rebrand-lint.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["src/app", "src/components"];
const EXTENSIONS = /\.(tsx?|jsx?|css)$/;

/**
 * Lines carrying this marker are exempt.
 *
 * Deliberately spelled out rather than a bare "eslint-disable"-style token: an
 * exemption has to cost a sentence explaining itself, or the list decays into
 * decoration. Every use must name which rule and why.
 */
const ALLOW = "rebrand-lint-allow";

const RULES = [
  {
    id: "F2",
    label: "forbidden font family",
    pattern: /font-family[^;]*(Inter|Roboto|Open Sans|Lato|Space Grotesk|Geist|Montserrat|Poppins|system-ui|-apple-system)/i,
    why: "REBRAND.md Section 2: these are the faces every product reaches for. Cinzel / Fraunces / Pixelify Sans only."
  },
  {
    id: "F1",
    label: "Tailwind gradient or colour outside the palette",
    pattern: /\b(from|via|to)-(purple|indigo|violet|blue|fuchsia|pink|cyan|teal|emerald)-\d/,
    why: "REBRAND.md Section 1: no colour outside the stone/parchment/gold/msg palette."
  },
  {
    id: "F1b",
    label: "Tailwind default grey",
    pattern: /\b(bg|text|border)-(slate|zinc|gray|neutral|stone)-\d/,
    why: "REBRAND.md Section 1: greys come from the stone ramp, not Tailwind's."
  },
  {
    id: "F8",
    label: "panel radius above 4px",
    // Scoped exactly as REBRAND.md Section 3's lint spec writes it:
    // "rounded-(xl|2xl|3xl|full) on elements with class ~ /panel|card/".
    // A 6px dot is round because it is a dot; a panel with a 24px radius is a
    // shadcn card wearing a costume. The screenshot pass in Section 7 catches
    // the rest, which is what it is for.
    pattern: /class[nN]ame=[^>]*(panel|card)[^>]*rounded-(xl|2xl|3xl|full)|rounded-(xl|2xl|3xl|full)[^>]*(panel|card)/,
    why: "REBRAND.md Section 1: OSRS interface chrome is squared. --radius-md (3px) is the ceiling."
  },
  {
    id: "F8b",
    label: "pill button",
    // REBRAND.md Section 5, global button spec: "No pill buttons."
    pattern: /<button[^>]*rounded-full|rounded-full[^>]*(btn-|scapestack-command-button)/,
    why: "REBRAND.md Section 5: buttons are squared with a gold bevel, never pills."
  },
  {
    id: "F11",
    label: "blurred drop shadow",
    pattern: /\bshadow-(lg|xl|2xl)\b/,
    why: "REBRAND.md F11: depth is a hard bevel — light top-left, dark bottom-right — never a blur."
  },
  {
    id: "F7",
    label: "coloured left-border strip",
    pattern: /\bborder-l-4\b|\bborder-l-\[/,
    why: "REBRAND.md F7: the single most reliable AI tell."
  }
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
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
    lines.forEach((line, index) => {
      if (line.includes(ALLOW)) return;
      // Prose describing a rule is not a use of it. This file's own tokens
      // block names "rounded-2xl" in a comment explaining why it is banned.
      const stripped = line.trim();
      if (stripped.startsWith("*") || stripped.startsWith("//") || stripped.startsWith("/*") || stripped.startsWith("-")) return;
      for (const rule of RULES) {
        if (rule.pattern.test(line)) {
          failures.push({
            rule,
            where: `${relative(process.cwd(), file)}:${index + 1}`,
            line: line.trim().slice(0, 120)
          });
        }
      }
    });
  }
}

if (failures.length === 0) {
  console.log(`rebrand-lint: ${scanned} files, no forbidden patterns.`);
  process.exit(0);
}

const byRule = new Map();
for (const failure of failures) {
  if (!byRule.has(failure.rule.id)) byRule.set(failure.rule.id, { rule: failure.rule, hits: [] });
  byRule.get(failure.rule.id).hits.push(failure);
}

console.error(`rebrand-lint: ${failures.length} forbidden pattern(s) across ${scanned} files.\n`);
for (const { rule, hits } of byRule.values()) {
  console.error(`── ${rule.id} ${rule.label} — ${hits.length}`);
  console.error(`   ${rule.why}`);
  for (const hit of hits.slice(0, 12)) console.error(`   ${hit.where}  ${hit.line}`);
  if (hits.length > 12) console.error(`   … and ${hits.length - 12} more`);
  console.error("");
}
process.exit(1);
