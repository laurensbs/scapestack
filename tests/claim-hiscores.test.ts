import { describe, expect, it } from "vitest";
import { checkHiscoresForClaim } from "@/lib/claim-hiscores";

describe("checkHiscoresForClaim", () => {
  it("returns found when lookup resolves with a player", async () => {
    await expect(checkHiscoresForClaim("Lynx Titan", 50, async () => ({
      name: "Lynx Titan",
      skills: [],
      activities: []
    }))).resolves.toBe("found");
  });

  it("returns missing only when lookup resolves null", async () => {
    await expect(checkHiscoresForClaim("Missing", 50, async () => null)).resolves.toBe("missing");
  });

  it("returns unreachable when lookup exceeds the timeout", async () => {
    await expect(checkHiscoresForClaim("Slow", 10, async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return null;
    })).resolves.toBe("unreachable");
  });
});
