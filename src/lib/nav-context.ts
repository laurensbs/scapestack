import { toolHandoffUrl, type BankToolPath, type ToolHandoffSource } from "./bank-tool-routes";

const CONTEXT_TOOL_PATHS = new Set<BankToolPath>(["/next", "/dps", "/goals", "/slayer", "/plugin"]);
const SOURCE_PATHS = new Set<ToolHandoffSource>(["bank", "next", "dps", "goals", "slayer"]);

function sourceFromPathname(pathname: string): ToolHandoffSource | null {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return SOURCE_PATHS.has(firstSegment as ToolHandoffSource)
    ? firstSegment as ToolHandoffSource
    : null;
}

function paramsFromQuery(query?: string | URLSearchParams | null): URLSearchParams {
  if (!query) return new URLSearchParams();
  if (query instanceof URLSearchParams) return query;
  return new URLSearchParams(query.replace(/^\?/, ""));
}

export function contextualNavHref(
  href: string,
  currentPathname: string,
  currentQuery?: string | URLSearchParams | null,
  fallbackRsn?: string | null
): string {
  if (!CONTEXT_TOOL_PATHS.has(href as BankToolPath)) return href;

  const params = paramsFromQuery(currentQuery);
  const rsn = params.get("rsn") || fallbackRsn || "";
  const source = sourceFromPathname(currentPathname);
  if (!source) {
    const cleanRsn = rsn.trim();
    if (!cleanRsn) return href;
    const next = new URLSearchParams();
    next.set("rsn", cleanRsn);
    if (href === "/plugin") return `/plugin?${next.toString()}#verify-sync`;
    return `${href}?${next.toString()}`;
  }

  return toolHandoffUrl(href as BankToolPath, source, rsn, {
    hasBankContext: params.get("bank") === "none" ? false : undefined
  });
}
