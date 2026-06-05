import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "@/lib/clipboard";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("copyText", () => {
  it("uses navigator.clipboard when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyText("hello")).resolves.toBe("clipboard");
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to execCommand when clipboard permission fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const exec = vi.fn().mockReturnValue(true);
    const removed: unknown[] = [];
    vi.stubGlobal("document", fakeDocument(exec, removed));

    await expect(copyText("fallback text")).resolves.toBe("fallback");
    expect(exec).toHaveBeenCalledWith("copy");
    expect(removed).toHaveLength(1);
  });

  it("returns failed when both clipboard and fallback fail", async () => {
    vi.stubGlobal("navigator", { clipboard: undefined });
    vi.stubGlobal("document", fakeDocument(vi.fn().mockReturnValue(false), []));

    await expect(copyText("nope")).resolves.toBe("failed");
  });
});

function fakeDocument(execCommand: (command: string) => boolean, removed: unknown[]) {
  const body = {
    appendChild: vi.fn(),
    removeChild: vi.fn((node: unknown) => removed.push(node))
  };
  return {
    body,
    execCommand,
    createElement: vi.fn(() => ({
      value: "",
      style: {},
      setAttribute: vi.fn(),
      focus: vi.fn(),
      select: vi.fn(),
      setSelectionRange: vi.fn()
    })),
    getSelection: vi.fn(() => ({
      rangeCount: 0,
      removeAllRanges: vi.fn(),
      addRange: vi.fn(),
      getRangeAt: vi.fn()
    }))
  };
}
