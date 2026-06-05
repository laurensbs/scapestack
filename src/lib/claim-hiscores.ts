import { fetchHiscores, type PlayerHiscores } from "./hiscores";

export type ClaimHiscoresCheck = "found" | "missing" | "unreachable";

export type ClaimHiscoresLookup = (
  rsn: string,
  options: { strict: true }
) => Promise<PlayerHiscores | null>;

export async function checkHiscoresForClaim(
  rsn: string,
  timeoutMs = 2_500,
  lookup: ClaimHiscoresLookup = (name, options) => fetchHiscores(name, options)
): Promise<ClaimHiscoresCheck> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const result = await Promise.race<ClaimHiscoresCheck>([
    lookup(rsn, { strict: true })
      .then((hiscores) => hiscores ? "found" : "missing")
      .catch(() => "unreachable"),
    new Promise<ClaimHiscoresCheck>((resolve) => {
      timeout = setTimeout(() => resolve("unreachable"), timeoutMs);
    })
  ]);
  if (timeout) clearTimeout(timeout);
  return result;
}
