import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/hero-intake.tsx"), "utf8");
const nextSource = readFileSync(join(process.cwd(), "src/app/next/next-client.tsx"), "utf8");

describe("hero intake copy and routing", () => {
  it("marks RSN-only homepage runs as bankless while allowing bank-only starts", () => {
    expect(source).toContain("const hasBankPaste = Boolean(bank.trim())");
    expect(source).toContain("const canSubmit = Boolean(rsn.trim() || hasBankPaste)");
    expect(source).toContain("const firstRun = Boolean(trimmed && !hasAccountFirstSetupSeen(trimmed));");
    expect(source).toContain("openPlan({ firstRun });");
    expect(source).toContain('if (!hasBankContext) params.set("bank", "none");');
    expect(source).toContain("router.push(`/next?${params.toString()}`)");
  });

  it("uses the three homepage CTAs requested by the product prompt", () => {
    expect(source).toContain("Plan my next move");
    expect(source).toContain("Continue as ${rememberedRsn}");
    expect(source).toContain("Add bank");
    expect(source).toContain("RuneLite later");
    expect(source).toContain('aria-label="Show RuneLite plugin setup"');
    expect(source).toContain("RuneliteOpenButton");
    expect(source).toContain("Plan my next trip with this bank");
    expect(source).toContain("Bank added");
  });

  it("turns the homepage account-first when an RSN is already saved", () => {
    expect(source).toContain("ACCOUNT_EVENT");
    expect(source).toContain("refreshRememberedAccount");
    expect(source).toContain("window.addEventListener(ACCOUNT_EVENT, refreshRememberedAccount)");
    expect(source).toContain("setRememberedRsn(\"\");");
    expect(source).toContain("setRuneliteRefresh(\"idle\");");
    expect(source).toContain("const [rememberedPluginBankItems, setRememberedPluginBankItems] = useState(0);");
    expect(source).toContain("const [runeliteRefresh, setRuneliteRefresh] = useState<\"idle\" | \"checking\" | \"found\" | \"missing\" | \"error\">(\"idle\");");
    expect(source).toContain("const [returningMoments, setReturningMoments] = useState<AccountTimelineMoment[]>([]);");
    expect(source).toContain("const [returningFallback, setReturningFallback] = useState<ReturnHomeFallback>({});");
    expect(source).toContain("const [accountSnapshot, setAccountSnapshot] = useState<AccountSnapshot | null>(null);");
    expect(source).toContain("const snapshot = loadAccountSnapshot();");
    expect(source).toContain("setAccountSnapshot(snapshot);");
    expect(source).toContain("const remembered = snapshot.rsn;");
    expect(source).toContain("setRememberedPluginBankItems(snapshot.pluginBankItemCount);");
    expect(source).toContain("if (isRememberedRun)");
    expect(source).toContain("latestStartedRecommendationMemory(undefined, { rsn: remembered })");
    expect(source).toContain("latestRecommendationMemory(undefined, { rsn: remembered })");
    expect(source).toContain("snapshot.runeliteProgressTitle");
    expect(source).toContain("snapshot.runeliteProgressLead");
    expect(source).toContain("buildReturnHomeSummary");
    expect(source).toContain("hydrateConnectedAccount()");
    expect(source).toContain('fetch("/api/account/timeline?limit=10"');
    expect(source).toContain("const planHref = accountSnapshot?.planHref");
    expect(source).toContain("pluginSyncStatusAction(target)");
    expect(source).toContain("markRuneliteChecked(target, checkedAt)");
    expect(source).toContain("markAccountPluginBankStatus(target, next.player.bankStatus)");
    expect(source).toContain("const snapshot = loadAccountSnapshot(target);");
    expect(source).not.toContain("next.player.lastSyncSummary");
    expect(source).not.toContain("runeliteProgressFromSyncSummary");
    expect(source).toContain("clearRuneliteChecked(target)");
    expect(source).toContain("RuneLite refreshed.");
    expect(source).toContain("No fresh sync yet. Open RuneLite, press Sync now, then refresh.");
    expect(source).toContain("Welcome back, {rememberedRsn}");
    expect(source).toContain("{returnSummary.headline}");
    expect(source).toContain("{returnSummary.detail}");
    expect(source).toContain("{returnSummary.stopPoint}");
    expect(source).toContain("Plan next trip");
    expect(source).toContain("autoRuneliteCheckRef");
    expect(source).toContain("checkRuneliteForRsn(target, { showChecking: false })");
    expect(source).toContain('data-return-home="true"');
    expect(source).toContain("Refresh RuneLite before a long trip");
    expect(source).toContain("CheckCircle2");
    expect(source).toContain("RefreshCw");
    expect(source).toContain('aria-label={`Refresh RuneLite sync for ${rememberedRsn}`}');
    expect(source).toContain("localStorage.setItem(returnSeenKey(rememberedRsn), returnSummary.latestMomentId)");
    expect(source).not.toContain("ReturningSetupLine");
    expect(source).not.toContain("SessionMoodPicker");
    expect(source).not.toContain("Change RSN");
  });

  it("delivers the first plan before optional setup", () => {
    expect(source).toContain("if (options.firstRun) markAccountFirstSetupSeen(trimmed);");
    expect(source).toContain('if (options.firstRun) params.set("first", "1");');
    expect(source).toContain("saveSavedRsn(trimmed)");
    expect(source).toContain("saveSavedBank(bank, trimmed)");
    expect(source).toContain("AddBankModal");
    expect(source).not.toContain("showFirstSetup");
    expect(source).not.toContain("FIRST_SETUP_INTENTS");
    expect(source).not.toContain("Plan this session");
    expect(nextSource).toContain("runWithRoute();");
    expect(nextSource).toContain("Choose a session instead");
    expect(nextSource).toContain("Your first plan is ready.");
    expect(nextSource).toContain("Sharpen next plan");
    expect(nextSource).toContain("Make the next pick sharper");
    expect(nextSource).toContain("sessionStorage.setItem(key, \"1\")");
    expect(nextSource).toContain("<AddBankModal");
    expect(nextSource).toContain("Add RuneLite");
  });

  it("explains why the hero planner CTA is disabled", () => {
    expect(source).toContain('aria-describedby="hero-plan-disabled-help"');
    expect(source).toContain('id="hero-plan-disabled-help"');
    expect(source).toContain("Enter an OSRS name to get one clear trip.");
    expect(source).toContain("Add a name for stats and KC.");
    expect(source).toContain("One name is enough to plan your next trip.");
    expect(source).not.toContain("public stats are enough for a first trip");
    expect(source).not.toContain("setup-only route");
  });

  it("labels the homepage RSN input as a real OSRS-name field", () => {
    expect(source).toContain('htmlFor="hero-rsn-input"');
    expect(source).toContain("OSRS name for /next planning");
    expect(source).toContain('id="hero-rsn-input"');
    expect(source).toContain('name="rsn"');
    expect(source).toContain('autoComplete="off"');
    expect(source).toContain("spellCheck={false}");
  });

  it("treats optional bank paste as an explicit setup-context control", () => {
    expect(source).toContain('import { AddBankModal } from "@/components/add-bank-modal";');
    expect(source).toContain("loadAccountSnapshot");
    expect(source).toContain("SAVED_BANK_EVENT");
    expect(source).toContain("const hasBankContext = hasBankPaste || Boolean(accountSnapshot?.hasBankContext) || Boolean(savedBankAt) || rememberedPluginBankItems > 0;");
    expect(source).toContain("aria-expanded={showBankGuide}");
    expect(source).toContain('aria-label={hasBankContext ? "Edit bank paste for Scapestack" : "Add bank to Scapestack"}');
    expect(source).toContain('aria-label="Remove pasted bank from this plan"');
    expect(source).toContain("<AddBankModal");
    expect(source).toContain("open={showBankGuide}");
    expect(source).toContain('source="home"');
    expect(source).toContain("onSaved={(savedBank, savedRsn) =>");
    expect(source).toContain("setBank(savedBank);");
    expect(source).toContain("setSavedBankAt(Date.now());");
    expect(source).toContain("${accountSnapshot.bankLabel}. Scapestack can use it when gear matters.");
    expect(source).toContain('aria-labelledby="hero-runelite-guide-title"');
    expect(source).toContain("Let Scapestack skip finished stuff.");
    expect(source).toContain("Search Plugin Hub for Scapestack Sync.");
    expect(source).not.toContain('aria-label="Optional bank paste"');
    expect(source).not.toContain("Hide bank");
  });
});
