import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchHiscores } from "@/lib/hiscores";

describe("fetchHiscores", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null for 404 even in strict mode", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));

    await expect(fetchHiscores("missing", { strict: true })).resolves.toBeNull();
  });

  it("throws non-404 failures in strict mode for bounded claim checks", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 503 }));

    await expect(fetchHiscores("Lynx Titan", { strict: true })).rejects.toThrow("Hiscores HTTP 503");
  });

  it("keeps old best-effort behavior outside strict mode", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    await expect(fetchHiscores("Lynx Titan")).resolves.toBeNull();
  });

  it("treats a 200 without a skills table as a failure, not an answer", async () => {
    // An incident page shaped like JSON used to become a "found" player with
    // zero skills. Every ranked player has a non-empty skills array.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({}));

    await expect(fetchHiscores("Lynx Titan", { strict: true }))
      .rejects.toThrow("Hiscores 200 without skills");
  });

  it("folds a skill-less 200 to null outside strict mode, like every failure", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ name: "x" }));

    await expect(fetchHiscores("Lynx Titan")).resolves.toBeNull();
  });
});
