export type NextPluginHubState = "open" | "merged" | "review-blocked" | "closed" | "unknown";

export interface NextPluginHubCta {
  title: string;
  body: string;
  cta: string;
}

export function nextPluginHubCta(state: NextPluginHubState, hasExternalTracker: boolean): NextPluginHubCta {
  if (state === "merged") {
    return {
      title: "Connect RuneLite sync",
      body: hasExternalTracker
        ? "External trackers helped, and Scapestack Sync is now installable. After RuneLite posts a verified payload, /next can label quest, diary, collection-log and Slayer coverage as verified, partial or missing."
        : "This run is partly inferred from public data. Install Scapestack Sync from RuneLite Plugin Hub, then verify a payload before trusting those account-state coverage labels.",
      cta: "Install and verify →"
    };
  }

  if (state === "closed" || state === "review-blocked" || state === "unknown") {
    return {
      title: "Check Scapestack Sync",
      body: hasExternalTracker
        ? "External trackers helped this run. To upgrade the advice, open the sync checker, confirm RuneLite posts to scapestack.org, and verify this same RSN."
        : "This run is partly inferred. Open the sync checker when you want Scapestack to verify quests, diaries, collection-log items and Slayer state for this RSN.",
      cta: "Check sync →"
    };
  }

  return {
    title: "Check Scapestack Sync",
    body: hasExternalTracker
      ? "External trackers helped this run. A verified Scapestack Sync payload can make the next-action list account-aware instead of inferred."
      : "This run is partly inferred. Verify Scapestack Sync for the same RSN when you want account-aware next actions.",
    cta: "Check sync →"
  };
}
