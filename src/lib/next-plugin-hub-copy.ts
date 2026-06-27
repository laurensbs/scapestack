export type NextPluginHubState = "open" | "merged" | "review-blocked" | "closed" | "unknown";

export interface NextPluginHubCta {
  title: string;
  body: string;
  cta: string;
}

export function nextPluginHubCta(state: NextPluginHubState, hasExternalTracker: boolean): NextPluginHubCta {
  void state;

  return {
    title: "Add Scapestack Sync",
    body: hasExternalTracker
      ? "External trackers helped this run. Sync the same RSN when you want Scapestack to avoid finished quests, diary tiers, collection-log items and Slayer mistakes."
      : "This route works from public stats. Add Scapestack Sync when you want completed quests, diaries, collection log and Slayer included.",
    cta: "Open sync →"
  };
}
