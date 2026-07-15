import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/current-run-bar.tsx"), "utf8");

describe("current run bar", () => {
  it("centralizes account, setup, RuneLite and vibe context without a dashboard panel", () => {
    expect(source).toContain('aria-label="Scapestack account setup"');
    expect(source).toContain("loadAccountSnapshot");
    expect(source).toContain("const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);");
    expect(source).toContain("setSnapshot(loadAccountSnapshot());");
    expect(source).toContain("SAVED_BANK_EVENT");
    expect(source).toContain("window.addEventListener(SAVED_BANK_EVENT, refresh)");
    expect(source).toContain('const bankLabel = snapshot?.bankLabel ?? "Add bank";');
    expect(source).toContain("const bankTitle = snapshot?.bankDetail ?? bankLabel;");
    expect(source).toContain('const runeliteLabel = snapshot?.runeliteLabel ?? "Add RuneLite";');
    expect(source).toContain('const vibe = snapshot?.moodLabel ?? "Best now";');
    expect(source).toContain("const hasSetup = Boolean(snapshot?.hasBankContext);");
    expect(source).toContain("Add bank");
    expect(source).toContain("AddBankModal");
    expect(source).toContain("setBankModalOpen(true)");
    expect(source).toContain('source="run-bar"');
    expect(source).toContain("Add RuneLite");
    expect(source).toContain("runeliteLabel");
    expect(source).toContain("runeliteReady");
    expect(source).toContain("<CheckCircle2");
    expect(source).toContain("<RefreshCw");
    expect(source).toContain("Best now");
    expect(source).toContain("SessionMoodPicker");
    expect(source).toContain("<SessionMoodPicker rsn={rsn} label={vibe} />");
    expect(source).not.toContain("signals");
    expect(source).not.toContain("readiness");
    expect(source).not.toContain("dashboard");
  });
});
