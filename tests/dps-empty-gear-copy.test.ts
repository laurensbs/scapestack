import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/dps/dps-client.tsx"), "utf8");

describe("DPS empty gear copy", () => {
  it("does not imply DPS is calculated when the bank has zero weapons", () => {
    expect(source).toContain("const hasWeapons = weaponCount > 0");
    expect(source).toContain("Boss checks need at least one usable combat weapon.");
    expect(source).toContain("Gear paste is active, but this looks like supplies/jewellery only.");
    expect(source).toContain("Paste a full Bank Memory export or a combat tab with weapons");
    expect(source).toContain("function DpsNoWeaponGate");
    expect(source).toContain("function DpsMissingSetupState");
    expect(source).toContain("const needsSetupBeforeDps = (Boolean(deepLinkedBoss) || searchParams.get(\"bank\") === \"none\") && !hasKnownSetup;");
    expect(source).toContain("if (needsSetupBeforeDps) {");
    expect(source).toContain("<DpsMissingSetupState");
    expect(source).toContain("No bank yet");
    expect(source).toContain("Add bank for ${boss.name}");
    expect(source).toContain("Scapestack will pick your best owned setup for ${boss.name}.");
    expect(source).toContain('data-testid="dps-no-weapon-gate"');
    expect(source).toContain("Need a weapon first");
    expect(source).toContain("Paste combat gear before picking a boss");
    expect(source).toContain("Add bank here");
    expect(source).toContain("Add bank");
    expect(source).toContain('import { bankOrganizerHref } from "@/lib/bank-handoff-url";');
    expect(source).toContain('const setupBankHref = useMemo(');
    expect(source).toContain('bankOrganizerHref(effectiveRsn, "dps", { boss: setupBossSlug })');
    expect(source).toContain("href={setupHref}");
    expect(source).toContain("const [accountRsn, setAccountRsn] = useState(\"\");");
    expect(source).toContain("const [hasKnownSetup, setHasKnownSetup] = useState(false);");
    expect(source).toContain("loadSavedBank(effectiveRsn)");
    expect(source).toContain("saveSavedBank(input, setupRsn)");
    expect(source).toContain("Add a weapon before picking this trip.");
    expect(source).toContain("bankless={searchParams.get(\"bank\") === \"none\"}");
    expect(source).toContain("pluginSync={searchParams.get(\"source\") === \"plugin-sync\"}");
    expect(source).toContain("slayerTask={isSlayerTaskSource}");
    expect(source).toContain("RuneLite skips finished account stuff, but boss checks still need your bank.");
    expect(source).toContain("This boss came from Task Check. Add bank before buying supplies or trusting upgrades.");
    expect(source).toContain("Add bank before using boss checks, upgrades or setup links.");
    expect(source).toContain("Task picked. Paste gear to check the setup before the first trip.");
    expect(source).toContain("Add bank");
    expect(source).not.toContain("Paste Bank Memory or Bank Tags before using boss checks, upgrades or setup links.");
    expect(source).not.toContain("Coming from Gear & Bank or /next?");
    expect(source).not.toContain("No usable weapon in your bank for this boss.");
  });

  it("labels bank-to-DPS boss handoffs as boss-specific gear proof", () => {
    expect(source).toContain("const deepLinkedBoss = useMemo(() => bossFromDpsParam(pendingBossSlug ?? searchParams.get(\"boss\"))");
    expect(source).toContain("focusedBoss={deepLinkedBoss}");
    expect(source).toContain("focusedBoss: Boss | null;");
    expect(source).toContain('data-testid="dps-focused-boss-receipt"');
    expect(source).toContain("inline-flex size-6 shrink-0 items-center justify-center overflow-hidden");
    expect(source).toContain("Bank picked:");
    expect(source).toContain("Slayer picked:");
    expect(source).toContain('focusedBossSource={isSlayerTaskSource ? "slayer-task" : "bank"}');
    expect(source).toContain("${focusedBoss.name} and the boss list now use this gear.");
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
