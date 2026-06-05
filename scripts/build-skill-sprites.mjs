#!/usr/bin/env node
// Pull the 24 OSRS skill icons from the wiki to public/sprites/skills/.
//
// Why bother: the Lucide skill-stand-in icons (TrendingUp, Hammer, …) read as
// generic SaaS. Real wiki sprites read as OSRS instantly. We download them
// once at build time so we don't hit the wiki on every page load.
//
// Run: node scripts/build-skill-sprites.mjs
//
// Idempotent: skipped files that already exist + match the wiki's
// Content-Length (any byte-level change re-downloads). The script is also
// kind to the wiki — 500ms between requests, single connection, identifying
// User-Agent.

import { mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "sprites", "skills");

const SKILLS = [
  "Attack", "Defence", "Strength", "Hitpoints", "Ranged",
  "Prayer", "Magic", "Cooking", "Woodcutting", "Fletching",
  "Fishing", "Firemaking", "Crafting", "Smithing", "Mining",
  "Herblore", "Agility", "Thieving", "Slayer", "Farming",
  "Runecraft", "Hunter", "Construction", "Sailing"
];

// ASCII-only — em-dashes break the HTTP header byte-string check.
const UA = "scapestack-skill-sprite-builder/1.0 (+https://www.scapestack.org - laurensbs@hotmail.com)";

async function fileExistsAndMatches(path, contentLength) {
  try {
    const s = await stat(path);
    if (contentLength && s.size === Number(contentLength)) return true;
    return false;
  } catch {
    return false;
  }
}

async function downloadOne(skill) {
  const slug = skill.toLowerCase();
  const url = `https://oldschool.runescape.wiki/images/${encodeURIComponent(skill)}_icon.png`;
  const dest = join(OUT_DIR, `${slug}.png`);

  // HEAD first so we can skip a download whose bytes we already have.
  const head = await fetch(url, { method: "HEAD", headers: { "user-agent": UA } });
  if (!head.ok) {
    console.error(`  ✗ ${skill}: HEAD failed (${head.status})`);
    return false;
  }
  const length = head.headers.get("content-length");
  if (await fileExistsAndMatches(dest, length)) {
    console.log(`  · ${skill}: already up-to-date`);
    return true;
  }

  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) {
    console.error(`  ✗ ${skill}: GET failed (${res.status})`);
    return false;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  console.log(`  ✓ ${skill}: ${buf.length} bytes`);
  return true;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Pulling ${SKILLS.length} skill icons to public/sprites/skills/`);
  let ok = 0;
  let failed = 0;
  for (const skill of SKILLS) {
    try {
      if (await downloadOne(skill)) ok++; else failed++;
    } catch (err) {
      console.error(`  ✗ ${skill}:`, err.message);
      failed++;
    }
    // Be kind to the wiki — 500ms between requests, single connection.
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log(`\nDone. ${ok} ok, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main();
