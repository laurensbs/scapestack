import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/next/next-client.tsx"), "utf8");

describe("/next confidence UI copy", () => {
  it("shows confidence labels inside compact recommendation rows", () => {
    expect(source).toContain("function ActionPlanBlock");
    expect(source).toContain("compact = false");
    expect(source).toContain("normal-case tracking-normal");
    expect(source).toContain("{plan.confidenceLabel}");
    expect(source).toContain("title={plan.caveat || \"Recommendation confidence\"}");
  });

  it("explains exact, likely and guided recommendation confidence", () => {
    expect(source).toContain("function RecommendationConfidenceLegend");
    expect(source).toContain("Why this pick?");
    expect(source).toContain('label: "Synced"');
    expect(source).toContain("RuneLite sync covers this quest, diary, collection log or Slayer state.");
    expect(source).not.toContain("Verified RuneLite payload");
    expect(source).toContain("Uses your RSN, hiscores and saved bank where available.");
    expect(source).toContain("Good default pick, but missing live account signals.");
  });

  it("makes compact recommendation rows visibly and accessibly clickable", () => {
    expect(source).toContain("const primaryAction = primaryActionForRecommendation(rec, actionContext);");
    expect(source).toContain("const actionLabel = isBossWithDetail ? \"Open boss detail\" : primaryAction.label;");
    expect(source).toContain("const actionHref = isBossWithDetail ? undefined : primaryAction.href;");
    expect(source).toContain("aria-label={`${actionLabel}: ${rec.title}`}");
    expect(source).toContain("title={`${actionLabel}: ${rec.title}`}");
    expect(source).toContain('type="button"');
    expect(source).toContain("onClick={() => onBossOpen(rec.bossSlug!)}");
    expect(source).toContain("{actionLabel} <ArrowRight");
    expect(source).toContain('target="_blank"');
    expect(source).toContain('rel="noopener noreferrer"');
    expect(source).not.toContain('role="button"');
    expect(source).not.toContain("tabIndex={0}");
    expect(source).not.toContain("div-as-button pattern");
    expect(source).not.toContain('"Open the tool"');
  });

  it("keeps missing plugin sync copy on the sync-checker path", () => {
    expect(source).toContain("nextPluginHubCta(pluginHubState, hasAnyTracker)");
    expect(source).toContain('fetch("/api/plugin-hub/status")');
    expect(source).toContain("reviewCopyBlocked || pinBlocked || reviewBlocked");
    expect(source).toContain('? "review-blocked"');
    expect(source).toContain("pluginSyncHref");
    expect(source).toContain("#verify-sync");
    expect(source).not.toContain("#review-readiness");
    expect(source).toContain("{pluginHubCta.cta}");
  });

  it("keeps missing context out of the recommendation card chrome", () => {
    expect(source).toContain("function MakePlanSmarter");
    expect(source).toContain("Change name or bank");
    expect(source).toContain("Add bank");
    expect(source).toContain("Set up RuneLite");
    expect(source).not.toContain("missingDataActionForRecommendation(rec, actionContext)");
    expect(source).not.toContain("function RecommendationDataActionCallout");
    expect(source).not.toContain("Sharpen this pick:");
  });

  it("keeps proof chips behind expanded recommendation steps", () => {
    expect(source).toContain("function RecommendationProofStrip");
    expect(source).toContain('data-testid={compact ? "next-row-proof-strip" : "next-headline-proof-strip"}');
    expect(source).toContain('label: "Confidence"');
    expect(source).toContain('label: "Session"');
    expect(source).toContain('label: "Payoff"');
    expect(source).toContain('label: "Check first"');
    expect(source).toContain("<RecommendationProofStrip rec={rec} />");
    expect(source).not.toContain("<RecommendationProofStrip rec={rec} compact />");
    expect(source).toContain("{open && <RecDetailPanel rec={rec} actionContext={actionContext} />}");
  });

  it("renders every recommendation as an actionable OSRS decision card", () => {
    expect(source).toContain("function RecommendationDecisionSpec");
    expect(source).toContain("function RecommendationQuickFacts");
    expect(source).toContain("function RecommendationFirstStep");
    expect(source).toContain('data-testid={compact ? "next-row-decision-spec" : "next-headline-decision-spec"}');
    expect(source).toContain("Session length");
    expect(source).toContain("Why it fits");
    expect(source).toContain("Needs");
    expect(source).toContain("Check first");
    expect(source).toContain("Best move now");
    expect(source).toContain("Start:");
    expect(source).toContain("Bring");
    expect(source).toContain("OSRS item ID {visual.id}");
    expect(source).toContain("recommendationVisualItem(rec)");
    expect(source).toContain("recommendationNeeds(rec)");
    expect(source).toContain("recommendationMissingDataWarning(rec)");
    expect(source).toContain("<RecommendationDecisionSpec rec={rec} />");
    expect(source).not.toContain("<RecommendationDecisionSpec rec={rec} compact />");
  });

  it("keeps recommendation cards valid by using explicit links instead of nested card anchors", () => {
    expect(source).toContain("The article itself is not a fake button");
    expect(source).toContain('aria-label={`${actionLabel}: ${rec.title}`}');
    expect(source).toContain("primaryAction.external ? (");
    expect(source).toContain("rel=\"noopener noreferrer\"");
    expect(source).toContain("Open boss detail");
    expect(source).not.toContain("<Link href={actionHref}>{card}</Link>");
    expect(source).not.toContain("<a href={actionHref} target=\"_blank\" rel=\"noopener noreferrer\">{card}</a>");
    expect(source).not.toContain("cursor-pointer transition-transform");
    expect(source).not.toContain("cursor-pointer transition-colors");
  });

  it("keeps plan inputs inside the optional make-smarter section", () => {
    expect(source).toContain("function MakePlanSmarter");
    expect(source).toContain("function EvidenceLedger");
    expect(source).toContain('data-testid="next-evidence-ledger"');
    expect(source).toContain("Make this smarter");
    expect(source).toContain("Optional: add bank or RuneLite when gear, quests or Slayer matter.");
    expect(source).toContain("Plan inputs");
    expect(source).toContain("Add bank");
    expect(source).toContain("Set up RuneLite");
    expect(source).not.toContain("Used for this route");
    expect(source).toContain('label: "Hiscores"');
    expect(source).toContain('label: "Bank"');
    expect(source).toContain('label: "RuneLite"');
    expect(source).toContain('label: "Trackers"');
    expect(source).toContain("<EvidenceLedger summary={summary} pathData={pathData} bankItems={bankItems} />");
    expect(source).toContain("Optional: sync when you want completed quests, diaries, collection log and Slayer included.");
  });

  it("starts the result page with one plan instead of setup panels", () => {
    expect(source).toContain("Tonight&apos;s plan");
    expect(source).toContain("Do this first.");
    expect(source).toContain("One best move for this account");
    expect(source).toContain("Backups");
    expect(source).toContain("Change vibe or time");
    expect(source).toContain("Account progress");
    expect(source).toContain("Open when you want the numbers");
    expect(source).not.toContain("function SessionBrief");
    expect(source).not.toContain("<SessionBrief");
    expect(source).not.toContain("ScapestackReadinessRail");
    expect(source).not.toContain("Tonight&apos;s session brief");
    expect(source).not.toContain("Trust level");
  });

  it("respects legacy route intent instead of dropping players into default mood", () => {
    expect(source).toContain("nextIntentFromSearch(initialQueryString)");
    expect(source).toContain("routeIntent?.mood");
    expect(source).toContain("{routeIntent.label}");
    expect(source).toContain("title={routeIntent.helper}");
    expect(source).toContain("routeIntent={routeIntent}");
  });

  it("keeps plugin-origin /next intake honest before verified sync loads", () => {
    expect(source).toContain("const cameFromPlugin = useMemo");
    expect(source).toContain('params.get("from") === "plugin"');
    expect(source).toContain("cameFromPlugin={cameFromPlugin}");
    expect(source).toContain("RuneLite sync is optional. If it finds this RSN, /next can avoid progress you already finished.");
    expect(source).toContain("Bank stays in this browser.");
    expect(source).toContain("Free, no account, no plugin.");
  });

  it("gives plugin-origin players a concrete sync verification path", () => {
    expect(source).toContain('pluginVerifyUrlForSyncedRsn(rsn, "next"');
    expect(source).toContain("hasBankContext: Boolean(fromBank)");
    expect(source).toContain("Back from Scapestack Sync");
    expect(source).toContain("Enter the same OSRS name.");
    expect(source).toContain("If /next still looks guessed, run sync again from RuneLite and re-check this RSN.");
    expect(source).toContain("Check sync");
    expect(source).toContain("href={pluginVerifyHref}");
  });

  it("does not call unverified /next plugin handoff exact sync", () => {
    expect(source).toContain("Check RuneLite sync");
    expect(source).not.toContain("Add exact sync");
  });

  it("separates RuneLite account proof from browser-only bank proof", () => {
    expect(source).toContain("Account progress");
    expect(source).toContain("RuneLite sync included quests, diaries, collection log and Slayer for this RSN.");
    expect(source).toContain("Bank context");
    expect(source).toContain("Paste Bank Memory or Bank Tags when gear, supplies or affordability matter.");
  });

  it("lets players clear temporary bank handoff storage", () => {
    expect(source).toContain("clearBankHandoffPayload(window)");
    expect(source).toContain("Clear handoff");
    expect(source).toContain("Browser-only handoff");
    expect(source).toContain("Stored bank cleared");
    expect(source).toContain('import { bankOrganizerHref } from "@/lib/bank-handoff-url";');
    expect(source).toContain('window.location.href = bankOrganizerHref(activeRsn, "next");');
  });

  it("gives hidden recommendations an immediate undo path", () => {
    expect(source).toContain("restoreRecommendation");
    expect(source).toContain("lastSuppressed");
    expect(source).toContain("Hidden for now:");
    expect(source).toContain("Undo hide");
    expect(source).toContain("aria-label={`Not today: hide ${rec.title}`}");
  });

  it("lets players mark recommendations done without calling them irrelevant", () => {
    expect(source).toContain("lastCompleted");
    expect(source).toContain('reason: "already_done"');
    expect(source).toContain("const completeRecommendation = (rec: Recommendation) =>");
    expect(source).toContain("Marked done:");
    expect(source).toContain("Undo done");
    expect(source).toContain("aria-label={`Done: mark ${rec.title} complete`}");
    expect(source).toContain("onComplete={completeRecommendation}");
    expect(source).toContain("onComplete: (rec: Recommendation) => void");
  });

  it("renders recommendation feedback controls as visible pill buttons", () => {
    expect(source).toContain("function recommendationFeedbackButtonClass");
    expect(source).toContain('tone: "done" | "skip" | "details"');
    expect(source).toContain("rounded-full border border-[var(--color-border)] bg-[var(--color-panel)]/65");
    expect(source).toContain('recommendationFeedbackButtonClass("done")');
    expect(source).toContain('recommendationFeedbackButtonClass("skip")');
    expect(source).toContain('recommendationFeedbackButtonClass("details")');
    expect(source).toContain('recommendationFeedbackButtonClass("done", true)');
    expect(source).toContain('recommendationFeedbackButtonClass("skip", true)');
    expect(source).toContain('recommendationFeedbackButtonClass("details", true)');
  });

  it("copies recommendation plans with route context", () => {
    expect(source).toContain("formatRecommendationSessionPlan(visibleRecs, actionContext)");
    expect(source).toContain('aria-label="Copy top Scapestack session plan"');
    expect(source).toContain("Copy session plan");
    expect(source).toContain("Session copied");
    expect(source).toContain('useState<"idle" | "copied" | "error">("idle")');
    expect(source).toContain("Try copy again");
    expect(source).not.toContain("formatRecommendationActionPlan(rec, actionContext)");
    expect(source).not.toContain("aria-label={`Copy plan for ${rec.title}`}");
    expect(source).not.toContain("Clipboard failed — copy manually");
    expect(source).not.toContain('window.setTimeout(() => setCopyState("idle"), 2400)');
  });

  it("makes expanded recommendation details triangulate to OSRS Wiki", () => {
    expect(source).toContain("function recommendationWikiQuery(rec: Recommendation): string");
    expect(source).toContain("const wikiQuery = recommendationWikiQuery(rec);");
    expect(source).toContain("href={wikiSearchUrl(wikiQuery)}");
    expect(source).toContain("Open OSRS Wiki for ${wikiQuery}");
    expect(source).toContain("OSRS Wiki");
    expect(source).toContain("BOSSES.find((candidate) => candidate.slug === rec.bossSlug)");
    expect(source).toContain(".replace(/^Try\\s+/i, \"\")");
    expect(source).toContain(".replace(/^Push\\s+/i, \"\")");
    expect(source).toContain(".replace(/^Finish\\s+/i, \"\")");
  });

  it("passes browser handoff items into direct RSN runs", () => {
    expect(source).toContain("let heroBankItems = [] as BankHandoffItem[];");
    expect(source).toContain("heroBankItems = readBankHandoffPayload(window);");
    expect(source).toContain("run({ rsn: heroRsn.trim(), input: heroBank, bankItems: heroBankItems });");
  });

  it("lets bank-handoff players run /next without typing an RSN", () => {
    expect(source).toContain("Using the bank you just organised");
    expect(source).toContain("Plan with this bank");
    expect(source).toContain("onClick={() => onRun({ bankItems: fromBank.items })}");
    expect(source).toContain("disabled={loading}");
    expect(source).toContain("Add your OSRS name for stat-aware");
  });

  it("explains why the /next submit CTA is disabled", () => {
    expect(source).toContain('aria-describedby="next-show-me-disabled-help"');
    expect(source).toContain('id="next-show-me-disabled-help"');
    expect(source).toContain("Type an OSRS name, paste a bank, or start from the Bank Organizer to unlock Show me.");
    expect(source).toContain("bank-only planning is available");
  });

  it("shows when bank context and RuneLite sync are fused", () => {
    expect(source).toContain("const pluginSyncState = result.pathProgress.syncedSources?.scapestack");
    expect(source).toContain("pluginSyncState={pluginSyncState}");
    expect(source).toContain('pluginSyncState: "live" | "stale" | "outdated" | null;');
    expect(source).toContain("const hasLivePluginSync = pluginSyncState === \"live\";");
    expect(source).toContain("hasLivePluginSync && bankItems.length > 0");
    expect(source).toContain("Bank and fresh RuneLite sync are both in the plan");
    expect(source).not.toContain("verified RuneLite account payload");
    expect(source).toContain("RuneLite sync is connected, but update the plugin before relying on newer Slayer and collection-log details.");
    expect(source).toContain("{hasPluginSync ? \"Bank + RuneLite sync connected\" : \"Bank context active\"}");
    expect(source).toContain("Bank + sync ready");
    expect(source).not.toContain("Exact fusion");
    expect(source).toContain("Plugin update needed");
  });
});
