import { pluginVerifyUrlForSyncedRsn } from "./plugin-sync-actions";

export type BankToolPath = "/next" | "/dps" | "/goals" | "/slayer" | "/plugin";
export type ToolHandoffSource = "bank" | "profile" | "next" | "dps" | "goals" | "slayer";

export interface ToolHandoffOptions {
  hasBankContext?: boolean;
  boss?: string | null;
}

export function bankToolUrl(path: BankToolPath, rsn?: string | null, options: ToolHandoffOptions = {}): string {
  return toolHandoffUrl(path, "bank", rsn, options);
}

export function toolHandoffUrl(
  path: BankToolPath,
  from: ToolHandoffSource,
  rsn?: string | null,
  options: ToolHandoffOptions = {}
): string {
  if (path === "/plugin") return pluginVerifyUrlForSyncedRsn(rsn ?? "", from, options);

  const params = new URLSearchParams();
  const cleanRsn = (rsn ?? "").trim();
  if (cleanRsn) params.set("rsn", cleanRsn);
  params.set("from", from);
  if (options.hasBankContext === false) params.set("bank", "none");
  if (path === "/dps") {
    const cleanBoss = (options.boss ?? "").trim();
    if (cleanBoss) params.set("boss", cleanBoss);
  }
  return `${path}?${params.toString()}`;
}
