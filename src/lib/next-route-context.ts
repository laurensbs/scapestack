function paramsFromQuery(query: string): URLSearchParams {
  return new URLSearchParams(query.replace(/^\?/, ""));
}

const BANK_HANDOFF_SOURCES = new Set(["bank", "profile", "dps", "goals", "plugin", "slayer"]);

export function shouldReadNextBankHandoff(query: string): boolean {
  const params = paramsFromQuery(query);
  const from = params.get("from");
  return Boolean(from && BANK_HANDOFF_SOURCES.has(from) && params.get("bank") !== "none");
}

export function shouldReadNextHeroBank(query: string): boolean {
  const params = paramsFromQuery(query);
  return Boolean(params.get("rsn")?.trim()) && params.get("bank") !== "none";
}
