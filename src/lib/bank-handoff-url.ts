export function bankOrganizerHref(
  rsn?: string | null,
  from = "next",
  options: { boss?: string | null } = {}
): string {
  const params = new URLSearchParams();
  const cleanRsn = (rsn ?? "").trim();
  const cleanBoss = (options.boss ?? "").trim();
  if (cleanRsn) params.set("rsn", cleanRsn);
  if (from.trim()) params.set("from", from.trim());
  if (from.trim() === "dps" && cleanBoss) params.set("boss", cleanBoss);
  const query = params.toString();
  return query ? `/bank?${query}` : "/bank";
}
