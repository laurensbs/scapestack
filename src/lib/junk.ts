// "What can I drop?" — flags items that are almost certainly safe to discard.
//
// Rules:
//   1. unitPrice < 25 gp (not worth a banking trip)
//   2. quantity === 1 (only solo straggler — stacks of cheap items are often
//      bulk skilling supplies a player accumulated on purpose)
//   3. no equip slot (not gear)
//   4. high alch <= 0 (would otherwise be alch fodder)
//   5. not in a tab that flags semantic value (Quest, Trophy, Untradeables, Clues)
//
// These rules are conservative on purpose — a false positive (junk-flag on a
// keepable item) is worse than a false negative.

import type { OrganizedItem } from "./organizer";
import { isKeeper } from "./keeper-items";

// Items we NEVER flag even if cheap. These are tools, carriers, and utilities
// that every account uses regularly — dropping them costs a trip back to a
// shop or quest NPC, which is way worse than the +1 bank slot you'd reclaim.
const NEVER_JUNK_PATTERNS = [
  // Degraded / charged combat gear — Karil's, Ahrim's, Dharok's, Guthan's,
  // Torag's, Verac's, Masori, Bow of Faerdhinen, Ava's, Crystal armour,
  // Tox blowpipe (empty), Sang/Trident (uncharged), etc. These show 0 gp on
  // the GE feed because only the charged form trades — but they're absolutely
  // not junk; recharging them is cheap.
  /\b(karil's|ahrim's|dharok's|guthan's|torag's|verac's)\b/i,
  /\bmasori\b/i,
  /\bava's (assembler|accumulator|attractor|device)\b/i,
  /bow of faerdhinen/i,
  /crystal (helm|body|legs|bow|halberd|shield)/i,
  /(toxic|trident|sanguinesti|scythe|harmonised|holy scythe|sanguine scythe).*(\(uncharged\)|\(empty\))/i,
  /\b(blowpipe|trident|scythe)\b.*\(uncharged\)/i,
  /(broken|degraded|0\)|\(or\)|\(g\)|\(t\))$/i,
  /tumeken's shadow \(uncharged\)/i,
  /serpentine helm \(uncharged\)/i,
  /tanzanite helm/i, /magma helm/i,
  /^(black|red|blue|yellow|white|purple) partyhat$/i, // partyhats price properly
  /elysian (sigil|spirit shield)/i,
  /spectral (sigil|spirit shield)/i,
  /arcane (sigil|spirit shield)/i,
  /divine (sigil|spirit shield)/i,
  /infernal cape|fire cape|max cape/i,
  /quest point cape|achievement diary cape|music cape|champion's cape/i,
  /\b(graceful) (hood|cape|top|legs|gloves|boots)/i,
  /void (mage|ranger|melee) (helm|top|robe|gloves)/i,
  /justiciar (faceguard|chestguard|legguards)/i,
  /inquisitor's (great helm|hauberk|plateskirt|mace)/i,
  /elder maul/i,
  /^(kraken|smouldering stone|abyssal head|frozen key piece|tortured)/i,
  /barrows (gloves|equipment)/i,
  /fighter (torso|hat)|penance/i,
  // Carriers / containers (untradeable, often re-fetching is annoying)
  /looting bag/i,
  /rune pouch|divine rune pouch|moonclan rune pouch/i,
  /(small|medium|large|giant|colossal) pouch/i,
  /coal bag|gem bag|seed box|herb sack|fish barrel|log basket/i,
  /tackle box/i,
  /^essence pouch/i,
  /clue (box|hunter|geezer)/i,
  /^(open|closed) (looting|seed|gem) bag/i,

  // Skilling tools — losing one means a shop run
  /\bspade\b/i,
  /\bbucket\b/i,
  /\bhammer\b/i,
  /\bchisel\b/i,
  /\btinderbox\b/i,
  /\b(rope|saw|secateurs|rake|seed dibber|gardening trowel|watering can)\b/i,
  /knife|axe|pickaxe|fishing|harpoon|net|cage|trap/i,
  /\b(pestle|mortar)\b/i,
  /needle|thread/i,
  /butterfly jar|butterfly net|impling jar|magic butterfly net/i,

  // Vials / consumable containers (cheap but bulk-required for Herblore etc.)
  /(empty )?vial( of water)?/i,
  /\b(jug|jug of water)\b/i,
  /enchanted vial/i,

  // Teleport / utility items players forget exist
  /ring of dueling|games necklace|skills necklace|amulet of glory|combat bracelet|necklace of passage|burning amulet/i,
  /teleport (scroll|tablet|seed|crystal)/i,
  /^(varrock|lumbridge|falador|camelot|ardougne|watchtower|teleport to house)/i,
  /house teleport/i,
  /ectophial/i,
  /digsite pendant/i,
  /xeric's talisman/i,
  /drakan's medallion/i,
  /enchanted lyre/i,
  /amulet of the eye/i,
  /book of the dead|book of arcane knowledge/i,
  /quest cape|max cape|champion's cape|music cape|achievement diary cape/i,
  /(kandarin|ardougne|falador|fremennik|karamja|lumbridge|morytania|varrock|wilderness|western|desert) (headgear|diary|gloves|legs)/i,
  /helm of raedwald/i,
  /\b(dragonstone|onyx|zenyte) (necklace|amulet|ring|bracelet)\b/i,
  /\bjewellery box\b/i,
  /royal seed pod/i,
  // Skilling random events / valuable drops people stash
  /bird nest|^crushed nest|seed nest|egg nest|wyson the gardener/i,
  /^mark of grace$/i,
  /clue nest|^clue (bottle|scroll)/i,
  /^(uncut |cut )(diamond|ruby|emerald|sapphire|dragonstone|onyx|zenyte|opal|jade|topaz|red topaz)$/i,
  /\b(loop|tooth) half of (a |the )?key\b/i,
  /\bcrystal key\b/i,
  /\bbrimstone key\b/i,
  /\bgilded key\b/i,
  /\bdragon (champion|red|blue|yellow|green) helm\b/i,
  /champion scroll/i,
  /unidentified minerals|paydirt|golden nugget/i,
  /master scroll book/i,
  /^(magpie|jubbly|graahk|kyatt|larupia|spotted|spottier|gloves of silence) /i,
  /\bcrystal teleport seed\b/i,
  /enchanted (lyre|key)/i,
  /book of (balance|war|law|darkness|knowledge|spell)/i,
  /^(amulet|necklace) of/i,
  /\bring of (the )?(elements|stone|wealth|charos|3rd|forging|recoil|life)\b/i,
  /\b(slayer|chronicle|skull) (ring|sceptre)\b/i,

  // Quest items that fool the heuristic (cheap, untradeable, no slot)
  /^ghostspeak amulet|^holy symbol|^unholy symbol/i,
  /lockpick/i,
  /\bbook of/i,
  /diary|journal|page|scroll|note$/i,
  /key$|key piece|crystal key|tooth half|loop half/i,

  // Slayer / boss requirements
  /slayer ring|slayer gem|enchanted gem/i,
  /ring of recoil|ring of life|ring of wealth/i,

  // Construction supplies that look like junk but you'll need them
  /^plank$|oak plank|teak plank|mahogany plank/i,
  /^(soft|hard) clay$/i,
  /^limestone( brick)?$/i
];

// Tabs whose contents are inherently meaningful — never junk regardless of
// price. PvM Gear, Cosmetic, Quest, Drops, Clue all get blanket protection
// because the bucketing already routed them as "kept for a reason".
const PROTECTED_TABS = new Set([
  "Quest", "Trophy", "Untradeables", "Clues",
  "PvM Gear", "Drops", "Cosmetic", "Clue", "Teleports"
]);

export function isJunkCandidate(it: OrganizedItem, tabName: string): boolean {
  if (PROTECTED_TABS.has(tabName)) return false;
  if (it.slot) return false;                       // any equip slot wins
  if ((it.highalch ?? 0) > 0) return false;
  if (it.quantity > 1) return false;

  // Untradeable detection — items with no GE price AND no high-alch value
  // resolve to unitPrice === 0. The OSRS Wiki price feed only ships
  // tradeable items, so a missing price is a strong signal that the item
  // is untradeable (quest / boss / diary / random-event). We err heavily
  // on the side of "never flag an unknown" — better one missed junk
  // suggestion than a false positive on a keepable item.
  if (it.unitPrice === 0) return false;

  if (it.unitPrice >= 25) return false;
  // Community-curated keeper list (pets, slayer gear, cannon, crystal, DT2,
  // quest items, recipes, holiday rares, capes, carriers, herbs, secondaries).
  // Centralised in keeper-items.ts so bucket routing can use the same canon.
  if (isKeeper(it)) return false;
  if (NEVER_JUNK_PATTERNS.some((re) => re.test(it.name))) return false;
  return true;
}

export interface JunkSummary {
  count: number;
  totalValue: number;        // gp recovered if alched/sold (it.unitPrice is GE)
}

export function summarizeJunk(tabs: Array<{ name: string; items: OrganizedItem[] }>): JunkSummary {
  let count = 0;
  let totalValue = 0;
  for (const t of tabs) {
    for (const it of t.items) {
      if (isJunkCandidate(it, t.name)) {
        count++;
        totalValue += it.unitPrice;  // unit because qty is always 1 here
      }
    }
  }
  return { count, totalValue };
}

// Returns the actual junk items so the UI can list them in a drop-down. Each
// entry carries the tab name it came from for context.
export interface JunkEntry {
  item: OrganizedItem;
  tab: string;
}
export function listJunkItems(tabs: Array<{ name: string; items: OrganizedItem[] }>): JunkEntry[] {
  const out: JunkEntry[] = [];
  for (const t of tabs) {
    for (const it of t.items) {
      if (isJunkCandidate(it, t.name)) out.push({ item: it, tab: t.name });
    }
  }
  // Cheapest first — those are the safest to drop. Tie-break on name.
  out.sort((a, b) =>
    a.item.unitPrice - b.item.unitPrice ||
    a.item.name.localeCompare(b.item.name)
  );
  return out;
}
