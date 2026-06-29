// Single source of truth for the tools listed in the sidebar and on the
// landing page. Add a tool here and it shows up everywhere.

import type { LucideIcon } from "lucide-react";
import { Layers, Trophy, Sword, Target, Sparkles, Skull, PlugZap } from "lucide-react";

export type ToolStatus = "live" | "soon" | "planned";
export const PRIMARY_NAV_SLUGS = ["next", "bank", "dps"] as const;

export interface Tool {
  slug: string;
  href: string;
  name: string;
  navLabel?: string;    // compact label for the global desktop nav
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
  accent: "amber" | "sky" | "violet" | "rose"; // for landing cards
}

export const TOOLS: Tool[] = [
  {
    slug: "next",
    href: "/next",
    name: "What should I do now?",
    navLabel: "Plan",
    short: "Enter your OSRS name and get one clear next move",
    tagline: "One clear plan",
    description:
      "Stop bankstanding: enter your OSRS name and get one useful move for this account, plus two backups. Add bank or RuneLite only when it changes the route.",
    icon: Sparkles,
    iconItemId: 11865, // Slayer helmet (i) — "what to do next" / next-task icon
    status: "live",
    accent: "amber"
  },
  {
    slug: "bank",
    href: "/bank",
    name: "Can I leave?",
    navLabel: "Setup",
    short: "Add bank once, use it everywhere",
    tagline: "Bank in → leave the bank",
    description:
      "Paste Bank Memory or Bank Tags when gear, supplies or GP should change the route. Scapestack still gives one useful next move first, then keeps the clean tabs and copy-back tools below.",
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
    navLabel: "Hiscores",
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
    name: "What unlock next?",
    navLabel: "Unlocks",
    short: "Find the closest useful unlock",
    tagline: "Quests, diaries, capes, useful grinds",
    description:
      "Find nearby quests, diaries, capes, Barrows gloves, skilling outfits and account milestones that create better future sessions.",
    icon: Target,
    iconItemId: 9813,  // Quest point cape — generic completion goal
    status: "live",
    accent: "amber"
  },
  // Quest / Skill / Diary planners removed as separate tools per STRATEGY.md:
  // their functionality lives inside /next as rec-types (quest, skill,
  // diary). The /quests, /skills, /diary routes are 308 redirects to /next
  // so we don't break cached external links or Google results.
  {
    slug: "dps",
    href: "/dps",
    name: "Can I kill this?",
    navLabel: "Check kill",
    short: "Can this bank handle the trip?",
    tagline: "Add bank → one boss verdict",
    description:
      "Picks a boss, setup, first trip, stop point and upgrade check from gear you already own. Numbers are still there, but the first answer is whether the trip makes sense.",
    icon: Sword,
    iconItemId: 4151,  // Abyssal whip — combat / damage signature
    status: "live",
    accent: "amber"
  },
  {
    slug: "slayer",
    href: "/slayer",
    name: "Task Check",
    navLabel: "Task",
    short: "Kill, skip, extend, burst or cannon",
    tagline: "Task → route, supplies, stop point",
    description:
      "Use Slayer level, combat, blocks and RuneLite task state to decide whether this task is worth killing, skipping, extending, bursting or cannoning.",
    icon: Skull,
    iconItemId: 11864,  // Slayer helmet — signature item
    status: "live",
    accent: "rose"
  },
  {
    slug: "plugin",
    href: "/plugin",
    name: "RuneLite helper",
    navLabel: "RuneLite",
    short: "Check RuneLite for finished progress",
    tagline: "Skip finished quests, diaries, clog and Slayer",
    description:
      "Use Scapestack Sync when you want /next to stop suggesting quests, diary steps, clog slots and Slayer calls you already handled.",
    icon: PlugZap,
    iconItemId: 11865,
    status: "live",
    accent: "amber"
  }
];

export function getTool(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export function getPrimaryNavTools(): Tool[] {
  return PRIMARY_NAV_SLUGS
    .map((slug) => getTool(slug))
    .filter((tool): tool is Tool => Boolean(tool));
}
