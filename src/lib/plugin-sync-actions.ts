import { brandUrl } from "./brand";

export const PUBLIC_SYNC_URL = brandUrl("/api/sync");
export const PUBLIC_SYNC_CLAIM_URL = brandUrl("/api/sync/claim");
export const LOCAL_SYNC_URL = "http://127.0.0.1:4173/api/sync";
export const LOCAL_SYNC_CLAIM_URL = "http://127.0.0.1:4173/api/sync/claim";
export const DB_INIT_COMMAND = "npm run db:init";

export interface PluginSyncUrls {
  sync: string;
  claim: string;
}

export function syncUrlsForOrigin(_origin?: string | null): PluginSyncUrls {
  return {
    sync: PUBLIC_SYNC_URL,
    claim: PUBLIC_SYNC_CLAIM_URL
  };
}

export function nextUrlForSyncedRsn(rsn: string): string {
  const cleanRsn = rsn.trim();
  const params = new URLSearchParams();
  if (cleanRsn) params.set("rsn", cleanRsn);
  params.set("source", "plugin-sync");
  params.set("bank", "none");
  return `/next?${params.toString()}`;
}

export interface PluginNextUrlOptions {
  hasBankContext?: boolean;
}

export function nextUrlFromPluginSearch(search: string, options: PluginNextUrlOptions = {}): string {
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  const next = new URLSearchParams();
  const cleanRsn = params.get("rsn")?.trim() ?? "";
  if (cleanRsn) next.set("rsn", cleanRsn);
  next.set("from", "plugin");
  if (!options.hasBankContext) next.set("bank", "none");
  return `/next?${next.toString()}`;
}

export function slayerUrlForSyncedRsn(rsn: string): string {
  const cleanRsn = rsn.trim();
  const params = new URLSearchParams();
  if (cleanRsn) params.set("rsn", cleanRsn);
  params.set("source", "plugin-sync");
  params.set("bank", "none");
  return `/slayer?${params.toString()}`;
}

export function pluginVerifyUrlForSyncedRsn(
  rsn: string,
  from = "bank",
  options: PluginNextUrlOptions = {}
): string {
  const cleanRsn = rsn.trim();
  const params = new URLSearchParams();
  if (cleanRsn) params.set("rsn", cleanRsn);
  params.set("from", from);
  if (options.hasBankContext === false) params.set("bank", "none");
  return `/plugin?${params.toString()}#verify-sync`;
}

export function isPluginSyncSource(source: string | null): boolean {
  return source === "plugin-sync";
}
