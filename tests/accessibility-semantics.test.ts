import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("accessibility semantics", () => {
  it("centralizes modal focus trap, Escape close and focus return", () => {
    const hook = read("src/lib/use-dialog-a11y.ts");

    expect(hook).toContain("export function useDialogA11y");
    expect(hook).toContain("returnFocusRef.current = document.activeElement;");
    expect(hook).toContain('event.key === "Escape"');
    expect(hook).toContain('event.key !== "Tab"');
    expect(hook).toContain("focusReturnTarget(returnFocusRef.current)");
    expect(hook).toContain('document.body.style.overflow = "hidden";');
  });

  it("uses the dialog hook on player-facing sheets", () => {
    const files = [
      "src/components/add-bank-modal.tsx",
      "src/components/session-mood-picker.tsx",
      "src/components/connect-browser-modal.tsx",
      "src/components/boss-detail-modal.tsx",
      "src/components/hero-intake.tsx",
      "src/components/path-detail-modal.tsx",
      "src/app/next/next-client.tsx",
      "src/app/goals/goals-client.tsx"
    ];

    for (const file of files) {
      const source = read(file);
      expect(source).toContain("useDialogA11y");
      expect(source).toContain('aria-modal="true"');
      expect(source).toContain("tabIndex={-1}");
    }

    const savedBank = read("src/components/saved-bank-banner.tsx");
    expect(savedBank).toContain("useDialogA11y");
    expect(savedBank).toContain('role="dialog"');
    expect(savedBank).toContain('aria-modal="true"');
    expect(savedBank).toContain('tabIndex={presentation === "modal" ? -1 : undefined}');
    expect(savedBank).toContain("data-autofocus");
  });

  it("describes dialogs and announces errors without extra visible dashboard copy", () => {
    expect(read("src/components/add-bank-modal.tsx")).toContain('aria-describedby="add-bank-modal-description add-bank-modal-status"');
    expect(read("src/components/session-mood-picker.tsx")).toContain('aria-describedby="session-mood-description"');
    expect(read("src/components/connect-browser-modal.tsx")).toContain('aria-describedby="connect-browser-description"');
    expect(read("src/components/connect-browser-modal.tsx")).toContain('role="alert"');
    expect(read("src/components/hero-intake.tsx")).toContain('aria-describedby="hero-runelite-guide-description"');
    expect(read("src/app/next/next-client.tsx")).toContain('aria-describedby="next-route-popup-description"');
    expect(read("src/app/next/next-client.tsx")).toContain('aria-describedby="trip-details-description"');
    expect(read("src/app/goals/goals-client.tsx")).toContain('aria-describedby="goal-unlock-modal-description"');
  });

  it("marks choice controls as selected state, not just styled state", () => {
    expect(read("src/components/session-mood-picker.tsx")).toContain("aria-pressed={selected}");
    expect(read("src/app/next/next-client.tsx")).toContain("aria-pressed={selected}");
    expect(read("src/app/dps/dps-client.tsx")).toContain("aria-pressed={bossFilter === filter.key}");
    expect(read("src/components/bank-result.tsx")).toContain("aria-pressed={isSelected}");
  });

  it("presents boss browsers as named lists of clickable choices", () => {
    const dps = read("src/app/dps/dps-client.tsx");
    const bank = read("src/components/bank-result.tsx");

    expect(dps).toContain('role="list" aria-label="Bosses matching this bank"');
    expect(dps).toContain('role="listitem"');
    expect(dps).toContain("aria-describedby={`${statusId} ${reasonId}`}");
    expect(bank).toContain('role="list" aria-label="Bosses matching this bank"');
    expect(bank).toContain('<div key={b.slug} role="listitem">');
  });
});
