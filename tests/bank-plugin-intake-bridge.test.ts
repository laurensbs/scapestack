import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildBankPluginIntakeBridge } from "@/lib/bank-plugin-intake-bridge";

describe("bank plugin intake bridge", () => {
  it("explains browser paste vs RuneLite bank checks", () => {
    const bridge = buildBankPluginIntakeBridge(" Lynx Titan ");

    expect(bridge.title).toContain("RuneLite knows progress");
    expect(bridge.body).toContain("gear, supplies, quantities or GP");
    expect(bridge.safety).toContain("can be turned off");
    expect(bridge.signals.map((signal) => signal.label)).toEqual([
      "RuneLite helps",
      "Bank context helps",
      "Best paste"
    ]);
    expect(bridge.signals.map((signal) => signal.value).join(" ")).toContain("Bank Memory");
    expect(bridge.signals.map((signal) => signal.value).join(" ")).toContain("bank items");
    expect(bridge.body).not.toContain("account-state");
  });

  it("builds clickable plugin-origin actions with RSN preserved", () => {
    expect(buildBankPluginIntakeBridge(" Lynx Titan ").actions).toEqual([
      {
        label: "Paste gear below",
        href: "#bank-paste-panel",
        primary: true
      },
      {
        label: "Check RuneLite",
        href: "/plugin?rsn=Lynx+Titan&from=bank#verify-sync",
        primary: false
      },
      {
        label: "Plan without bank",
        href: "/next?rsn=Lynx+Titan&source=plugin-sync&bank=none",
        primary: false
      }
    ]);
  });

  it("keeps the bank page focused on the paste popup", () => {
    const pageSource = readFileSync(join(process.cwd(), "src/app/bank/page.tsx"), "utf8");

    expect(pageSource).toContain('data-testid="bank-save-popup"');
    expect(pageSource).toContain("Paste once. Save. Better trips everywhere.");
    expect(pageSource).not.toContain('data-testid="plugin-bank-intake-bridge"');
    expect(pageSource).not.toContain('returnContext?.source === "plugin"');
    expect(pageSource).not.toContain("buildBankPluginIntakeBridge(rsn)");
  });
});
