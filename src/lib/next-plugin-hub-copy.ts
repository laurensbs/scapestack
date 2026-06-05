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

  if (state === "closed") {
    return {
      title: "RuneLite sync submission paused",
      body: "The Plugin Hub submission is closed right now. Keep using bank, Hiscores and public trackers; developer install remains available for testers.",
      cta: "Open plugin status →"
    };
  }

  if (state === "review-blocked") {
    return {
      title: "RuneLite sync review handoff blocked",
      body: hasExternalTracker
        ? "External trackers helped this run, but the Plugin Hub PR still needs reviewer-facing fixes before normal players should install. Keep planning with public data and bank context; maintainers should open the review checklist."
        : "This run is partly inferred. Plugin Hub review is blocked by PR handoff copy or pin state, so normal players should keep using web recommendations while the reviewer checklist is fixed.",
      cta: "Open review checklist →"
    };
  }

  if (state === "unknown") {
    return {
      title: "RuneLite sync status unavailable",
      body: hasExternalTracker
        ? "External trackers helped this run, but Scapestack cannot prove the Plugin Hub state right now. Keep planning with current data and verify RuneLite sync status from the plugin page before setup."
        : "This run is partly inferred. Scapestack cannot prove the Plugin Hub state right now, so keep planning with current data and check the plugin page before setup.",
      cta: "Open plugin status →"
    };
  }

  return {
    title: "RuneLite sync pending review",
    body: hasExternalTracker
      ? "External trackers helped this run. Plugin Hub review is still pending, so verified RuneLite coverage labels are for testers via local setup only."
      : "This run is partly inferred. Plugin Hub review is still pending; normal players can keep planning with current data while testers use local setup.",
    cta: "Track plugin review →"
  };
}
