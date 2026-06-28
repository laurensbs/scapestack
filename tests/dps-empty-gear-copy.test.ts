import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/dps/dps-client.tsx"), "utf8");

describe("DPS empty gear copy", () => {
  it("does not imply DPS is calculated when the bank has zero weapons", () => {
    expect(source).toContain("const hasWeapons = weaponCount > 0");
    expect(source).toContain("DPS rows are blocked until Scapestack sees at least one usable combat weapon.");
    expect(source).toContain("Exact bank handoff is active, but this looks like supplies/jewellery only.");
    expect(source).toContain("Paste a full Bank Memory export or a combat tab with weapons");
    expect(source).toContain("function DpsNoWeaponGate");
    expect(source).toContain('data-testid="dps-no-weapon-gate"');
    expect(source).toContain("Boss setup locked");
    expect(source).toContain("Paste a combat bank before trusting DPS rows");
    expect(source).toContain("Paste combat bank");
    expect(source).toContain('import { bankOrganizerHref } from "@/lib/bank-handoff-url";');
    expect(source).toContain('rsn={searchParams.get("rsn")}');
    expect(source).toContain('const bankHref = bankOrganizerHref(rsn, "dps");');
    expect(source).toContain("href={bankHref}");
    expect(source).toContain("Locked until Scapestack recognises a usable weapon.");
    expect(source).toContain("bankless={searchParams.get(\"bank\") === \"none\"}");
    expect(source).toContain("pluginSync={searchParams.get(\"source\") === \"plugin-sync\"}");
    expect(source).toContain("slayerTask={isSlayerTaskSource}");
    expect(source).toContain("RuneLite sync is account proof, not gear proof.");
    expect(source).toContain("DPS needs a browser-only Bank Memory or Bank Tags paste before it can calculate real setups.");
    expect(source).toContain("This boss came from Task Check, but the route is marked bankless.");
    expect(source).toContain("This route is marked bankless.");
    expect(source).toContain("Paste Bank Memory or Bank Tags before trusting DPS rows, upgrades or boss setup links.");
    expect(source).toContain("Task picked. Paste gear to check the setup before the first trip.");
    expect(source).not.toContain("Coming from Gear & Bank or /next?");
    expect(source).not.toContain("No usable weapon in your bank for this boss.");
  });

  it("labels bank-to-DPS boss handoffs as boss-specific gear proof", () => {
    expect(source).toContain("const deepLinkedBoss = useMemo(() => bossFromDpsParam(pendingBossSlug ?? searchParams.get(\"boss\"))");
    expect(source).toContain("focusedBoss={deepLinkedBoss}");
    expect(source).toContain("focusedBoss: Boss | null;");
    expect(source).toContain('data-testid="dps-focused-boss-receipt"');
    expect(source).toContain("inline-flex size-6 shrink-0 items-center justify-center overflow-hidden");
    expect(source).toContain("Boss selected from bank:");
    expect(source).toContain("Boss selected from Slayer:");
    expect(source).toContain('focusedBossSource={isSlayerTaskSource ? "slayer-task" : "bank"}');
    expect(source).toContain("${focusedBoss.name} and every boss row are using this exact bank context.");
    expect(source).toContain('<BankContextActions source="dps" rsn={rsn} />');
  });

  it("makes bank boss filters visible and easy to clear", () => {
    expect(source).toContain("const clearBossFilter = () => {");
    expect(source).toContain("setFocusedBoss(null);");
    expect(source).toContain("Filtered from bank boss:");
    expect(source).toContain("Clear it to compare all bosses with the same bank.");
    expect(source).toContain("Show all bosses");
    expect(source).toContain("if (focusedBoss && e.target.value.trim().toLowerCase() !== focusedBoss.name.toLowerCase())");
    expect(source).toContain("if (e.key === \"Escape\") clearBossFilter();");
    expect(source).toContain("onClick={clearBossFilter}");
  });
});
