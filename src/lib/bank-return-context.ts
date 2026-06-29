export type BankReturnSource = "next" | "dps" | "goals" | "slayer" | "plugin" | "profile";

export interface BankReturnContext {
  source: BankReturnSource;
  label: string;
  title: string;
  body: string;
}

const contexts: Record<BankReturnSource, Omit<BankReturnContext, "source">> = {
  next: {
    label: "Back from /next",
    title: "Refresh the bank before planning another session",
    body: "Paste Bank Memory or Bank Tags again if gear, supplies or GP changed after your last recommendation."
  },
  dps: {
    label: "Back from kill check",
    title: "Update combat gear before trusting the boss trip",
    body: "Paste your latest bank so Scapestack can use the weapons, upgrades and supplies you actually own now."
  },
  goals: {
    label: "Back from unlocks",
    title: "Refresh the bank before picking the next unlock",
    body: "Paste the current bank if you bought supplies, sold gear or finished a milestone that changes affordability."
  },
  slayer: {
    label: "Back from Slayer",
    title: "Update Slayer supplies before picking tasks",
    body: "Paste the latest bank to re-check cannonballs, bracelets, runes, prayer restores and task gear."
  },
  plugin: {
    label: "Back from sync setup",
    title: "Bank paste stays separate from RuneLite sync",
    body: "RuneLite verifies account state only. Paste Bank Memory or Bank Tags here when gear, supplies or affordability matter."
  },
  profile: {
    label: "Back from profile",
    title: "Attach a fresh bank to this player",
    body: "Paste this RSN's bank to turn profile and Hiscores context into gear-aware recommendations."
  }
};

export function bankReturnContextFromSource(source?: string | null): BankReturnContext | null {
  const normalized = source?.trim().toLowerCase();
  if (!normalized || !isBankReturnSource(normalized)) return null;
  return {
    source: normalized,
    ...contexts[normalized]
  };
}

function isBankReturnSource(source: string): source is BankReturnSource {
  return source === "next"
    || source === "dps"
    || source === "goals"
    || source === "slayer"
    || source === "plugin"
    || source === "profile";
}
