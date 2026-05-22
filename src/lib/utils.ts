import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatQty(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  // OSRS convention: K once >=100K, M once >=10M, integer truncated.
  if (n >= 10_000_000) return `${Math.floor(n / 1_000_000)}M`;
  if (n >= 100_000) return `${Math.floor(n / 1_000)}K`;
  return String(n);
}

// OSRS quantity color tiers:
//   yellow  → 1 to 99,999
//   white   → 100,000 to 9,999,999
//   green   → 10,000,000+
export function qtyColor(n: number): string {
  if (n >= 10_000_000) return "var(--color-osrs-qty-green)";
  if (n >= 100_000) return "var(--color-osrs-qty-white)";
  return "var(--color-osrs-qty-yellow)";
}

export function formatGp(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString();
}

export const ICON_URL = (id: number) =>
  `https://chisel.weirdgloop.org/static/img/osrs-sprite/${Math.abs(id)}.png`;

// OSRS NPC sprite (chathead / monster portrait). Uses the wiki's Special:FilePath
// shortcut which 302-redirects to the actual upload URL — stable across
// wiki re-uploads. Pass the boss's display name; we URL-encode + normalise.
export const NPC_SPRITE_URL = (name: string) =>
  `https://oldschool.runescape.wiki/w/Special:FilePath/${encodeURIComponent(name.replace(/ /g, "_"))}.png`;

// OSRS Coins (id 995) has 7 stack-size variant sprites baked into the
// item db. The bank UI swaps between them based on quantity.
// Variant IDs: 995 (1), 996 (2), 997 (3), 998 (4), 999 (5), 1000 (25),
// 1001 (100), 1002 (250), 1003 (1k), 1004 (10k).
export function spriteIdForItem(id: number, quantity: number): number {
  if (id !== 995 || quantity <= 1) return id;
  if (quantity >= 10000) return 1004;
  if (quantity >= 1000) return 1003;
  if (quantity >= 250) return 1002;
  if (quantity >= 100) return 1001;
  if (quantity >= 25) return 1000;
  if (quantity >= 5) return 999;
  if (quantity >= 4) return 998;
  if (quantity >= 3) return 997;
  if (quantity >= 2) return 996;
  return id;
}

export const SAMPLE_BANKTAGS = "banktags,1,mybank,4151,4151,1213,1215,1305,11802,11804,11806,11808,1333,1163,1079,1127,1201,11840,995,385,7946,3144,379,3024,2434,2440,2436,2442,12625,12695,560,565,555,556,557,558,561,562,563,564,9075,8013,8007,8008,1515,1517,1519,1521,3439,453,1761,1759,1739,1734,1738,1942,5318,15263,952,1265,1351,946,12791,11941";
