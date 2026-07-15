import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/hero-intake.tsx"), "utf8");

describe("hero intake copy and routing", () => {
  it("marks RSN-only homepage runs as bankless while allowing bank-only starts", () => {
    expect(source).toContain("const hasBankPaste = Boolean(bank.trim())");
    expect(source).toContain("const canSubmit = Boolean(rsn.trim() || hasBankPaste)");
    expect(source).toContain("if (trimmed) {");
    expect(source).toContain("setShowFirstSetup(true);");
    expect(source).toContain("hasAccountFirstSetupSeen(trimmed)");
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
    expect(source).toContain("setRememberedRuneliteCheckedAt(null);");
    expect(source).toContain("setRuneliteRefresh(\"idle\");");
    expect(source).toContain("setEditingAccount(false);");
    expect(source).toContain("const [editingAccount, setEditingAccount] = useState(false);");
    expect(source).toContain("const [rememberedRuneliteCheckedAt, setRememberedRuneliteCheckedAt] = useState<number | null>(null);");
    expect(source).toContain("const [rememberedPluginBankItems, setRememberedPluginBankItems] = useState(0);");
    expect(source).toContain("const [runeliteRefresh, setRuneliteRefresh] = useState<\"idle\" | \"checking\" | \"found\" | \"missing\" | \"error\">(\"idle\");");
    expect(source).toContain("const [returningMood, setReturningMood] = useState<{ mood: Mood; minutes: TimeBudget; label: string } | null>(null);");
    expect(source).toContain("const [returningChangeLines, setReturningChangeLines] = useState<string[]>([]);");
    expect(source).toContain("if (isRememberedRun && !editingAccount)");
    expect(source).toContain("latestStartedRecommendationMemory(undefined, { rsn: remembered })");
    expect(source).toContain("latestRecommendationMemory(undefined, { rsn: remembered })");
    expect(source).toContain("setReturningChangeLines(lines.slice(0, 3));");
    expect(source).toContain("const planHref = returningMood");
    expect(source).toContain('`/next?rsn=${encodedRsn}&intent=${encodeURIComponent(returningMood.mood)}&time=${returningMood.minutes}`');
    expect(source).toContain("const runeliteStatusLabel = shouldRefreshRunelite");
    expect(source).toContain("formatRuneliteCheckedAt(rememberedRuneliteCheckedAt)");
    expect(source).toContain("pluginSyncStatusAction(target)");
    expect(source).toContain("markRuneliteChecked(target, checkedAt)");
    expect(source).toContain("markAccountPluginBankStatus(target, next.player.bankStatus)");
    expect(source).toContain("RuneLite bank: ${rememberedPluginBankItems.toLocaleString()} stacks");
    expect(source).toContain("clearRuneliteChecked(target)");
    expect(source).toContain("function formatSavedBankAt(value: number | null): string");
    expect(source).toContain("Bank saved just now");
    expect(source).toContain("Add bank if gear matters");
    expect(source).toContain("Open bank in RuneLite");
    expect(source).toContain("RuneLite refreshed.");
    expect(source).toContain("No fresh sync yet. Open RuneLite, press Sync now, then refresh.");
    expect(source).toContain("Refresh RuneLite");
    expect(source).toContain('returningMood ? `Vibe: ${returningMood.label}` : "Vibe: Best now"');
    expect(source).toContain("Welcome back");
    expect(source).toContain("Open today&apos;s trip for {rememberedRsn}.");
    expect(source).toContain("Scapestack will use the saved setup it can trust, then send you to one clear stop point.");
    expect(source).toContain("What changed since last time");
    expect(source).toContain("Last trip started: ${started.title}.");
    expect(source).toContain("Last scan: ${relativeSince(active.runeliteCheckedAt)}.");
    expect(source).toContain("Last vibe: ${MOOD_LABEL[savedMood.mood].name}.");
    expect(source).toContain("ReturningSetupLine");
    expect(source).toContain("const bankStatusLabel = savedBankAt");
    expect(source).toContain('text={bankStatusLabel}');
    expect(source).toContain('text={returningMood ? `${returningMood.label} vibe saved` : "Best now vibe"}');
    expect(source).not.toContain("UserRound");
    expect(source).toContain("Open today&apos;s trip");
    expect(source).toContain("bankSetupLabel(hasBankContext, rememberedRuneliteChecked)");
    expect(source).toContain("Boss");
    expect(source).toContain("RuneLite");
    expect(source).toContain("Change RSN");
    expect(source).toContain("CheckCircle2");
    expect(source).toContain("RefreshCw");
    expect(source).toContain('aria-label={`Refresh RuneLite sync for ${rememberedRsn}`}');
    expect(source).toContain("wide");
    expect(source).toContain("onMoodChange={setReturningMood}");
  });

  it("shows first-time setup before the first /next plan", () => {
    expect(source).toContain('type FirstSetupIntent = "surprise" | "chill" | "cash" | "bossing" | "unlock" | "afk" | "short";');
    expect(source).toContain("const FIRST_SETUP_INTENTS:");
    expect(source).toContain('label: "Chill"');
    expect(source).toContain('label: "GP"');
    expect(source).toContain('label: "Bossing"');
    expect(source).toContain('label: "Unlock"');
    expect(source).toContain('label: "AFK"');
    expect(source).toContain('label: "Short"');
    expect(source).toContain("function markFirstSetupSeen(rsn: string): void");
    expect(source).toContain("markAccountFirstSetupSeen(rsn);");
    expect(source).toContain("if (!hasAccountFirstSetupSeen(trimmed))");
    expect(source).toContain("const [showFirstSetup, setShowFirstSetup] = useState(false);");
    expect(source).toContain('const [selectedFirstSetupIntent, setSelectedFirstSetupIntent] = useState<FirstSetupIntent>("surprise");');
    expect(source).toContain('aria-labelledby="hero-first-setup-title"');
    expect(source).toContain('label: "Best now"');
    expect(source).toContain("Before we pick");
    expect(source).toContain("What do you feel like doing?");
    expect(source).toContain("Pick a route. Add bank or RuneLite now only if you want the first plan sharper.");
    expect(source).toContain("setSelectedFirstSetupIntent(choice.intent)");
    expect(source).toContain("Add RuneLite plugin");
    expect(source).toContain("RuneLite selected");
    expect(source).toContain("Plan this session");
    expect(source).toContain("Skip setup");
    expect(source).toContain("markFirstSetupSeen(trimmed)");
    expect(source).not.toContain("markRuneliteChecked(trimmed)");
    expect(source).toContain("saveMood({");
    expect(source).toContain("}, trimmed || undefined);");
    expect(source).toContain("if (options.includeSetupIntent) {");
    expect(source).toContain('params.set("intent", selectedFirstSetupIntent);');
    expect(source).toContain('params.set("time", String(intentPreset.minutes));');
    expect(source).toContain("openPlan({ markSetup: true, includeSetupIntent: true })");
    expect(source).toContain("saveSavedBank(bank, trimmed)");
    expect(source).toContain("AddBankModal");
    expect(source).not.toContain("RuneLite is connected");
    expect(source).not.toContain("Make {cleanRsn || \"this account\"} smarter?");
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
    expect(source).toContain("loadSavedBank");
    expect(source).toContain("SAVED_BANK_EVENT");
    expect(source).toContain("const hasBankContext = hasBankPaste || Boolean(savedBankAt) || rememberedPluginBankItems > 0;");
    expect(source).toContain("aria-expanded={showBankGuide}");
    expect(source).toContain('aria-label={hasBankContext ? "Edit bank paste for Scapestack" : "Add bank to Scapestack"}');
    expect(source).toContain('aria-label="Remove pasted bank from this plan"');
    expect(source).toContain("<AddBankModal");
    expect(source).toContain("open={showBankGuide}");
    expect(source).toContain('source="home"');
    expect(source).toContain("onSaved={(savedBank, savedRsn) =>");
    expect(source).toContain("setBank(savedBank);");
    expect(source).toContain("setSavedBankAt(Date.now());");
    expect(source).toContain("Bank saved for this account. Scapestack can use it when gear matters.");
    expect(source).toContain('aria-labelledby="hero-runelite-guide-title"');
    expect(source).toContain("Let Scapestack skip finished stuff.");
    expect(source).toContain("Search Plugin Hub for Scapestack Sync.");
    expect(source).not.toContain('aria-label="Optional bank paste"');
    expect(source).not.toContain("Hide bank");
  });
});
