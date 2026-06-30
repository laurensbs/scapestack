import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const intakeSource = readFileSync(join(process.cwd(), "src/components/intake.tsx"), "utf8");
const introSource = readFileSync(join(process.cwd(), "src/components/intro.tsx"), "utf8");

describe("bank intake UX affordances", () => {
  it("keeps stable ids for onboarding jump actions", () => {
    expect(intakeSource).toContain('id="bank-paste-input"');
    expect(intakeSource).toContain('data-testid="bank-paste-input"');
    expect(intakeSource).toContain('id="bank-organize-button"');
    expect(introSource).toContain("actionTargetId: \"bank-paste-input\"");
    expect(introSource).toContain("actionTargetId: \"bank-organize-button\"");
    expect(introSource).toContain("scrollIntoView({ behavior: \"smooth\", block: \"center\" })");
  });

  it("keeps bank export onboarding distinct from Scapestack Sync", () => {
    expect(introSource).toContain('short: "Bank Memory"');
    expect(introSource).toContain("RuneLite sync is separate");
    expect(introSource).toContain("skip finished quests, diaries, clog and Slayer");
    expect(introSource).not.toContain('short: "Install plugin"');
  });

  it("makes each onboarding step visibly actionable and accessible", () => {
    expect(introSource).toContain("helperLabel: \"Open Bank Memory page\"");
    expect(introSource).toContain("https://runelite.net/plugin-hub/show/bank-memory");
    expect(introSource).toContain("helperLabel: \"Bank Tags import help\"");
    expect(introSource).toContain("https://github.com/runelite/runelite/wiki/Bank-Tags");
    expect(introSource).toContain("aria-label={`Show bank setup step ${step.n}: ${step.title}`}");
    expect(introSource).toContain("aria-label={`${steps[active].helperLabel} for step ${steps[active].n}`}");
    expect(introSource).toContain("aria-label={`Next bank setup step ${steps[active + 1].n}: ${steps[active + 1].title}`}");
  });

  it("keeps onboarding illustrations on the Scapestack route brand", () => {
    expect(introSource).toContain("Scapestack route palette");
    expect(introSource).toContain('fill="var(--color-accent)"');
    expect(introSource).toContain('id="copy-route"');
    expect(introSource).toContain('stroke="var(--color-accent)"');
    expect(introSource).toContain('fill="var(--color-accent)" fontWeight="600">RuneLite</text>');
    expect(introSource).not.toContain("copy-glow");
    expect(introSource).not.toContain("Linear/Vercel");
  });

  it("summarizes the detected bank format before organize", () => {
    expect(intakeSource).toContain("function summarizeInput");
    expect(intakeSource).toContain("Quick bank item list");
    expect(intakeSource).toContain("Full bank with quantities");
    expect(intakeSource).toContain("Item list pasted");
    expect(intakeSource).toContain('data-testid="bank-input-summary"');
    expect(intakeSource).not.toContain("item rows");
    expect(intakeSource).not.toContain("layout exact");
    expect(intakeSource).not.toContain("value sorting enabled");
  });

  it("labels the bank paste box as a browser-only import surface", () => {
    expect(intakeSource).toContain("BankSetupSteps");
    expect(intakeSource).toContain("How to copy your bank");
    expect(intakeSource).toContain('<BankSetupSteps className="mt-3" compact showBankExample={compactSave} />');
    expect(intakeSource).toContain('htmlFor="bank-paste-input"');
    expect(intakeSource).toContain("Paste RuneLite Bank Memory, Bank Tags or item IDs");
    expect(intakeSource).toContain('name="bank-export"');
    expect(intakeSource).toContain("spellCheck={false}");
    expect(intakeSource).toContain('aria-describedby="bank-paste-help bank-paste-status"');
    expect(intakeSource).toContain('id="bank-paste-help"');
    expect(intakeSource).toContain('id="bank-paste-status"');
    expect(intakeSource).toContain('role="status"');
    expect(intakeSource).toContain("Saved on this device only. Bank Memory is best for supplies and GP.");
    expect(intakeSource).toContain("No bank export detected yet.");
  });

  it("saves a detected bank immediately so the global run bar does not stay on Add bank", () => {
    expect(intakeSource).toContain("import { saveSavedBank, saveSavedRsn } from \"@/lib/saved-bank\";");
    expect(intakeSource).toContain("const lastAutoSavedRef = useRef(\"\");");
    expect(intakeSource).toContain("if (!pasteDone) return;");
    expect(intakeSource).toContain("saveSavedBank(value, targetRsn || null);");
    expect(intakeSource).toContain("if (targetRsn) saveSavedRsn(targetRsn);");
    expect(intakeSource).toContain("Use for next plan");
    expect(intakeSource).toContain("Check bosses");
    expect(intakeSource).toContain("Organize tabs");
    expect(intakeSource).toContain("compactSave");
    expect(intakeSource).toContain("Save bank");
    expect(intakeSource).toContain("Save pasted bank to this device");
    expect(intakeSource).toContain('data-testid="bank-compact-receipt"');
    expect(intakeSource).toContain("Edit paste");
    expect(intakeSource).toContain("Good for gear, supplies and kill checks.");
    expect(intakeSource).toContain("showCompactReceipt");
    expect(intakeSource).toContain("onPaste={() =>");
    expect(intakeSource).toContain("window.setTimeout(() => setCompactPasteOpen(false), 0);");
  });

  it("explains paste button failures instead of failing silently", () => {
    expect(intakeSource).toContain('useState<"idle" | "pasted" | "empty" | "blocked">("idle")');
    expect(intakeSource).toContain("Pasted from clipboard.");
    expect(intakeSource).toContain("Clipboard was empty");
    expect(intakeSource).toContain("Clipboard blocked");
    expect(intakeSource).toContain('aria-live="polite"');
  });

  it("explains why Organize is disabled before a bank paste", () => {
    expect(intakeSource).toContain('aria-describedby="bank-organize-disabled-help"');
    expect(intakeSource).toContain('id="bank-organize-disabled-help"');
    expect(intakeSource).toContain("Paste a bank export before organizing");
    expect(intakeSource).toContain("Organize pasted bank into RuneLite-ready tabs");
    expect(intakeSource).toContain("Organizing pasted bank");
    expect(intakeSource).toContain("Paste a Bank Memory export, Bank Tags string or item IDs to unlock Organize.");
    expect(intakeSource).toContain("Ready to organize.");
    expect(intakeSource).toContain("Bank ready.");
  });

  it("gives every bank import action a concrete accessible name", () => {
    expect(intakeSource).toContain('aria-label="Load sample bank into the paste box"');
    expect(intakeSource).toContain('aria-label="Choose a Bank Memory, Bank Tags or item ID file"');
    expect(intakeSource).toContain('aria-label="Paste bank export from clipboard"');
    expect(intakeSource).toContain('aria-label="Clear pasted bank export"');
    expect(intakeSource).toContain('aria-label={junkFilter ? "Disable junk filter" : "Enable junk filter"}');
  });

  it("supports clickable file import in addition to drag and drop", () => {
    expect(intakeSource).toContain("const fileInputRef = useRef<HTMLInputElement>(null)");
    expect(intakeSource).toContain("const readBankFile = (file: File)");
    expect(intakeSource).toContain("fileInputRef.current?.click()");
    expect(intakeSource).toContain('id="bank-file-input"');
    expect(intakeSource).toContain('type="file"');
    expect(intakeSource).toContain('accept=".tsv,.txt,.csv,text/plain,text/tab-separated-values,text/csv"');
    expect(intakeSource).toContain("File loaded — review the detected format before organizing.");
    expect(intakeSource).toContain("Unsupported file — choose a .tsv, .txt or .csv bank export.");
  });

  it("labels OSRS name input for personalized bank layouts", () => {
    expect(intakeSource).toContain('htmlFor="bank-rsn-input"');
    expect(intakeSource).toContain("OSRS name for bank layout personalization");
    expect(intakeSource).toContain('id="bank-rsn-input"');
    expect(intakeSource).toContain('name="rsn"');
    expect(intakeSource).toContain('autoComplete="off"');
    expect(intakeSource).toContain('aria-describedby={compactSave ? undefined : "bank-rsn-help"}');
    expect(intakeSource).toContain('id="bank-rsn-help"');
  });
});
