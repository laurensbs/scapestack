// Single source of truth for the tools listed in the sidebar and on the
// landing page. Add a tool here and it shows up everywhere.

import type { LucideIcon } from "lucide-react";
import { Layers, Trophy, Sword, Target, Sparkles, Skull } from "lucide-react";

export type ToolStatus = "live" | "soon" | "planned";

export interface Tool {
  slug: string;
  href: string;
  name: string;
  short: string;        // 1-line for sidebar tooltip
  tagline: string;      // 1-sentence card subtitle
  description: string;  // longer for landing card
  icon: LucideIcon;
  /** OSRS item ID for the in-game sprite shown on the landing card. The
   *  sidebar keeps the Lucide glyph (smaller surface, monochrome reads
   *  better at 14px). Optional — tools without a perfect signature item
   *  fall back to the Lucide icon. */
  iconItemId?: number;
  status: ToolStatus;
  accent: "amber" | "emerald" | "sky" | "violet" | "rose"; // for landing cards
}

export const TOOLS: Tool[] = [
  {
    slug: "next",
    href: "/next",
    name: "What to do now",
    short: "Stuck? Get a ranked list of what's worth doing next",
    tagline: "Paste your bank, look up your stats → a clear plan",
    description:
      "No idea what to do next? Paste your bank and look up your account — the hub combines your Hiscores, your bank and 30+ goal sets into one ranked list: the goal you're closest to, bosses your combat level now supports, skills a few levels off a milestone, and more. Every suggestion links straight into the tool you'd use to act on it.",
    icon: Sparkles,
    iconItemId: 11865, // Slayer helmet (i) — "what to do next" / next-task icon
    status: "live",
    accent: "emerald"
  },
  {
    slug: "bank",
    href: "/bank",
    name: "Bank Organizer",
    short: "Auto-organize your bank into tidy tabs",
    tagline: "Paste your bank → get clean tabs back",
    description:
      "Paste a Bank Memory or Bank Tags export and the organizer splits everything into Combat, Range, Magic, Food, Potions, Runes, Skilling, Jewellery, Trophy and more — with quantities, GP value, drag-and-drop, and copy-back-to-RuneLite strings.",
    icon: Layers,
    iconItemId: 20594, // Bank filler — literal bank icon
    status: "live",
    accent: "amber"
  },
  // GP Tracker and GE Price Tracker removed per docs/STRATEGY.md — Wiki
  // Prices + ge-tracker.com do that better, no moat for us. The /gp and
  // /ge routes are kept as 308 permanent-redirects to /next (in
  // src/app/{gp,ge}/page.tsx) so cached external links don't 404.
  // Hiscore Lookup — no longer rendered on the homepage but still
  // registered here so ToolHeader on /hiscore can read its metadata
  // via getTool(). Surfaced nowhere else (header + sidebar filter
  // bank/dps/goals).
  {
    slug: "hiscore",
    href: "/hiscore",
    name: "Hiscore Lookup",
    short: "Look up a player's stats",
    tagline: "Stats, ranks, all skills at a glance",
    description:
      "Enter a username, get a polished card with all 24 skills, combat level, XP, total level, and ranks. Live data from the official OSRS Hiscores.",
    icon: Trophy,
    iconItemId: 13342,
    status: "live",
    accent: "violet"
  },
  {
    slug: "goals",
    href: "/goals",
    name: "Goal Tracker",
    short: "Tick off your untradeable goals",
    tagline: "Paste your bank → see what you've earned",
    description:
      "Tracks 30+ goal sets across capes, combat prestige, diary rewards, Barrows, GWD, raids, skilling outfits and quest rewards. Surfaces sets you're 1-2 items away from completing.",
    icon: Target,
    iconItemId: 9813,  // Quest point cape — generic completion goal
    status: "live",
    accent: "emerald"
  },
  // Quest / Skill / Diary planners removed as separate tools per STRATEGY.md:
  // their functionality lives inside /next as rec-types (quest, skill,
  // diary). The /quests, /skills, /diary routes are 308 redirects to /next
  // so we don't break cached external links or Google results.
  {
    slug: "dps",
    href: "/dps",
    name: "DPS Calculator",
    short: "Best setup per boss from your bank",
    tagline: "Paste your bank → optimal DPS for every boss",
    description:
      "We auto-pick the best weapon and armour from your bank for each of 10 bosses, then show max hit, accuracy, DPS, time-to-kill, GP/hr and the top upgrades that would speed you up.",
    icon: Sword,
    iconItemId: 4151,  // Abyssal whip — combat / damage signature
    status: "live",
    accent: "amber"
  },
  {
    slug: "slayer",
    href: "/slayer",
    name: "Slayer Planner",
    short: "Pick the right master, see expected XP/hour",
    tagline: "Your stats → best master, task probabilities, block list",
    description:
      "Enter your combat + slayer level (or paste your RSN) and we rank the 7 masters by expected XP/hour. Per master: every possible task, the chance you'll get it, expected XP, and which 5 tasks you should block for max efficiency.",
    icon: Skull,
    iconItemId: 11864,  // Slayer helmet — signature item
    status: "live",
    accent: "rose"
  }
];

export function getTool(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}
