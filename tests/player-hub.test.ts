import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Recommendation } from "@/lib/next-up";

class RedirectSignal extends Error {
  constructor(readonly destination: string) {
    super(`redirect:${destination}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    throw new RedirectSignal(destination);
  },
  notFound: () => {
    throw new Error("not-found");
  }
}));

describe("the canonical player hub", () => {
  it("redirects the legacy /next URL to the encoded /p URL", async () => {
    const NextPage = (await import("@/app/next/page")).default;

    await expect(NextPage({
      searchParams: Promise.resolve({ rsn: "Lynx Titan", source: "plugin-sync" })
    })).rejects.toMatchObject({
      destination: "/p/Lynx%20Titan?source=plugin-sync"
    });
  });

  it("keeps /u/[rsn] as a real page, not a redirect", async () => {
    // /u was a redirect to /p from 2026-07-30 to 2026-08-08. When /p went on
    // a three-section budget, the account detail (identity band, skill table,
    // bank, bank answers) needed a home again — /u is that home, and this
    // test stops it quietly becoming a redirect a second time.
    const module = await import("@/app/u/[rsn]/page");
    const source = (await import("node:fs")).readFileSync(
      (await import("node:path")).join(process.cwd(), "src/app/u/[rsn]/page.tsx"),
      "utf8"
    );
    expect(module.default).toBeTypeOf("function");
    expect(source).not.toContain("redirect(");
    for (const detail of ["PlayerIdentityBand", "PlayerSkillsTable", "PlayerToolsSections", "BankObservationsPanel"]) {
      expect(source, `${detail} must live on /u`).toContain(detail);
    }
  });

  it("keeps the player blocks in the brief's document order — the answer before everything", async () => {
    const { PlayerHubShell } = await import("@/components/player-hub-shell");
    const { PlayerPlanAnswer } = await import("@/components/player-plan-answer");
    const answer: Recommendation = {
      id: "guard:answer",
      kind: "skill",
      title: "The answer",
      why: "One bounded trip.",
      score: 100,
      link: "/skills"
    };
    const alternative: Recommendation = {
      id: "guard:alternative",
      kind: "quest",
      title: "Not this route",
      why: "A second bounded trip.",
      score: 90,
      link: "/quests"
    };
    const html = renderToStaticMarkup(createElement(PlayerHubShell, {
      header: createElement("p", null, "Identity header"),
      lastTrip: createElement("p", null, "Last trip"),
      plan: createElement("div", null,
        createElement(PlayerPlanAnswer, {
          rec: answer,
          decisionCopy: {
            title: answer.title,
            why: answer.why,
            firstStep: "Start here.",
            stopPoint: "Stop here.",
            timebox: "60 minutes",
            requiredSetup: [],
            confidence: "guess",
            sourceLine: "No private account data was assumed."
          },
          planLines: [
            { label: "Start", value: "Start here." },
            { label: "Bring", value: "Bring this." },
            { label: "Stop at", value: "Stop here." }
          ],
          actionContext: { from: "next", rsn: "Lynx Titan" },
          alternatives: [alternative],
          onSelectAlternative: vi.fn(),
          onRejectHeadline: vi.fn()
        })
      ),
      goals: createElement("p", null, "Player goals"),
      routes: createElement("p", null, "Player routes")
    }));
    const positions = [
      "Identity header",
      "Last trip",
      "The answer",
      "Not tonight?",
      "Player goals",
      "Player routes"
    ].map((label) => html.indexOf(label));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    // "Best guess" was the confidence eyebrow. The goal line replaced it —
    // a label saying the answer is first, at the top of the page, told a
    // player nothing the position did not already say.
    expect(html).toContain("No private account data was assumed.");
    expect(html).toContain(">Start<");
    expect(html).toContain(">Bring<");
    expect(html).toContain(">Stop at<");
  });
});
