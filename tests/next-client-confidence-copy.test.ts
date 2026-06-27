import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/next/next-client.tsx"), "utf8");

describe("/next confidence UI copy", () => {
  it("keeps internal confidence labels out of recommendation cards", () => {
    expect(source).toContain("function ActionPlanBlock");
    expect(source).toContain("compact = false");
    expect(source).not.toContain("{plan.confidenceLabel}");
    expect(source).not.toContain("Recommendation confidence");
    expect(source).not.toContain("function RecommendationConfidenceLegend");
    expect(source).not.toContain("How sure is it?");
    expect(source).not.toContain("Verified RuneLite payload");
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
    expect(source).not.toContain("nextPluginHubCta(pluginHubState, hasAnyTracker)");
    expect(source).not.toContain('fetch("/api/plugin-hub/status")');
    expect(source).not.toContain("reviewCopyBlocked || pinBlocked || reviewBlocked");
    expect(source).not.toContain('? "review-blocked"');
    expect(source).toContain("pluginVerifyUrlForSyncedRsn");
    expect(source).not.toContain("#review-readiness");
    expect(source).toContain("RuneLite did not show up yet.");
  });

  it("keeps missing context out of the recommendation card chrome", () => {
    expect(source).toContain("function MakePlanSmarter");
    expect(source).toContain("Change input");
    expect(source).toContain("Add gear");
    expect(source).toContain("Check RuneLite");
    expect(source).not.toContain("missingDataActionForRecommendation(rec, actionContext)");
    expect(source).not.toContain("function RecommendationDataActionCallout");
    expect(source).not.toContain("Sharpen this pick:");
  });

  it("keeps expanded recommendation details focused on session steps", () => {
    expect(source).toContain("<ActionPlanBlock rec={rec} />");
    expect(source).toContain("You'll need");
    expect(source).toContain("OSRS Wiki");
    expect(source).toContain("{open && <RecDetailPanel rec={rec} actionContext={actionContext} />}");
    expect(source).not.toContain("function RecommendationProofStrip");
    expect(source).not.toContain('data-testid={compact ? "next-row-proof-strip" : "next-headline-proof-strip"}');
    expect(source).not.toContain("<RecommendationProofStrip rec={rec} />");
  });

  it("renders every recommendation as an actionable OSRS session card", () => {
    expect(source).toContain("function playerChoiceTag");
    expect(source).toContain('label: "GP"');
    expect(source).toContain('label: "Bossing"');
    expect(source).toContain('label: "AFK"');
    expect(source).toContain('label: "Chill"');
    expect(source).toContain('label: "Slayer"');
    expect(source).toContain('label: "Unlock"');
    expect(source).toContain("function RecommendationQuickFacts");
    expect(source).toContain("function RecommendationFirstStep");
    expect(source).toContain("Do this first");
    expect(source).toContain("Start:");
    expect(source).toContain('label: "Stop"');
    expect(source).toContain("Bring");
    expect(source).toContain("recommendationNeeds(rec)");
    expect(source).not.toContain("function RecommendationDecisionSpec");
    expect(source).not.toContain("OSRS item ID {visual.id}");
    expect(source).not.toContain("Visual identity");
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
    expect(source).not.toContain("function EvidenceLedger");
    expect(source).not.toContain('data-testid="next-evidence-ledger"');
    expect(source).toContain("Make this smarter");
    expect(source).toContain("Optional: add gear or RuneLite when the pick looks off.");
    expect(source).not.toContain("What shaped this");
    expect(source).toContain("Add gear");
    expect(source).toContain("Check RuneLite");
    expect(source).not.toContain("Used for this route");
    expect(source).toContain('label="OSRS name"');
    expect(source).toContain('label="Gear"');
    expect(source).toContain('label="RuneLite"');
    expect(source).not.toContain('label: "Public checks"');
    expect(source).not.toContain("<EvidenceLedger summary={summary} pathData={pathData} bankItems={bankItems} />");
    expect(source).toContain("Use it when finished progress would change the pick.");
  });

  it("starts the result page with one plan instead of setup panels", () => {
    expect(source).toContain("What to do now");
    expect(source).toContain("Do this first");
    expect(source).toContain("One best move for this account. Two backups");
    expect(source).toContain("Backups");
    expect(source).toContain("Chill / GP / Bossing / Unlock / AFK");
    expect(source).toContain("Change vibe or time");
    expect(source).toContain("Account details");
    expect(source).toContain("Open later");
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
    expect(source).toContain("RuneLite is optional. If it finds this RSN, /next can avoid progress you already finished.");
    expect(source).toContain("Gear stays in this browser.");
    expect(source).toContain("Free, no account needed.");
  });

  it("offers a simple first-run sample for new or returning players", () => {
    expect(source).toContain('const SAMPLE_LABEL = "simple returning-player plan";');
    expect(source).toContain("New or returning? See a {SAMPLE_LABEL}");
    expect(source).not.toContain("mid-game PvM sample");
  });

  it("gives plugin-origin players a concrete sync verification path", () => {
    expect(source).toContain('pluginVerifyUrlForSyncedRsn(rsn, "next"');
    expect(source).toContain("hasBankContext: Boolean(fromBank)");
    expect(source).toContain("Back from RuneLite");
    expect(source).toContain("Enter the same RSN.");
    expect(source).toContain("If the plan still looks guessed, press Sync now in RuneLite and check again.");
    expect(source).toContain("Check RuneLite");
    expect(source).toContain("href={pluginVerifyHref}");
  });

  it("does not call unverified /next plugin handoff exact sync", () => {
    expect(source).toContain("Check RuneLite");
    expect(source).not.toContain("Add exact sync");
  });

  it("keeps RuneLite and bank context inside optional context", () => {
    expect(source).not.toContain("function PluginSyncStrip");
    expect(source).not.toContain("{plugin.quests.toLocaleString()} quests");
    expect(source).not.toContain("{plugin.diaries.toLocaleString()} diary tiers");
    expect(source).not.toContain("{plugin.clItems.toLocaleString()} log items");
    expect(source).not.toContain("Slayer not synced");
    expect(source).not.toContain("Account progress");
    expect(source).not.toContain("RuneLite sync included quests, diaries, collection log and Slayer for this RSN.");
    expect(source).not.toContain("Bank context");
  });

  it("lets players clear temporary bank handoff storage", () => {
    expect(source).toContain("clearBankHandoffPayload(window)");
    expect(source).toContain("Clear gear");
    expect(source).toContain("This gear stays in this browser and expires automatically.");
    expect(source).toContain("Stored gear cleared");
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
    expect(source).toContain("Nice.");
    expect(source).toContain("Pick the next move.");
    expect(source).toContain("Another trip");
    expect(source).toContain("Chill now");
    expect(source).toContain("Undo done");
    expect(source).toContain("const moveToAnotherPlan = () =>");
    expect(source).toContain("const moveToChillPlan = () =>");
    expect(source).toContain("aria-label={`Done: mark ${rec.title} complete`}");
    expect(source).toContain("onComplete={completeRecommendation}");
    expect(source).toContain("onComplete: (rec: Recommendation) => void");
  });

  it("has a clean screenshot/share mode without turning the planner into a dashboard", () => {
    expect(source).toContain("shareMode");
    expect(source).toContain("onShareModeChange");
    expect(source).toContain("Screenshot mode");
    expect(source).toContain("Exit clean shot");
    expect(source).toContain("data-screenshot-mode={shareMode ? \"true\" : undefined}");
    expect(source).toContain("{!shareMode && (");
    expect(source).toContain("cleanMode={shareMode}");
    expect(source).not.toContain("Share dashboard");
  });

  it("adds subtle OSRS account-archetype and RuneLite avoided-bad-advice copy", () => {
    expect(source).toContain("function accountArchetypeCopy");
    expect(source).toContain("RuneLite-aware");
    expect(source).toContain("Returning/midgame");
    expect(source).toContain("PvM-ready");
    expect(source).toContain("Skiller-friendly");
    expect(source).toContain("RuneLite helped avoid finished quests, diary steps, clog slots and Slayer mistakes.");
    expect(source).toContain("function runeLitePlanNote");
    expect(source).not.toContain("RuneLite evidence dashboard");
  });

  it("keeps recommendation feedback controls on the main pick", () => {
    expect(source).toContain("function recommendationFeedbackButtonClass");
    expect(source).toContain('tone: "done" | "skip" | "details"');
    expect(source).toContain("rounded-full border border-[var(--color-border)] bg-[var(--color-panel)]/65");
    expect(source).toContain('recommendationFeedbackButtonClass("done")');
    expect(source).toContain('recommendationFeedbackButtonClass("skip")');
    expect(source).toContain('recommendationFeedbackButtonClass("details")');
    expect(source).not.toContain('recommendationFeedbackButtonClass("done", true)');
    expect(source).not.toContain('recommendationFeedbackButtonClass("skip", true)');
    expect(source).not.toContain('recommendationFeedbackButtonClass("details", true)');
  });

  it("copies recommendation plans with route context", () => {
    expect(source).toContain("pick ? [pick.headline, ...pick.alternatives] : visibleRecs");
    expect(source).toContain("formatRecommendationSessionPlan(");
    expect(source).toContain('aria-label="Copy top OSRS plan"');
    expect(source).toContain("Copy plan");
    expect(source).toContain("Plan copied");
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
    expect(source).toContain('placeholder="Type your OSRS name"');
    expect(source).toContain("Plan my next move");
  });

  it("lets bank-handoff players run /next without typing an RSN", () => {
    expect(source).toContain("Using the gear you just organised");
    expect(source).toContain("Plan with this gear");
    expect(source).toContain("onClick={() => onRun({ bankItems: fromBank.items })}");
    expect(source).toContain("disabled={loading}");
    expect(source).toContain("Add your OSRS name for stats and KC, or start with gear alone.");
  });

  it("explains why the /next submit CTA is disabled", () => {
    expect(source).toContain('aria-describedby="next-show-me-disabled-help"');
    expect(source).toContain('id="next-show-me-disabled-help"');
    expect(source).toContain("Enter an OSRS name to get one clear next move.");
    expect(source).toContain("gear-only plan");
  });

  it("shows when bank context and RuneLite sync are fused", () => {
    expect(source).toContain("const pluginSyncState = result.pathProgress.syncedSources?.scapestack");
    expect(source).toContain("pluginSyncState={pluginSyncState}");
    expect(source).toContain('pluginSyncState: "live" | "stale" | "outdated" | null;');
    expect(source).toContain("const hasLivePluginSync = pluginSyncState === \"live\";");
    expect(source).toContain("hasLivePluginSync && bankItems.length > 0");
    expect(source).toContain("Gear and finished progress are both shaping this pick.");
    expect(source).not.toContain("verified RuneLite account payload");
    expect(source).toContain("RuneLite is connected, but update it before trusting newer details.");
    expect(source).toContain("{hasPluginSync ? \"Gear + RuneLite\" : \"Gear loaded\"}");
    expect(source).toContain("Gear + RuneLite");
    expect(source).not.toContain("Exact fusion");
    expect(source).toContain("Update RuneLite");
  });
});
