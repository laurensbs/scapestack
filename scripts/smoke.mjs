// Direct smoke test of organize() with realistic Bank Memory TSV input.
// Run: node scripts/smoke.mjs
//
// Tests:
// 1. TSV parsing → items loaded
// 2. Item names resolved from data/items.json (no "Item NNN" placeholders)
// 3. Classification distributes into expected tabs
// 4. Prices fetched and applied to values
// 5. Export roundtrip produces valid Bank Tags strings

import { organize, exportTabs } from "../src/lib/organizer.ts";

const SAMPLE_TSV = `Item id\tItem name\tItem quantity
4151\tAbyssal whip\t1
11802\tArmadyl godsword\t1
11840\tDragon boots\t1
1163\tRune full helm\t1
1127\tRune platebody\t1
1079\tRune platelegs\t1
1333\tRune scimitar\t1
11808\tBandos chestplate\t1
11804\tBandos tassets\t1
11806\tBandos boots\t1
12791\tRune pouch\t1
12926\tBlowpipe\t1
12625\tArmadyl chestplate\t1
12695\tArmadyl chainskirt\t1
4675\tAncient staff\t1
3024\tSuper restore(4)\t12
2434\tPrayer potion(4)\t15
385\tShark\t250
7946\tMonkfish\t100
995\tCoins\t12345678
560\tDeath rune\t5000
565\tBlood rune\t3000
555\tWater rune\t10000
556\tAir rune\t10000
557\tEarth rune\t10000
558\tFire rune\t10000
561\tNature rune\t2500
562\tChaos rune\t4500
563\tLaw rune\t1500
564\tCosmic rune\t800
441\tIron ore\t10000
453\tCoal\t25000
1515\tYew logs\t5000
1513\tMagic logs\t1200
8013\tVarrock teleport\t50
8007\tCamelot teleport\t50
2552\tRing of dueling(8)\t10
3853\tGames necklace(8)\t10
6585\tAmulet of fury\t1
20997\tTwisted bow\t1
22325\tScythe of vitur\t1
13652\tDragon claws\t1
22301\tVorkath's head\t1
11865\tSlayer helmet (i)\t1
6570\tFire cape\t1
21295\tInfernal cape\t1
10551\tFighter torso\t1
12183\tImbued saradomin cape\t1
20724\tArclight\t1
22324\tGhrazi rapier\t1`;

const log = (...a) => console.log(...a);
let failed = 0;
function expect(cond, msg) {
  if (cond) log(`  ✓ ${msg}`);
  else { failed++; log(`  ✗ ${msg}`); }
}

log("\n# Smoke test — organize() with realistic TSV\n");

const t0 = Date.now();
const res = await organize({ input: SAMPLE_TSV, includePrices: true, junkFilter: false });
log(`organize() returned in ${Date.now() - t0}ms\n`);

log("## 1. Source detection");
expect(res.source.kind === "bankMemory", `source.kind = "bankMemory" (got "${res.source.kind}")`);
expect(res.stats.hasQuantities, "stats.hasQuantities = true");
expect(res.stats.items >= 40, `>= 40 items parsed (got ${res.stats.items})`);

log("\n## 2. Names resolved (no 'Item NNN' fallbacks)");
const placeholderItems = [];
for (const tab of res.tabs) {
  for (const item of tab.items) {
    if (/^Item \d+$/.test(item.name)) placeholderItems.push(item.id);
  }
}
expect(placeholderItems.length === 0, `0 placeholder names (got ${placeholderItems.length}: ${placeholderItems.slice(0, 5).join(", ")})`);

log("\n## 3. Tabs distribution");
const tabNames = res.tabs.map((t) => t.name);
log(`  Found tabs: ${tabNames.join(", ")}`);
expect(tabNames.includes("Combat"), "has Combat tab");
expect(tabNames.includes("Food"), "has Food tab");
expect(tabNames.includes("Potions"), "has Potions tab");
expect(tabNames.includes("Runes"), "has Runes tab");
expect(tabNames.includes("Skilling"), "has Skilling tab");
expect(res.stats.unclassified < res.stats.items / 2, `<50% items in Misc (got ${res.stats.unclassified}/${res.stats.items})`);

log("\n## 4. Prices");
log(`  hasPrices: ${res.stats.hasPrices}, totalValue: ${res.stats.totalValue.toLocaleString()} gp`);
expect(res.stats.hasPrices, "stats.hasPrices = true (fetched from wiki)");
expect(res.stats.totalValue > 1_000_000, `totalValue > 1m gp (got ${res.stats.totalValue.toLocaleString()})`);

// Twisted bow should have a serious price
const tbow = res.tabs.flatMap((t) => t.items).find((i) => i.id === 20997);
log(`  Twisted bow unitPrice: ${tbow?.unitPrice?.toLocaleString()} gp`);
expect(tbow && tbow.unitPrice > 500_000_000, `Twisted bow priced > 500m (got ${tbow?.unitPrice?.toLocaleString()})`);

// Coins should be priced 1
const coins = res.tabs.flatMap((t) => t.items).find((i) => i.id === 995);
log(`  Coins (995) classified to: ${coins?.subtab} in ${res.tabs.find((t) => t.items.some((i) => i.id === 995))?.name}`);

log("\n## 5. Export roundtrip");
const strings = exportTabs(res.tabs);
expect(strings.length === res.tabs.length, `one string per tab (${strings.length} === ${res.tabs.length})`);
for (let i = 0; i < strings.length; i++) {
  const s = strings[i];
  expect(s.startsWith("banktags,1,"), `tab ${i} starts with banktags,1,`);
  expect(!s.includes("[object Object]"), `tab ${i} no [object Object]`);
  expect(!s.includes("undefined"), `tab ${i} no "undefined"`);
}

log("\n## 6. Sample tab content (Combat)");
const combat = res.tabs.find((t) => t.name === "Combat");
if (combat) {
  log(`  Combat: ${combat.items.length} items, ${combat.value.toLocaleString()} gp`);
  for (const it of combat.items.slice(0, 8)) {
    log(`    ${String(it.id).padStart(6)} ${it.name.padEnd(28)} subtab=${it.subtab.padEnd(12)} slot=${(it.slot || "-").padEnd(7)} qty=${it.quantity} price=${it.unitPrice.toLocaleString()}`);
  }
}

log("\n## 7. Junk filter behavior");
const resJunk = await organize({ input: SAMPLE_TSV, includePrices: true, junkFilter: true });
log(`  Without junk filter: ${res.stats.unclassified} in Misc`);
log(`  With junk filter:    ${resJunk.stats.unclassified} in Misc`);

log(`\n${failed ? "❌ " + failed + " checks failed" : "✅ All checks passed"}\n`);
process.exit(failed > 0 ? 1 : 0);
