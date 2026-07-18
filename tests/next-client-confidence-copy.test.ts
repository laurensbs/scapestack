import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/next/next-client.tsx"), "utf8");
const bankedXpSource = readFileSync(join(process.cwd(), "src/lib/banked-xp.ts"), "utf8");
const planSurfaceSource = readFileSync(join(process.cwd(), "src/lib/next-plan-surface.ts"), "utf8");

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
    expect(source).toContain("onSelect: (rec: Recommendation) => void;");
    expect(source).toContain("onClick={() => onSelect(rec)}");
    expect(source).toContain("aria-label={`Choose ${rec.title}`}");
    expect(source).toContain("Two different session routes.");
    expect(source).toContain('type="button"');
    expect(source).toContain("group min-h-[136px] w-full");
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

  it("shows return value after real RuneLite deltas without raw sync diagnostics", () => {
    expect(source).not.toContain("function LastSyncSummaryCard");
    expect(source).not.toContain("function lastSyncReturnTitle");
    expect(source).not.toContain("<AccountTimeline");
    expect(source).not.toContain("raw diff");
    expect(source).not.toContain("sync payload");
  });

  it("keeps return mechanics behind one decision instead of dashboard panels", () => {
    expect(source).toContain("markAccountRuneliteProgress(rsn, runeliteProgressFromSyncSummary(");
    expect(source).toContain("headlineTitle: nextResult.headline?.title");
    expect(source).toContain("markAccountTrip(activeRsn, { ...event, action })");
    expect(source).toContain("Trip details");
    expect(source).toContain('role="dialog"');
    expect(source).not.toContain("<AccountTimeline");
    expect(source).not.toContain("<ReturnPlanCard");
    expect(source).not.toContain("<SessionRouteTimeline");
    expect(source).not.toContain("<ReturnLoopCard");
    expect(source).not.toContain("Session timeline");
    expect(source).not.toContain("Timeline dashboard");
    expect(source).not.toContain("Retention metrics");
    expect(source).not.toContain("Activity dashboard");
    expect(source).not.toContain("Journey dashboard");
  });

  it("keeps missing context out of the recommendation card chrome", () => {
    expect(source).toContain("function MakePlanSmarter");
    expect(source).toContain("Change input");
    expect(source).toContain("Add bank");
    expect(source).toContain("Check RuneLite");
    expect(source).not.toContain("missingDataActionForRecommendation(rec, actionContext)");
    expect(source).not.toContain("function RecommendationDataActionCallout");
    expect(source).not.toContain("Sharpen this pick:");
  });

  it("keeps expanded recommendation details focused on session steps", () => {
    expect(source).toContain("<ActionPlanBlock rec={rec} />");
    expect(source).toContain("You'll need");
    expect(source).toContain("OSRS Wiki");
    expect(source).toContain("<RecDetailPanel rec={rec} actionContext={actionContext} whyNot={whyNot} />");
    expect(source).toContain('aria-label="Close trip details"');
    expect(source).toContain("<RouteChainScroll rec={rec} onStart={onStart} />");
    expect(source).toContain("whyNot?: string | null;");
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
    expect(source).toContain("bankItems: BankHandoffItem[]");
    expect(source).not.toContain("Session fit");
    expect(source).not.toContain("Fits a chill");
    expect(source).not.toContain("Fits AFK mode");
    expect(source).not.toContain("Fits a GP session");
    expect(source).not.toContain("Fits a PvM session");
    expect(source).not.toContain("Fits a short login");
    expect(source).not.toContain("Not really AFK");
    expect(source).not.toContain("No gear gate");
    expect(source).not.toContain("Light setup:");
    expect(source).toContain("function recommendationFirstStepValue");
    expect(source).toContain("function recommendationStopPointValue");
    expect(source).toContain("function nextTripLines");
    expect(source).toContain("function buildRecommendationTrip");
    expect(source).toContain('{ label: "Start", value: decisionCopy.firstStep }');
    expect(source).toContain('...(bringLine ? [{ label: "Bring", value: bringLine.value }] : [])');
    expect(source).toContain('{ label: "Stop at", value: decisionCopy.stopPoint }');
    expect(source).toContain("function NextTripCard");
    expect(source).toContain("function RouteChainScroll");
    expect(source).toContain('data-route-chain-scroll="true"');
    expect(source).toContain("<RouteChainScroll rec={rec} onStart={onStart} />");
    expect(source).toContain('data-calculable-route="true"');
    expect(source).toContain("Finish the earlier route step first.");
    expect(source).toContain("rec.routeChain?.steps");
    expect(source).toContain("tripBankItems");
    expect(source).not.toContain("Copy Bank Tag");
    expect(source).not.toContain("Add bank to build a Bank Tag.");
    expect(source).toContain("Best teleport near the first step");
    expect(source).toContain("{step.label}");
    expect(source).toContain("{decisionCopy.why}");
    expect(source).toContain("function recommendationWhyNot");
    expect(source).toContain("Not picked");
    expect(source).toContain("so boss trips stay conservative.");
    expect(source).toContain("bossing stays lower unless you ask for a sweaty trip.");
    expect(source).toContain("Trip details");
    expect(source).toContain('aria-haspopup="dialog"');
  });

  it("keeps recommendation cards valid by using explicit links instead of nested card anchors", () => {
    expect(source).toContain('data-next-trip-card="true"');
    expect(source).toContain('aria-label={`${actionLabel}: ${rec.title}`}');
    expect(source).toContain("primaryAction.external ? (");
    expect(source).toContain("rel=\"noopener noreferrer\"");
    expect(source).toContain("Check kill");
    expect(source).not.toContain("<Link href={actionHref}>{card}</Link>");
    expect(source).not.toContain("<a href={actionHref} target=\"_blank\" rel=\"noopener noreferrer\">{card}</a>");
    expect(source).not.toContain("cursor-pointer transition-transform");
    expect(source).not.toContain("cursor-pointer transition-colors");
  });

  it("keeps plan inputs inside the optional make-smarter section", () => {
    expect(source).toContain("function MakePlanSmarter");
    expect(source).not.toContain("function EvidenceLedger");
    expect(source).not.toContain('data-testid="next-evidence-ledger"');
    expect(source).not.toContain("Make this smarter");
    expect(source).not.toContain("Optional: add gear or RuneLite when the pick looks off.");
    expect(source).toContain('from "@/lib/next-plan-surface"');
    expect(source).not.toContain("function makePlanSmarterCopy");
    expect(planSurfaceSource).toContain("function makePlanSmarterCopy");
    expect(planSurfaceSource).toContain("Gear, food and teleports can change the trip.");
    expect(planSurfaceSource).toContain("Add bank only when GP, gear or items should change the method.");
    expect(source).not.toContain("Better supplies, boss picks and Bank Tags.");
    expect(source).not.toContain("What shaped this");
    expect(source).toContain("Add bank");
    expect(planSurfaceSource).toContain("Want a sharper pick?");
    expect(source).not.toContain("Add supplies if needed");
    expect(source).not.toContain('bankCta: "Add supplies"');
    expect(planSurfaceSource).toContain("Add quest items");
    expect(planSurfaceSource).toContain("Add GP check");
    expect(source).not.toContain("Add bank for GP");
    expect(source).toContain("Check RuneLite");
    expect(source).not.toContain("Used for this route");
    expect(source).toContain('label="OSRS name"');
    expect(source).toContain("label={contextCopy.bankLabel}");
    expect(source).toContain('label="RuneLite"');
    expect(source).not.toContain('label: "Public checks"');
    expect(source).not.toContain("<EvidenceLedger summary={summary} pathData={pathData} bankItems={bankItems} />");
    expect(source).toContain("Use it when finished progress would change the pick.");
  });

  it("starts the result page with one plan instead of setup panels", () => {
    expect(source).toContain("Do this first");
    expect(source).toContain("function NextTripCard");
    expect(source).toContain('data-next-trip-card="true"');
    expect(source).not.toContain("<NextTripContextLine");
    expect(source).not.toContain("<AccountTimeline");
    expect(source).not.toContain("<LastSyncSummaryCard result={syncResult} />");
    expect(source).toContain("nextTripLines({ rec, hasBankContext, bankItems, accountMode })");
    expect(source).not.toContain("Session board");
    expect(source).not.toContain("Main move");
    expect(source).not.toContain("One move, two backups, the prep, blockers, bank signal and stop point.");
    expect(source).not.toContain("function SessionBoardStrip");
    expect(source).not.toContain("function sessionBoardBankSignal");
    expect(source).toContain('{ label: "Start", value: decisionCopy.firstStep }');
    expect(source).toContain('{ label: "Stop at", value: decisionCopy.stopPoint }');
    expect(source).toContain("Start this trip");
    expect(source).toContain("Open quest");
    expect(source).toContain("Set up bank");
    expect(source).toContain("Check kill");
    expect(source).toContain("function concreteMissingTripLine");
    expect(source).toContain("const bring = pickedItems.slice(0, 6).map(tripItemLabel);");
    expect(source).not.toContain("Prep needed");
    expect(source).not.toContain("Missing blockers");
    expect(source).not.toContain("Bank-ready status");
    expect(source).not.toContain("Stop point");
    expect(source).not.toContain("Skip reason");
    expect(source).not.toContain("No hard blocker found.");
    expect(source).not.toContain("No bank check yet.");
    expect(source).not.toContain("No safer backup outranks this pick right now.");
    expect(source).not.toContain("Pick a route");
    expect(source).not.toContain("Find unlock");
    expect(source).not.toContain("Nothing obvious");
    expect(source).toContain("Open unlocks");
    expect(source).toContain("Best now");
    expect(source).not.toContain("Another route");
    expect(source).not.toContain("Show ${nextRouteLabel.name}");
    expect(source).not.toContain("Pick a path");
    expect(source).not.toContain("Click an unlock, item or boss to see the exact trip.");
    expect(source).toContain("function RouteCard");
    expect(source).toContain('data-route-card="true"');
    expect(source).toContain("aria-expanded={expanded}");
    expect(source).not.toContain("routeCardPositionLabel");
    expect(source).not.toContain("Backup moves");
    expect(source).not.toContain("First step, then what logically follows.");
    expect(source).not.toContain("First this");
    expect(source).not.toContain("Then");
    expect(source).not.toContain("After that");
    expect(source).toContain("function RouteChain");
    expect(source).toContain("function RouteIdentityStrip");
    expect(source).toContain("function RoutePrimarySprite");
    expect(source).toContain("function routeIdentityForRecommendation");
    expect(source).toContain("function routeCardStatusLabel");
    expect(source).toContain("function RandomizeRoll");
    expect(source).toContain("function DiaryReadinessDetail");
    expect(source).toContain("<DiaryReadinessDetail rec={rec} rsn={actionContext.rsn ?? undefined} />");
    expect(source).toContain("ROUTE_ITEM_IDS");
    expect(source).toContain("karamjaGloves: 13103");
    expect(source).toContain("fairyRing: 20636");
    expect(source).toContain("slayerHelmet: 11864");
    expect(source).toContain("berserkerRing: 6737");
    expect(source).toContain("data-route-item-id");
    expect(source).toContain("data-route-boss-slug");
    expect(source).not.toContain("{sprite.type === \"boss\" ? `boss:${sprite.slug}` : `id:${sprite.itemId}`}");
    expect(source).not.toContain("id:{sprite.itemId}");
    expect(source).toContain('data-randomize-roll-state="rolling"');
    expect(source).toContain("routeStepBring");
    expect(source).toContain("routeMissingValue");
    expect(source).toContain("routeCardDetailLines");
    expect(source).toContain("routeChecklistLine");
    expect(source).toContain("playerRouteLine");
    expect(source).toContain("isWeakRouteLine");
    expect(source).toContain("find unlock");
    expect(source).toContain("check the missing piece");
    expect(source).not.toContain("routeWorthValue");
    expect(source).not.toContain('label="Do"');
    expect(source).not.toContain('label="Bring/check"');
    expect(source).not.toContain('label="Missing skills"');
    expect(source).not.toContain('label="Missing quests"');
    expect(source).not.toContain('label="Missing items"');
    expect(source).not.toContain('label="Tasks left"');
    expect(source).toContain("Do these next");
    expect(source).toContain("Before this sweep:");
    expect(source).toContain("Next sweep");
    expect(source).toContain("to confirm");
    expect(source).toContain("See all {remaining.length} remaining tasks");
    expect(source).toContain("Stop after {progress.stopPoint}");
    expect(source).not.toContain('label="Stop when"');
    expect(source).not.toContain('label="Worth it because"');
    expect(source).toContain("Gather one usable stack first");
    expect(source).toContain("Buy or gather one usable stack before committing.");
    expect(source).not.toContain("INTAKE_ROUTE_LENSES.map");
    expect(source).toContain("Choose a session instead");
    expect(source).toContain("Want a different kind of session?");
    expect(source).toContain("INTAKE_SESSION_CHOICES");
    expect(source).toContain("What do you feel like doing?");
    expect(source).toContain("Intense");
    expect(source).toContain("Plan best route");
    expect(source).toContain("setShowRoutePicker(true)");
    expect(source).toContain("runWithRoute(choice)");
    expect(source).not.toContain("Show ${nextRouteLabel.name}");
    expect(source).not.toContain("Session route");
    expect(source).not.toContain("Effort");
    expect(source).not.toContain("Pick ${label.name} session pace");
    expect(source).toContain("setSelectedRouteLens(choice.routeLens)");
    expect(source).toContain("sessionSkipped");
    expect(source).toContain("recordSessionSkip(current, activePick.headline)");
    expect(source).toContain("recordRecommendationMemory");
    expect(source).toContain('action: "try_another"');
    expect(source).toContain("recommendationMemoryCounts(feedback, { rsn: activeRsn })");
    expect(source).toContain("latestRecommendationMemory(feedback, { rsn: activeRsn })");
    expect(source).toContain("loadMood(activeRsn)");
    expect(source).toContain("}, activeRsn || undefined);");
    expect(source).toContain("mergedSkipCounts(sessionSkippedCounts(sessionSkipped), recentMemoryCounts)");
    expect(source).toContain("recentRejectedRecommendationMemories(feedback, { rsn: activeRsn, mood })");
    expect(source).toContain("excludedIds: [...new Set(");
    expect(source).toContain("recommendationDiversityFamily(rec)");
    expect(source).toContain("seed: `${activeRsn || bankSource}:${mood}:${minutes}:${shuffleIdx}`");
    expect(source).not.toContain("Math.random()");
    expect(source).not.toContain("randomRouteLens");
    expect(source).not.toContain("routeSwitchCopy");
    expect(source).toContain("setShuffleIdx((roll) => roll + 1)");
    expect(source).toContain("routeLens,");
    expect(source).toContain("function SessionMoodGrid");
    expect(source).toContain('data-session-mood-grid="true"');
    expect(source).toContain("SESSION_MOOD_GRID_CHOICES");
    expect(source).toContain("What are you in the mood for?");
    expect(source).toContain("Same mood, different route.");
    expect(source).toContain('label: "Surprise me"');
    expect(source).toContain("Same vibe, different route.");
    expect(source).toContain("onSurprise={moveToAnotherPlan}");
    expect(source).toContain("onPick={applySessionIntent}");
    expect(source).toContain("pickForRoute(visibleRecs, mood, minutes, routeLens, 0, routePickOptions)");
    expect(source).not.toContain("Change time or pace");
    expect(source).toContain("Choose a different vibe");
    expect(source).toContain("onSelect={selectAlternative}");
    expect(source).toContain("const fallbackRecs = activePick ? activePick.alternatives.slice(0, 2) : [];");
    expect(source).not.toContain("Use these when the main move is blocked or not the session you want.");
    expect(source).not.toContain("Backups");
    expect(source).not.toContain("Bigger alternatives if the first pick is not your mood.");
    expect(source).not.toContain("Want something else?");
    expect(source).not.toContain('aria-label="Randomize another OSRS plan"');
    expect(source).not.toContain("More unlock moves and routes");
    expect(source).toContain("More routes");
    expect(source).not.toContain("More unlocks");
    expect(source).toContain("Quests, diaries and bank checks after this trip");
    expect(source).toContain("Closest unlocks");
    expect(source).toContain("More unlock moves");
    expect(source).toContain("Routes to inspect");
    expect(source).toContain("Unlock gaps");
    expect(source).not.toContain("Route blockers worth checking");
    expect(source).toContain("Pick the route with the smallest missing step.");
    expect(source).not.toContain("Next blocker first. Completion stays secondary.");
    expect(source).not.toContain("route percent second");
    expect(source).toContain("Why this trip?");
    expect(source).toContain("What changed, what is close and how to make the pick sharper");
    expect(source).toContain("Unlock gaps");
    expect(source).not.toContain("Route blockers");
    expect(source).not.toContain("Why is this recommended?");
    expect(source).not.toContain("Route progress");
    expect(source).not.toContain("Next best actions");
    expect(source).not.toContain("Specific unlock moves");
    expect(source).not.toContain("Where you are");
    expect(source).not.toContain("Path to Max");
    expect(source).toContain("Barrows gloves route");
    expect(source).toContain("Fairy rings route");
    expect(source).toContain("Piety route");
    expect(source).toContain("Ava's assembler route");
    expect(source).toContain("Dragon defender route");
    expect(source).toContain("Quest cape route");
    expect(source).toContain("Raids prep route");
    expect(source).toContain("Slayer unlock route");
    expect(source).toContain("Quests and diaries almost ready");
    expect(source).toContain("Items missing");
    expect(source).not.toContain("Try another");
    expect(source).not.toContain("Next sessions");
    expect(source).not.toContain("Account details");
    expect(source).not.toContain("Change vibe or time");
    expect(source).not.toContain("I want to");
    expect(source).not.toContain("function SessionBrief");
    expect(source).not.toContain("<SessionBrief");
    expect(source).not.toContain("ScapestackReadinessRail");
    expect(source).not.toContain("Tonight&apos;s session brief");
    expect(source).not.toContain("Trust level");
  });

  it("makes backup cards feel like real alternatives instead of tiny rows", () => {
    expect(source).toContain("function RecRow");
    expect(source).toContain("min-h-[136px]");
    expect(source).toContain("size-16");
    expect(source).toContain("Choose a different vibe");
    expect(source).toContain("const fallbackRecs = activePick ? activePick.alternatives.slice(0, 2) : [];");
    expect(source).toContain("onClick={() => onSelect(rec)}");
    expect(source).toContain("aria-label={`Choose ${rec.title}`}");
    expect(source).not.toContain("Other things you can do");
    expect(source).not.toContain("Backup moves");
    expect(source).not.toContain("Use these when the main move is blocked or not the session you want.");
  });

  it("respects legacy route intent instead of dropping players into default mood", () => {
    expect(source).toContain("nextIntentFromSearch(initialQueryString)");
    expect(source).toContain("visibleMood(routeIntent.mood)");
    expect(source).toContain("const [initialRouteChoice, setInitialRouteChoice] = useState<InitialRouteChoice | null>(null);");
    expect(source).toContain("initialRouteChoice={initialRouteChoice}");
    expect(source).toContain("routeIntent={routeIntent}");
  });

  it("keeps plugin-origin /next intake honest before verified sync loads", () => {
    expect(source).toContain("const cameFromPlugin = useMemo");
    expect(source).toContain('params.get("from") === "plugin"');
    expect(source).toContain("cameFromPlugin={cameFromPlugin}");
    expect(source).toContain("RuneLite is optional. If it finds this RSN, Scapestack can avoid progress you already finished.");
    expect(source).toContain("Your bank stays in this browser.");
    expect(source).toContain("Free. Your bank stays in this browser.");
  });

  it("offers a simple first-run sample for new or returning players", () => {
    expect(source).toContain('const SAMPLE_LABEL = "sample plan";');
    expect(source).toContain("Try a {SAMPLE_LABEL}");
    expect(source).not.toContain("mid-game PvM sample");
  });

  it("gives plugin-origin players a concrete sync verification path", () => {
    expect(source).toContain('pluginVerifyUrlForSyncedRsn(rsn, "next"');
    expect(source).toContain("hasBankContext: hasAttachedBank");
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

  it("surfaces account mode as a player-facing decision signal", () => {
    expect(source).toContain("accountMode={summary.accountMode}");
    expect(source).toContain("<AccountModeBadge accountMode={accountMode} compact />");
    expect(source).toContain("function NextTripContextLine");
    expect(source).toContain("RSN <span");
    expect(source).toContain("function nextTripAccountModeDecisionLine");
    expect(source).toContain("Ironman: source missing items yourself before leaving.");
    expect(source).toContain("UIM: stage or carry the items before starting.");
    expect(source).toContain("GIM: check your own bank; group storage is not assumed.");
    expect(source).toContain("const beforeWithAccountMode = accountModeDecision");
    expect(source).not.toContain('label: "Account mode"');
  });

  it("lets players clear temporary bank handoff storage", () => {
    expect(source).toContain("clearBankHandoffPayload(window)");
    expect(source).toContain("Clear bank");
    expect(source).toContain("This bank stays in this browser and expires automatically.");
    expect(source).toContain("Stored bank cleared");
    expect(source).toContain('import { bankOrganizerHref } from "@/lib/bank-handoff-url";');
    expect(source).toContain('window.location.href = bankOrganizerHref(activeRsn, "next");');
  });

  it("gives hidden recommendations an immediate undo path", () => {
    expect(source).toContain("restoreRecommendation");
    expect(source).toContain("latestRecommendationFeedback");
    expect(source).toContain("function sessionMemoryNote");
    expect(source).toContain("Last time: you skipped");
    expect(source).toContain("so this plan avoids it.");
    expect(source).toContain("lastSuppressed");
    expect(source).toContain("Hidden for now:");
    expect(source).toContain("Need GP");
    expect(source).toContain("Want AFK");
    expect(source).toContain("Too hard");
    expect(source).toContain('applySessionIntent("cash", 60)');
    expect(source).toContain('applySessionIntent("afk", 60)');
    expect(source).toContain("markLastSuppressedTooHard");
    expect(source).toContain('reason: "too_hard"');
    expect(source).toContain("title: rec.title");
    expect(source).toContain("Undo hide");
    expect(source).not.toContain("aria-label={`Skip: hide ${rec.title}`}");
  });

  it("lets players mark recommendations done without calling them irrelevant", () => {
    expect(source).toContain("lastStarted");
    expect(source).toContain("const activePick = useMemo(() =>");
    expect(source).toContain("const rememberedStartedId = lastStarted?.id ?? latestStartedMemory?.id ?? null;");
    expect(source).toContain("!recentRejectedMemory.some((entry) => entry.id === rememberedStartedId)");
    expect(source).toContain("return { ...pick, headline: startedRec, alternatives };");
    expect(source).toContain("rec={activePick.headline}");
    expect(source).toContain("latestStartedRecommendationMemory(feedback, { rsn: activeRsn })");
    expect(source).toContain('action: "started"');
    expect(source).toContain("const startRecommendation = (rec: Recommendation) =>");
    expect(source).toContain("Mark trip started");
    expect(source).toContain("Started:");
    expect(source).toContain("onStart={startRecommendation}");
    expect(source).toContain("onStart: (rec: Recommendation) => void");
    expect(source).toContain("lastCompleted");
    expect(source).toContain('reason: "already_done"');
    expect(source).toContain("const completeRecommendation = (rec: Recommendation) =>");
    expect(source).toContain("Nice.");
    expect(source).toContain("Pick the next move.");
    expect(source).toContain("Next trip");
    expect(source).not.toContain("Another trip");
    expect(source).toContain("Chill now");
    expect(source).toContain('applySessionIntent("chill", 30, "completion")');
    expect(source).toContain("Undo done");
    expect(source).toContain("const moveToAnotherPlan = () =>");
    expect(source).toContain("const moveToChillPlan = () =>");
    expect(source).not.toContain("aria-label={`Done: mark ${rec.title} complete`}");
    expect(source).toContain("onComplete={completeRecommendation}");
    expect(source).toContain("onComplete: (rec: Recommendation) => void");
  });

  it("labels backups as real player choices instead of leftover rows", () => {
    expect(source).toContain("function backupChoicePrompt");
    expect(source).toContain("Need GP?");
    expect(source).toContain("Too sweaty?");
    expect(source).toContain("Want chill?");
    expect(source).toContain("Want action?");
    expect(source).toContain("Prefer unlock?");
    expect(source).toContain("backupPrompt={backupChoicePrompt(rec, activePick.headline)}");
    expect(source).toContain("onSelect={selectAlternative}");
    expect(source).toContain("backupPrompt?: { label: string; helper: string }");
  });

  it("keeps top actions focused without copy-plan or screenshot controls", () => {
    expect(source).not.toContain("shareMode");
    expect(source).not.toContain("onShareModeChange");
    expect(source).not.toContain("Screenshot mode");
    expect(source).not.toContain("Exit clean shot");
    expect(source).not.toContain("data-screenshot-mode={shareMode ? \"true\" : undefined}");
    expect(source).not.toContain('document.body.classList.add("scapestack-clean-shot")');
    expect(source).not.toContain('aria-label="Copy top OSRS plan"');
    expect(source).not.toContain("sessionCopyState");
    expect(source).not.toContain("Copy plan");
    expect(source).not.toContain("Share dashboard");
  });

  it("keeps account-stage and RuneLite context subtle instead of repeating it in cards", () => {
    expect(source).toContain("accountStage={summary.accountStage}");
    expect(source).toContain("accountStage: NextUpResult[\"summary\"][\"accountStage\"]");
    expect(source).toContain("accountStage: NextUpResult[\"summary\"][\"accountStage\"]");
    expect(source).not.toContain("function playerStageTip");
    expect(source).not.toContain('label: "For you"');
    expect(source).not.toContain("RuneLite already helps skip finished stuff. Trust the stop point, then sync again after progress.");
    expect(source).toContain("accountStage={summary.accountStage}");
    expect(source).toContain("Last scan:");
    expect(source).toContain("Finished quests, diary steps, clog slots and Slayer mistakes are skipped.");
    expect(source).not.toContain("RuneLite is old. Refresh before a long grind or GP spend.");
    expect(source).toContain("RuneLite can improve picks later.");
    expect(source).toContain("function runeLitePlanNote");
    expect(source).not.toContain("function scapestackNotice");
    expect(source).not.toContain("Scapestack noticed:");
    expect(source).not.toContain("Bossing stays backup while this route has the cleaner stop point.");
    expect(source).not.toContain("KC stays a test trip, not the main grind.");
    expect(source).not.toContain("No gear pasted, so the trip stays conservative.");
    expect(source).toContain('const DEFAULT_MOOD: Mood = "unlock";');
    expect(source).toContain('if (mood === "focused") return "bossing";');
    expect(source).not.toContain("RuneLite evidence dashboard");
    expect(source).not.toContain("function accountArchetypeCopy");
  });

  it("keeps recommendation feedback inside the focused trip details sheet", () => {
    expect(source).not.toContain("function recommendationFeedbackButtonClass");
    expect(source).toContain("Trip details");
    expect(source).toContain('role="dialog"');
    expect(source).toContain("Mark trip started");
    expect(source).toContain("Mark done");
    expect(source).toContain("Less like this");
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
    expect(source).toContain("Using the bank you just organised");
    expect(source).toContain("Plan with this bank");
    expect(source).toContain("bankItems: fromBank.items");
    expect(source).toContain("routeLens: selectedRouteLens");
    expect(source).toContain("disabled={loading}");
    expect(source).toContain("Add your OSRS name for stats and KC, or start with this bank alone.");
  });

  it("keeps optional bank paste inside a compact popup", () => {
    expect(source).toContain('aria-label={hasAttachedBank ? "Edit attached bank" : "Add bank paste"}');
    expect(source).toContain('import { AddBankModal } from "@/components/add-bank-modal";');
    expect(source).toContain("<AddBankModal");
    expect(source).toContain("open={showBankField}");
    expect(source).toContain('source="next"');
    expect(source).toContain("onSaved={(savedBank) => setBank(savedBank)}");
    expect(source).toContain("const hasAttachedBank = Boolean(fromBank || attachedBank);");
    expect(source).toContain("input: attachedBank || undefined");
    expect(source).not.toContain('placeholder="Paste Bank Memory or Bank Tags here..."');
    expect(source).not.toContain("Gear paste");
  });

  it("explains why the /next submit CTA is disabled", () => {
    expect(source).toContain('aria-describedby="next-show-me-disabled-help"');
    expect(source).toContain('id="next-show-me-disabled-help"');
    expect(source).toContain("Enter an OSRS name to get one clear next move.");
    expect(source).toContain("Bank added. Add a name for stats and KC.");
    expect(source).not.toContain("gear-only plan");
  });

  it("shows when bank context and RuneLite sync are fused", () => {
    expect(source).toContain("const pluginSyncSummary = result.pathProgress.syncedSources?.scapestack");
    expect(source).toContain("summarizeNextPluginSync(result.pathProgress.syncedSources.scapestack)");
    expect(source).toContain("const pluginSyncState = pluginSyncSummary?.state ?? null;");
    expect(source).toContain("pluginSyncState={pluginSyncState}");
    expect(source).toContain("pluginSyncSummary={pluginSyncSummary}");
    expect(source).toContain("bankSource={bankSource}");
    expect(source).toContain("bankSource: NextBankSource");
    expect(source).toContain('pluginSyncState: "live" | "stale" | "outdated" | null;');
    expect(source).toContain("pluginSyncSummary: NextPluginSyncSummary | null;");
    expect(source).toContain("const hasLivePluginSync = pluginSyncState === \"live\";");
    expect(source).toContain("const isPluginBank = bankSource === \"plugin\";");
    expect(source).toContain("const bankLabel = isPluginBank");
    expect(source).toContain("RuneLite bank");
    expect(source).toContain("RuneLite bank is shaping gear, supplies and GP for this plan.");
    expect(source).toContain("RuneLite sent your bank items and quantities. Press Sync again when your bank changes.");
    expect(source).toContain("Bank and finished progress are both shaping this pick.");
    expect(source).not.toContain("verified RuneLite account payload");
    expect(source).toContain("RuneLite is connected, but update it before trusting newer details.");
    expect(source).toContain("{bankLabel}");
    expect(source).toContain("Bank + RuneLite");
    expect(source).not.toContain("Exact fusion");
    expect(source).toContain("Update RuneLite");
  });

  it("turns the main pick into a compact trip builder when gear exists", () => {
    expect(source).toContain('import { exportTag } from "@/lib/bank-tags";');
    expect(source).toContain("const TRIP_BANK_KEYWORDS");
    expect(source).toContain("const pickedItems = hasBankContext ? tripBankItems(bankItems, keywordGroups, 18) : [];");
    expect(source).toContain("const tagItems = needsCombat");
    expect(source).toContain("exportTag({");
    expect(source).toContain("items: tagItems.map((item) => ({ id: item.id }))");
    expect(source).toContain('data-next-trip-card="true"');
    expect(source).toContain("nextTripLines({ rec, hasBankContext, bankItems, accountMode })");
    expect(source).not.toContain("<TripBuilder rec={rec} bankItems={bankItems} hasBankContext={hasBankContext} maxEstimate={maxEstimate} />");
    expect(source).not.toContain("Show exact items");
    expect(source).not.toContain("Show banked skilling stack");
    expect(source).not.toContain("Bring list, teleport and Bank Tag.");
    expect(source).not.toContain("Prep this trip");
    expect(source).not.toContain("What do I need?");
    expect(source).not.toContain("Bring, teleport, stop point.");
    expect(source).not.toContain("Build trip");
    expect(source).not.toContain('aria-label={`Copy RuneLite Bank Tag for ${rec.title}`}');
    expect(source).not.toContain("Bank Tag copied");
    expect(source).not.toContain("Trip payload");
    expect(source).not.toContain("Bank Tag dashboard");
  });

  it("turns skilling maxing picks into bank-aware XP progress", () => {
    expect(source).toContain("skillingBankSummaryForSkill(recommendationSkillLabel(rec), bankItems, maxEstimate)");
    expect(source).not.toContain("function skillingBankSummaryForRecommendation");
    expect(source).not.toContain("const SKILL_BANK_XP");
    expect(planSurfaceSource).toContain("function skillingBankSummaryForSkill");
    expect(planSurfaceSource).toContain("BANKED_XP_SKILL_DESCRIPTORS");
    expect(source).toContain("function savedBankForRun");
    expect(source).toContain("heroBank = savedBankForRun(heroRsn.trim(), activeAccountRsn)?.banktags;");
    expect(source).toContain("input: savedBankForRun(activeAccountRsn)?.banktags");
    expect(bankedXpSource).toContain("raw shark");
    expect(bankedXpSource).toContain("dragon bones");
    expect(bankedXpSource).toContain("mahogany plank");
    expect(bankedXpSource).toContain("broad arrowheads");
    expect(bankedXpSource).toContain("gold ore");
    expect(bankedXpSource).toContain("ranarr potion (unf)");
    expect(bankedXpSource).toContain("pure essence");
    expect(bankedXpSource).toContain("magic seed");
    expect(bankedXpSource).toContain('skill: "Fishing"');
    expect(bankedXpSource).toContain('skill: "Woodcutting"');
    expect(bankedXpSource).toContain('skill: "Mining"');
    expect(bankedXpSource).toContain('skill: "Hunter"');
    expect(planSurfaceSource).toContain("neededAfterBankLabel");
    expect(planSurfaceSource).toContain("estimateBankedXp({");
    expect(planSurfaceSource).toContain("Need about ${Math.ceil(remainingAfterBank / xpPerBestMaterial).toLocaleString()} more ${bestMaterial.name}");
    expect(source).toContain("Bank has ${summary.bankItemsLabel}. Use that method;");
    expect(source).not.toContain("{skillingSummary.skill} route");
    expect(source).not.toContain("Need:");
    expect(source).not.toContain("Use:");
    expect(source).not.toContain("Stop:");
    expect(source).not.toContain("No ${config.suppliesLabel} found in this bank");
    expect(planSurfaceSource).toContain("This bank does not cover the chosen skilling method yet");
    expect(source).toContain("skillConfig.keywords");
    expect(source).not.toContain("${skillConfig.suppliesLabel} stack");
  });

  it("uses real Scapestack sync skills and bank items before falling back to empty context", () => {
    expect(source).toContain("function syncedSkillsToHiscoreSkills");
    expect(source).toContain("hiscores?.skills ?? syncedSkillsToHiscoreSkills(scapestackSync?.skills)");
    expect(source).toContain("markAccountPluginBankStatus(rsn, scapestackSync.bankStatus)");
    expect(source).toContain("const usePluginBank = shouldUsePluginBank({");
    expect(source).toContain('const hasManualBankOverride = bankSource === "browser" || bankSource === "handoff";');
    expect(source).toContain("if (usePluginBank && scapestackSync?.bankItems?.length)");
    expect(source).toContain('bankHandoffItemsFromBankItems(bank, "RuneLite bank sync")');
    expect(source).toContain('const LazyBossDetailModal = dynamic(() => import("@/components/lazy-boss-detail-modal")');
    expect(source).toContain("bossSlug={modalBossSlug}");
    expect(source).not.toContain("ownedGear(asOrganizedItems(bank))");
    expect(source).toContain('bankSource = "plugin";');
    expect(source).toContain("setActiveBankSource(bankSource)");
  });
});
