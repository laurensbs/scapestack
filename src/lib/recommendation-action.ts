import type { Recommendation } from "./next-up";
import { wikiSearchUrl } from "./wiki";
import { legacyRouteNextHref } from "./next-intent";

export interface RecommendationActionContext {
  hasBankContext?: boolean;
  from?: "bank" | "next";
  rsn?: string | null;
  accountType?: string | null;
}

export interface RecommendationPrimaryAction {
  label: string;
  href?: string;
  external?: boolean;
  bossSlug?: string;
  helper: string;
}

const ROUTE_ACTIONS: Record<string, Omit<RecommendationPrimaryAction, "href">> = {
  "/bank": {
    label: "Check gear",
    helper: "Clean the bank and export a usable RuneLite Bank Tags layout."
  },
  "/dps": {
    label: "Open kill check",
    helper: "Tune owned gear, boss weakness and kill setup before committing supplies."
  },
  "/goals": {
    label: "Open unlocks",
    helper: "Track missing set pieces, unlocks and long-term account progress."
  },
  "/gp": {
    label: "Open cash route",
    helper: "Use the active plan for GP, tradeable upgrades and funding loops."
  },
  "/skills": {
    label: "Open skill route",
    helper: "Use the active plan for skilling sessions and level pushes."
  },
  "/quests": {
    label: "Open quest route",
    helper: "Use the active plan for quests, diaries and unlock chains."
  },
  "/diary": {
    label: "Open diary route",
    helper: "Use the active plan for diaries and unlock chains."
  },
  "/slayer": {
    label: "Check task",
    helper: "Use the synced task, streak, points and block-list."
  },
  "/plugin": {
    label: "Check RuneLite",
    helper: "Let Scapestack skip finished quests, diary steps, clog slots and Slayer."
  }
};

const CONTEXTABLE_ROUTES = new Set(["/next", "/dps", "/goals", "/slayer", "/plugin", "/bank", "/skills", "/gp", "/quests", "/diary"]);

function isContextableRoute(pathname: string): boolean {
  return CONTEXTABLE_ROUTES.has(pathname) || pathname.startsWith("/quests/");
}

function activeHrefForRoute(href: string): string {
  const url = new URL(href, "https://scapestack.local");
  const normalizedPath = url.pathname.replace(/\/$/, "") || "/";
  if (normalizedPath === "/gp") return legacyRouteNextHref("gp");
  if (normalizedPath === "/skills") return legacyRouteNextHref("skills");
  if (normalizedPath === "/quests") return legacyRouteNextHref("quests");
  if (normalizedPath === "/diary") return legacyRouteNextHref("diary");
  return href;
}

export function recommendationHrefWithContext(
  href: string,
  context: RecommendationActionContext = {}
): string {
  if (!href.startsWith("/")) return href;

  const url = new URL(activeHrefForRoute(href), "https://scapestack.local");
  const normalizedPath = url.pathname.replace(/\/$/, "") || "/";
  if (!isContextableRoute(normalizedPath)) return href;

  const cleanRsn = (context.rsn ?? "").trim();
  if (cleanRsn && !url.searchParams.has("rsn")) url.searchParams.set("rsn", cleanRsn);
  if (context.from && !url.searchParams.has("from")) url.searchParams.set("from", context.from);
  if (context.hasBankContext === false && !url.searchParams.has("bank")) {
    url.searchParams.set("bank", "none");
  }
  const cleanAccountType = (context.accountType ?? "").trim();
  if (cleanAccountType && normalizedPath === "/dps" && !url.searchParams.has("accountType")) {
    url.searchParams.set("accountType", cleanAccountType);
  }
  if (normalizedPath === "/plugin" && !url.hash) url.hash = "verify-sync";

  return `${url.pathname}${url.search}${url.hash}`;
}

export function routeActionForHref(
  href: string,
  context: RecommendationActionContext = {}
): RecommendationPrimaryAction {
  const normalized = href.split("?")[0]?.replace(/\/$/, "") || href;
  const action = ROUTE_ACTIONS[normalized];
  const contextualHref = recommendationHrefWithContext(href, context);
  if (action) return { ...action, href: contextualHref };
  if (normalized.startsWith("/quests/")) {
    return {
      label: "Check quest requirements",
      href: contextualHref,
      helper: "See skills, prereq quests, required items and bank readiness before starting."
    };
  }

  return {
    label: "Open Scapestack route",
    href: contextualHref,
    helper: "Continue in the Scapestack page connected to this recommendation."
  };
}

export function primaryActionForRecommendation(
  rec: Recommendation,
  context: RecommendationActionContext = {}
): RecommendationPrimaryAction {
  if ((rec.kind === "kc" || rec.kind === "boss") && rec.bossSlug) {
    return {
      label: "Open boss setup",
      href: recommendationHrefWithContext(
        `/dps?boss=${encodeURIComponent(rec.bossSlug)}&from=next`,
        context
      ),
      bossSlug: rec.bossSlug,
      helper: "See gear, weakness, owned upgrades and DPS context."
    };
  }

  if (rec.link) return routeActionForHref(rec.link, context);

  switch (rec.kind) {
    case "quest":
      return {
        label: "Open quest guide",
        href: wikiSearchUrl(rec.title),
        external: true,
        helper: "Read the OSRS Wiki guide, then come back and re-run /next."
      };
    case "diary":
      return {
        label: "Open diary guide",
        href: wikiSearchUrl(rec.title),
        external: true,
        helper: "Check exact task list and finish the tier."
      };
    case "skill":
      return routeActionForHref("/skills", context);
    case "slayer":
      return routeActionForHref("/slayer", context);
    case "money":
      return routeActionForHref("/gp", context);
    case "bank":
      return routeActionForHref("/bank", context);
    case "goal":
    case "milestone":
      return routeActionForHref("/goals", context);
    case "minigame":
      return {
        label: "Open minigame guide",
        href: wikiSearchUrl(rec.title),
        external: true,
        helper: "Check the activity requirements and reward path."
      };
    default:
      return {
        label: "Show step-by-step guide",
        href: wikiSearchUrl(rec.title),
        external: true,
        helper: "Use the detailed steps below, then re-run the account check."
      };
  }
}
