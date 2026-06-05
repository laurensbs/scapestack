export function bankOrganizerHref(rsn?: string | null, from = "next"): string {
  const params = new URLSearchParams();
  const cleanRsn = (rsn ?? "").trim();
  if (cleanRsn) params.set("rsn", cleanRsn);
  if (from.trim()) params.set("from", from.trim());
  const query = params.toString();
  return query ? `/bank?${query}` : "/bank";
}
