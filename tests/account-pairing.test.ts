import { describe, expect, it } from "vitest";
import {
  formatPairingCode,
  generatePairingCode,
  hashAccountSecret,
  normalizePairingCode
} from "@/lib/account-pairing";

describe("account pairing primitives", () => {
  it("uses human-readable eight-character codes without ambiguous glyphs", () => {
    for (let i = 0; i < 100; i += 1) {
      const code = generatePairingCode();
      expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
      expect(formatPairingCode(code)).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    }
  });

  it("normalizes pasted codes and hashes secrets deterministically", () => {
    expect(normalizePairingCode(" abcd-efgh ")).toBe("ABCDEFGH");
    expect(hashAccountSecret("secret")).toMatch(/^[a-f0-9]{64}$/);
    expect(hashAccountSecret("secret")).toBe(hashAccountSecret("secret"));
    expect(hashAccountSecret("secret")).not.toBe(hashAccountSecret("other"));
  });
});
