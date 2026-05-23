// Single source of truth for the tools listed in the sidebar and on the
// landing page. Add a tool here and it shows up everywhere.

import type { LucideIcon } from "lucide-react";
import { Layers, Trophy, Compass, Sword, Scroll, Hammer, Target, Sparkles } from "lucide-react";

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
    slug: "next",
    href: "/next",
    name: "What to do now",
    short: "Stuck? Get a ranked list of what's worth doing next",
    tagline: "Paste your bank, look up your stats → a clear plan",
    description:
      "No idea what to do next? Paste your bank and look up your account — the hub combines your Hiscores, your bank and 30+ goal sets into one ranked list: the goal you're closest to, bosses your combat level now supports, skills a few levels off a milestone, and more. Every suggestion links straight into the tool you'd use to act on it.",
    icon: Sparkles,
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
    status: "live",
    accent: "amber"
  },
  // GP Tracker and GE Price Tracker removed per docs/STRATEGY.md.
  // OSRS Wiki Prices + ge-tracker.com do this better — no moat for us.
  // The /gp and /ge routes still exist (ComingSoon stubs) to avoid 404s
  // from cached external links, but they're no longer surfaced on the
  // homepage tool grid.
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
