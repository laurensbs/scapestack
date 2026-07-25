import { describe, expect, it } from "vitest";
import { cleanRsnInput, isValidRsn, normalizeRsn } from "@/lib/rsn";

// The game client renders a space in a display name as U+00A0, so this is
// literally what RuneLite's getLocalPlayer().getName() hands the plugin.
const CLIENT_FORM = "Zezima 1";
const PLAIN_FORM = "Zezima 1";

describe("rsn normalisation", () => {
  it("accepts the non-breaking space the game client actually sends", () => {
    // Regression: this used to fail the `[A-Za-z0-9 _-]` validator, which
    // meant no player with a space in their name could ever sync.
    expect(isValidRsn(CLIENT_FORM)).toBe(true);
  });

  it("maps the client form and the typed form to one storage key", () => {
    expect(normalizeRsn(CLIENT_FORM)).toBe(normalizeRsn(PLAIN_FORM));
    expect(normalizeRsn(CLIENT_FORM)).toBe("zezima 1");
  });

  it("keeps the display form readable without lowercasing it", () => {
    expect(cleanRsnInput(CLIENT_FORM)).toBe(PLAIN_FORM);
  });

  it("leaves plain ascii names byte-identical so existing rows still match", () => {
    for (const name of ["zezima", "Woox", "b0aty", "Iron_Mammal", "A-B C"]) {
      expect(normalizeRsn(name)).toBe(name.trim().toLowerCase().slice(0, 12));
    }
  });

  it("collapses runs of whitespace instead of leaving double spaces", () => {
    expect(normalizeRsn("  Zezima   1  ")).toBe("zezima 1");
  });

  it("still rejects names OSRS cannot have", () => {
    expect(isValidRsn("")).toBe(false);
    expect(isValidRsn("   ")).toBe(false);
    expect(isValidRsn("thirteen chars")).toBe(false);
    expect(isValidRsn("drop table;")).toBe(false);
    expect(isValidRsn("emoji🔥name")).toBe(false);
  });

  it("caps the storage key at the OSRS name length", () => {
    expect(normalizeRsn("abcdefghijklmnop").length).toBe(12);
  });
});
