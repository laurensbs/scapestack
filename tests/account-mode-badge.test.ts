import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("account mode badge UI", () => {
  const source = readFileSync(join(process.cwd(), "src/components/account-mode-badge.tsx"), "utf8");
  const nextSource = readFileSync(join(process.cwd(), "src/app/next/next-client.tsx"), "utf8");
  const questSource = readFileSync(join(process.cwd(), "src/app/quests/[slug]/quest-detail-client.tsx"), "utf8");
  const pluginSource = readFileSync(join(process.cwd(), "src/components/plugin-sync-checker.tsx"), "utf8");
  const bankSource = readFileSync(join(process.cwd(), "src/components/bank-result.tsx"), "utf8");

  it("renders account mode through the shared visual helper and helmet sprites", () => {
    expect(source).toContain("accountModeVisual");
    expect(source).toContain("<ItemSprite");
    expect(source).toContain("data-account-mode={visual.tone}");
  });

  it("uses the shared account badge where mode changes the route", () => {
    expect(nextSource).toContain("<AccountModeBadge accountMode={accountMode} compact />");
    expect(nextSource).toContain("<AccountModeBadge accountMode={accountMode} compact showSourceCopy />");
    expect(questSource).toContain("<AccountModeBadge accountType={accountType}");
    expect(pluginSource).not.toContain("AccountModeBadge");
  });

  it("keeps account-specific planning behavior without repeating mode copy in the quest route", () => {
    expect(nextSource).toContain("accountModePlanningTone");
    expect(questSource).toContain("evaluation.accountWarnings");
    expect(questSource).toContain("evaluation.bank.notApplicable");
    expect(questSource).not.toContain("planningTone.itemCopy");
    expect(pluginSource).not.toContain("foundPlanningTone");
    expect(bankSource).toContain("ACCOUNT_MODE_ICON_ITEM_IDS.ironman");
    expect(bankSource).toContain("accountModePlanningTone(\"ironman\")");
  });
});
