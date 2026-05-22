// Single source of truth for the tools listed in the sidebar and on the
// landing page. Add a tool here and it shows up everywhere.

import type { LucideIcon } from "lucide-react";
import { Layers, Coins, LineChart, Trophy, Compass, Sword, Scroll, Hammer, Target } from "lucide-react";

export type ToolStatus = "live" | "soon" | "planned";

export interface Tool {
  slug: string;
  href: string;
  name: string;
  short: string;        // 1-line for sidebar tooltip
  tagline: string;      // 1-sentence card subtitle
  description: string;  // longer for landing card
  icon: LucideIcon;
  status: ToolStatus;
  accent: "amber" | "emerald" | "sky" | "violet" | "rose"; // for landing cards
}

export const TOOLS: Tool[] = [
  {
    slug: "bank",
    href: "/bank",
    name: "Bank Organizer",
    short: "Auto-organize your bank into tidy tabs",
    tagline: "Paste your bank → get clean tabs back",
    description:
      "Paste a Bank Memory or Bank Tags export and the organizer splits everything into Combat, Range, Magic, Food, Potions, Runes, Skilling, Jewellery, Trophy and more — with quantities, GP value, drag-and-drop, and copy-back-to-RuneLite strings.",
    icon: Layers,
    status: "live",
    accent: "amber"
  },
  {
    slug: "gp",
    href: "/gp",
    name: "GP Tracker",
    short: "See what your bank is actually worth",
    tagline: "Wealth snapshot from your Bank Memory export",
    description:
      "Paste your bank, see total GP, top 20 items by value, biggest movers this week, and where your wealth is locked up. Built on the OSRS Wiki live price feed.",
    icon: Coins,
    status: "soon",
    accent: "emerald"
  },
  {
    slug: "ge",
    href: "/ge",
    name: "GE Price Tracker",
    short: "Live Grand Exchange prices & flip finder",
    tagline: "Live prices, charts, flip margins",
    description:
      "Search any tradeable, see live high/low, daily volume, charts, and a margin calculator. Save a watchlist of items you flip regularly.",
    icon: LineChart,
    status: "soon",
    accent: "sky"
  },
  {
    slug: "hiscore",
    href: "/hiscore",
    name: "Hiscore Lookup",
    short: "Look up a player's stats",
    tagline: "Stats, ranks, all skills at a glance",
    description:
      "Enter a username, get a polished card with all 24 skills, combat level, XP, total level, and ranks. Live data from the official OSRS Hiscores.",
    icon: Trophy,
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
    status: "live",
    accent: "emerald"
  },
  {
    slug: "quests",
    href: "/quests",
    name: "Quest Planner",
    short: "Plan an efficient quest order",
    tagline: "Optimal order based on requirements",
    description:
      "Tells you which quests you can do now, what's blocking the rest, and a suggested order to reach Quest Cape with the least backtracking.",
    icon: Scroll,
    status: "planned",
    accent: "rose"
  },
  {
    slug: "dps",
    href: "/dps",
    name: "DPS Calculator",
    short: "Best setup per boss from your bank",
    tagline: "Paste your bank → optimal DPS for every boss",
    description:
      "We auto-pick the best weapon and armour from your bank for each of 10 bosses, then show max hit, accuracy, DPS, time-to-kill, GP/hr and the top upgrades that would speed you up.",
    icon: Sword,
    status: "live",
    accent: "amber"
  },
  {
    slug: "skills",
    href: "/skills",
    name: "Skill Planner",
    short: "How long to your next goal?",
    tagline: "XP curves + GP/hr method picker",
    description:
      "Pick a skill, set a target level, see the methods that get you there with their XP/hr, GP/hr (or cost/hr), and total time at each.",
    icon: Hammer,
    status: "planned",
    accent: "emerald"
  },
  {
    slug: "diary",
    href: "/diary",
    name: "Diary Tracker",
    short: "What achievement diaries to chase next",
    tagline: "Pick the diaries you're closest to finishing",
    description:
      "See which Achievement Diaries you have completed, which are 1-2 tasks away, and which give the most bang for the buck (Karamja gloves 3, etc.).",
    icon: Compass,
    status: "planned",
    accent: "sky"
  }
];

export function getTool(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}
