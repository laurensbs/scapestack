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
  it("redirects both legacy player URLs to the same encoded /p URL", async () => {
    const NextPage = (await import("@/app/next/page")).default;
    const LegacyProfilePage = (await import("@/app/u/[rsn]/page")).default;

    await expect(NextPage({
      searchParams: Promise.resolve({ rsn: "Lynx Titan", source: "plugin-sync" })
    })).rejects.toMatchObject({
      destination: "/p/Lynx%20Titan?source=plugin-sync"
    });
    await expect(LegacyProfilePage({
      params: Promise.resolve({ rsn: "Lynx%20Titan" })
    })).rejects.toMatchObject({
      destination: "/p/Lynx%20Titan"
    });
  });

  it("keeps the six player blocks in the brief's document order", async () => {
    const { PlayerHubShell } = await import("@/components/player-hub-shell");
    const { PlayerPlanAnswer, PlayerPlanAlternatives } = await import("@/components/player-plan-answer");
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
          actionContext: { from: "next", rsn: "Lynx Titan" }
        }),
        createElement(PlayerPlanAlternatives, {
          headline: answer,
          alternatives: [alternative],
          onSelect: vi.fn(),
          onHide: vi.fn()
        })
      ),
      bank: createElement("p", null, "Your bank"),
      account: createElement("p", null, "Account skills")
    }));
    const positions = [
      "Identity header",
      "Last trip",
      "The answer",
      "Not this?",
      "Your bank",
      "Account skills"
    ].map((label) => html.indexOf(label));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(html).toContain("Best guess");
    expect(html).toContain("No private account data was assumed.");
    expect(html).toContain(">Start<");
    expect(html).toContain(">Bring<");
    expect(html).toContain(">Stop at<");
  });
});
