import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("account mode badge UI", () => {
  const source = readFileSync(join(process.cwd(), "src/components/account-mode-badge.tsx"), "utf8");
  const nextSource = readFileSync(join(process.cwd(), "src/app/next/next-client.tsx"), "utf8");
  const questSource = readFileSync(join(process.cwd(), "src/app/quests/[slug]/quest-detail-client.tsx"), "utf8");
  const pluginSource = readFileSync(join(process.cwd(), "src/components/plugin-sync-checker.tsx"), "utf8");

  it("renders account mode through the shared visual helper and helmet sprites", () => {
    expect(source).toContain("accountModeVisual");
    expect(source).toContain("<ItemSprite");
    expect(source).toContain("data-account-mode={visual.tone}");
  });

  it("uses the shared account badge on next, quest detail, and plugin verify success", () => {
    expect(nextSource).toContain("<AccountModeBadge accountMode={accountMode} compact />");
    expect(nextSource).toContain("<AccountModeBadge accountMode={accountMode} compact showSourceCopy />");
    expect(questSource).toContain("<AccountModeBadge accountType={accountType}");
    expect(pluginSource).toContain("<AccountModeBadge accountType={foundAccountType}");
  });
});
