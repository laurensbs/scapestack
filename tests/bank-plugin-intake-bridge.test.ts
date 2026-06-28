import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildBankPluginIntakeBridge } from "@/lib/bank-plugin-intake-bridge";

describe("bank plugin intake bridge", () => {
  it("explains the plugin-to-bank boundary without claiming bank sync", () => {
    const bridge = buildBankPluginIntakeBridge(" Lynx Titan ");

    expect(bridge.title).toContain("RuneLite knows progress");
    expect(bridge.body).toContain("gear, supplies, quantities or GP");
    expect(bridge.safety).toContain("never goes back to RuneLite");
    expect(bridge.signals.map((signal) => signal.label)).toEqual([
      "RuneLite helps",
      "Bank paste helps",
      "Best paste"
    ]);
    expect(bridge.signals.map((signal) => signal.value).join(" ")).toContain("Bank Memory");
    expect(bridge.signals.map((signal) => signal.value).join(" ")).not.toContain("bank sync");
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

  it("renders only for the plugin-origin bank intake", () => {
    const pageSource = readFileSync(join(process.cwd(), "src/app/bank/page.tsx"), "utf8");

    expect(pageSource).toContain('data-testid="plugin-bank-intake-bridge"');
    expect(pageSource).toContain('returnContext?.source === "plugin"');
    expect(pageSource).toContain("buildBankPluginIntakeBridge(rsn)");
    expect(pageSource).toContain("{bridge.safety}");
  });
});
