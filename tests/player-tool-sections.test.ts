import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlayerHubShell } from "@/components/player-hub-shell";
import { PlayerToolsSections } from "@/components/player-tools-sections";
import type { AffordabilityReport } from "@/lib/bank-affordability";
import type { BossViability } from "@/lib/boss-viability";
import { BOSSES } from "@/lib/bosses";
import { localBankItemsFromPaste } from "@/lib/local-bank-items";

class RedirectSignal extends Error {
  constructor(readonly destination: string) {
    super(`redirect:${destination}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    throw new RedirectSignal(destination);
  },
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}));

vi.mock("@/lib/viewer-account", () => ({
  resolveViewerRsn: vi.fn().mockResolvedValue(null)
}));

describe("the four bank questions live on the canonical player page", () => {
  it("redirects each retired tool route to its matching profile section and leaves only nameless /bank as intake", async () => {
    const DpsPage = (await import("@/app/dps/page")).default;
    const GoalsPage = (await import("@/app/goals/page")).default;
    const SlayerPage = (await import("@/app/slayer/page")).default;
    const BankPage = (await import("@/app/bank/page")).default;

    await expect(DpsPage({ searchParams: Promise.resolve({ rsn: "Lynx Titan" }) }))
      .rejects.toMatchObject({ destination: "/p/Lynx%20Titan#bosses" });
    await expect(GoalsPage({ searchParams: Promise.resolve({ rsn: "Lynx Titan" }) }))
      .rejects.toMatchObject({ destination: "/p/Lynx%20Titan#sets" });
    await expect(SlayerPage({ searchParams: Promise.resolve({ rsn: "Lynx Titan" }) }))
      .rejects.toMatchObject({ destination: "/p/Lynx%20Titan#task" });
    await expect(BankPage({ searchParams: Promise.resolve({ rsn: "Lynx Titan", section: "money" }) }))
      .rejects.toMatchObject({ destination: "/p/Lynx%20Titan#money" });

    await expect(DpsPage({ searchParams: Promise.resolve({}) }))
      .rejects.toMatchObject({ destination: "/bank?section=bosses" });
    await expect(GoalsPage({ searchParams: Promise.resolve({}) }))
      .rejects.toMatchObject({ destination: "/bank?section=sets" });
    await expect(SlayerPage({ searchParams: Promise.resolve({}) }))
      .rejects.toMatchObject({ destination: "/bank?section=task" });

    const intake = await BankPage({ searchParams: Promise.resolve({ section: "bosses" }) }) as ReactElement<{ section: string }>;
    expect(typeof intake.type).toBe("function");
    expect((intake.type as { name?: string }).name).toBe("BankIntakeOnly");
    expect(intake.props.section).toBe("bosses");
  });

  it("renders one identity, four same-URL sections, and full untruncated answer text", () => {
    const longMissingReason = "Anti-dragon shield (ornament kit) and extended super antifire potion";
    const boss: BossViability = {
      boss: { ...BOSSES[0]!, slug: "guard-boss", name: "Guard boss" },
      tone: "blocked",
      canKill: false,
      dps: 0,
      ttk: null,
      style: null,
      weaponName: null,
      verdict: "Blocked",
      summary: "The bank does not contain the required protection.",
      firstTrip: "Add protection first.",
      missing: [longMissingReason],
      assumedMaxed: false
    };
    const sets: AffordabilityReport = {
      gp: 5_000_000,
      pricesUnavailable: false,
      buyableNow: [],
      shortBy: [],
      notForSale: [{
        setId: "guard-set",
        setName: "Guard set",
        owned: 1,
        total: 2,
        missing: [{ goalId: "guard-piece", name: longMissingReason, price: null, tradeable: false }],
        cost: null,
        affordable: null,
        remainingGp: null
      }]
    };
    const tools = createElement(PlayerToolsSections, {
      rsn: "Lynx Titan",
      skills: [],
      questsCompleted: [],
      cannotBuy: false,
      bosses: [boss],
      sets,
      task: null,
      emptyTaskReason: "No current task.",
      money: null
    });
    const html = renderToStaticMarkup(createElement(PlayerHubShell, {
      header: createElement("h1", { "data-player-identity": "true" }, "Lynx Titan"),
      lastTrip: null,
      plan: null,
      bank: createElement("p", null, "Your bank"),
      tools,
      account: null
    }));

    expect(html.match(/data-player-identity=/g)).toHaveLength(1);
    expect(html.match(/data-player-tool-section=/g)).toHaveLength(4);
    const positions = ["id=\"bosses\"", "id=\"sets\"", "id=\"task\"", "id=\"money\""]
      .map((marker) => html.indexOf(marker));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    for (const section of ["bosses", "sets", "task", "money"]) {
      expect(html).toContain(`href="#${section}"`);
    }
    expect(html).not.toContain("bank-rsn-input");
    expect(html).not.toContain("bank-paste-input");
    expect(html).not.toContain("animate-spin");

    const answerCell = html.match(/<td data-boss-answer="guard-boss" class="([^"]+)">([\s\S]*?)<\/td>/);
    expect(answerCell?.[1]).not.toContain("truncate");
    expect(answerCell?.[1]).not.toContain("whitespace-nowrap");
    expect(answerCell?.[2]).toContain(longMissingReason);
    expect(html).toContain(`Missing: ${longMissingReason}.`);

    expect(localBankItemsFromPaste(
      "Item id\tItem name\tItem quantity\n1540\tAnti-dragon shield\t1\n2452\tAntifire potion(4)\t7",
      new Map()
    )).toEqual([
      { id: 1540, name: "Anti-dragon shield", quantity: 1 },
      { id: 2452, name: "Antifire potion(4)", quantity: 7 }
    ]);
  });
});
