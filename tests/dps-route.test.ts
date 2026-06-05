import { describe, expect, it } from "vitest";
import { bossFromDpsParam } from "@/lib/dps-route";

describe("dps route helpers", () => {
  it("resolves exact boss slugs", () => {
    expect(bossFromDpsParam("vardorvis")?.name).toBe("Vardorvis");
  });

  it("resolves encoded and human boss names", () => {
    expect(bossFromDpsParam("King%20Black%20Dragon")?.slug).toBe("king-black-dragon");
    expect(bossFromDpsParam("king black dragon")?.slug).toBe("king-black-dragon");
    expect(bossFromDpsParam("Kalphite%20Queen")?.slug).toBe("kalphite-queen");
  });

  it("ignores empty or unknown boss params", () => {
    expect(bossFromDpsParam(null)).toBeNull();
    expect(bossFromDpsParam("")).toBeNull();
    expect(bossFromDpsParam("../not-a-boss")).toBeNull();
  });
});
