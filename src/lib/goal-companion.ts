export interface GoalRouteHandoff {
  setId: string;
  setName: string;
  targetName: string;
  savedAt: string;
}

function accountSlug(rsn: string): string {
  const clean = rsn.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  return clean || "guest";
}

export function goalManualChecksStorageKey(rsn: string): string {
  return `scapestack:goals:manual-checks:v2:${accountSlug(rsn)}`;
}

export function goalSelectionStorageKey(rsn: string): string {
  return `scapestack:goals:selected:v1:${accountSlug(rsn)}`;
}

export function activeGoalRouteStorageKey(rsn: string): string {
  return `scapestack:goals:active-route:v1:${accountSlug(rsn)}`;
}

export function goalRouteHref({
  rsn,
  setId,
  targetName
}: {
  rsn: string;
  setId: string;
  targetName: string;
}): string {
  const params = new URLSearchParams({
    from: "goals",
    intent: "unlock",
    time: "120",
    unlock: setId,
    target: targetName
  });
  if (rsn.trim()) params.set("rsn", rsn.trim());
  return `/next?${params.toString()}`;
}

export function persistActiveGoalRoute(
  storage: Pick<Storage, "setItem">,
  rsn: string,
  route: Omit<GoalRouteHandoff, "savedAt">
): GoalRouteHandoff {
  const saved = { ...route, savedAt: new Date().toISOString() };
  storage.setItem(activeGoalRouteStorageKey(rsn), JSON.stringify(saved));
  return saved;
}
