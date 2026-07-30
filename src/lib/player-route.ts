import { cleanRsnInput } from "@/lib/rsn";

export type PlayerRouteSearchParams = Record<string, string | string[] | undefined>;

export function playerPath(rsn: string, searchParams: PlayerRouteSearchParams = {}): string {
  const cleanRsn = cleanRsnInput(rsn).slice(0, 12);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "rsn") continue;
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }
  const suffix = query.toString();
  return `/p/${encodeURIComponent(cleanRsn)}${suffix ? `?${suffix}` : ""}`;
}
