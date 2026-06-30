import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/hero-intake.tsx"), "utf8");

describe("hero intake copy and routing", () => {
  it("marks RSN-only homepage runs as bankless while allowing bank-only starts", () => {
    expect(source).toContain("const hasBankPaste = Boolean(bank.trim())");
    expect(source).toContain("const canSubmit = Boolean(rsn.trim() || hasBankPaste)");
    expect(source).toContain("if (trimmed && !hasSeenFirstSetup(trimmed))");
    expect(source).toContain("setShowFirstSetup(true);");
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

  it("shows first-time setup before the first /next plan", () => {
    expect(source).toContain('const HERO_FIRST_SETUP_KEY = "scapestack:first-setup:v1";');
    expect(source).toContain('type FirstSetupIntent = "surprise" | "chill" | "cash" | "bossing" | "unlock" | "afk" | "short";');
    expect(source).toContain("const FIRST_SETUP_INTENTS:");
    expect(source).toContain('label: "Chill"');
    expect(source).toContain('label: "GP"');
    expect(source).toContain('label: "Bossing"');
    expect(source).toContain('label: "Unlock"');
    expect(source).toContain('label: "AFK"');
    expect(source).toContain('label: "Short"');
    expect(source).toContain("function setupKeyForRsn(rsn: string): string");
    expect(source).toContain("function hasSeenFirstSetup(rsn: string): boolean");
    expect(source).toContain("function markFirstSetupSeen(rsn: string): void");
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
    expect(source).toContain("markRuneliteChecked(trimmed)");
    expect(source).toContain("saveMood({");
    expect(source).toContain("}, trimmed || undefined);");
    expect(source).toContain("if (options.includeSetupIntent) {");
    expect(source).toContain('params.set("intent", selectedFirstSetupIntent);');
    expect(source).toContain('params.set("time", String(intentPreset.minutes));');
    expect(source).toContain("openPlan({ markSetup: true, includeSetupIntent: true })");
    expect(source).toContain("saveSavedBank(bank, trimmed)");
    expect(source).toContain("Saved for this account and used for the first plan.");
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
    expect(source).toContain('const HERO_BANK_TEXTAREA_ID = "hero-bank-paste";');
    expect(source).toContain('const HERO_BANK_HELP_ID = "hero-bank-paste-help";');
    expect(source).toContain("loadSavedBank");
    expect(source).toContain("SAVED_BANK_EVENT");
    expect(source).toContain("const hasBankContext = hasBankPaste || Boolean(savedBankAt);");
    expect(source).toContain("aria-expanded={showBankGuide}");
    expect(source).toContain('aria-label={hasBankContext ? "Edit bank paste for Scapestack" : "Add bank to Scapestack"}');
    expect(source).toContain('aria-label="Remove pasted bank from this plan"');
    expect(source).toContain('aria-labelledby="hero-bank-guide-title"');
    expect(source).toContain('name="bank"');
    expect(source).toContain("aria-labelledby={`${HERO_BANK_TEXTAREA_ID}-label`}");
    expect(source).toContain("aria-describedby={HERO_BANK_HELP_ID}");
    expect(source).toContain("Bank added. Gear, supplies and GP can shape the trip.");
    expect(source).toContain("Bank saved for this account. Scapestack can use it when gear matters.");
    expect(source).toContain("Optional. Add this only when gear, supplies or GP should change the answer.");
    expect(source).toContain('role="dialog"');
    expect(source).toContain("Paste your bank once.");
    expect(source).toContain("Use this bank");
    expect(source).toContain("Skip bank");
    expect(source).toContain("BankSetupSteps");
    expect(source).toContain('aria-labelledby="hero-runelite-guide-title"');
    expect(source).toContain("Let Scapestack skip finished stuff.");
    expect(source).toContain("Search Plugin Hub for Scapestack Sync.");
    expect(source).not.toContain('aria-label="Optional bank paste"');
    expect(source).not.toContain("Hide bank");
  });
});
