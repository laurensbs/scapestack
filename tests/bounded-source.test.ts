import { afterEach, describe, expect, it, vi } from "vitest";
import { runBoundedSource } from "@/lib/bounded-source";

afterEach(() => {
  vi.useRealTimers();
});

describe("bounded planning sources", () => {
  it("returns a fast hit and clears the deadline", async () => {
    const result = await runBoundedSource("hiscores", 100, async () => ({ level: 99 }));

    expect(result.value).toEqual({ level: 99 });
    expect(result.timing.state).toBe("hit");
    expect(result.timing.source).toBe("hiscores");
  });

  it("aborts a slow HTTP source and returns at its deadline", async () => {
    vi.useFakeTimers();
    let aborted = false;
    const pending = runBoundedSource("temple", 450, (signal) => new Promise<null>((resolve) => {
      signal.addEventListener("abort", () => {
        aborted = true;
        resolve(null);
      }, { once: true });
    }));

    await vi.advanceTimersByTimeAsync(450);
    const result = await pending;

    expect(aborted).toBe(true);
    expect(result.value).toBeNull();
    expect(result.timing.state).toBe("timeout");
    expect(result.timing.elapsedMs).toBe(450);
  });

  it("folds provider failures into an honest missing enrichment", async () => {
    const result = await runBoundedSource("wom", 100, async () => {
      throw new Error("provider down");
    });

    expect(result.value).toBeNull();
    expect(result.timing.state).toBe("error");
  });
});
