/**
 * The design system, in one place — REBRAND.md Section 7, Phase A step 3.
 *
 * Direction: "weathered Gielinor almanac / in-world adventurer's tool".
 *
 * This file exists because of a documented failure mode, not for tidiness.
 * Anthropic's own guidance on frontend design names it: without direction a
 * model "samples from this high-probability center", which is why every
 * unguided restyle of this site drifted back to the same dashboard. Capturing
 * the chosen system as code means the next session starts from it rather than
 * from the statistical average.
 *
 * These values are the single source of truth. globals.css carries the same
 * numbers as CSS custom properties; if the two ever disagree, this file is
 * right and globals.css is the bug.
 */

export const STONE = {
  900: "#1c1811",
  800: "#2a2118",
  700: "#3a2f22",
  600: "#4a3d2a",
  500: "#6b5a3e"
} as const;

export const WOOD = {
  700: "#3e2f1c",
  500: "#6b4f2e"
} as const;

export const PARCHMENT = {
  100: "#fcf5e5",
  200: "#f1e4c9",
  300: "#e3d2a8",
  line: "#d8c096"
} as const;

export const INK = {
  900: "#241a10",
  700: "#4a3a26",
  500: "#7a6647"
} as const;

export const STONE_TEXT = {
  base: "#f2e6cc",
  muted: "#b8a380"
} as const;

/** Gold is osrs.design's own meta-theme-color, not an invention. */
export const GOLD = {
  500: "#f7b538",
  600: "#d99a24",
  300: "#ffd766"
} as const;

/**
 * The game's own chat colours, used only as status.
 *
 * Red is the value the OSRS Wiki documents for the in-game markup
 * `<col=ff0000>`. These are fully saturated on purpose — that is the game's
 * convention — which is exactly why they must never become chrome.
 */
export const MSG = {
  good: "#22cc22",
  warn: "#ff0000",
  info: "#00b8b8",
  titleYellow: "#ffff00"
} as const;

export const BEVEL = {
  light: "rgba(255, 236, 190, 0.35)",
  dark: "rgba(0, 0, 0, 0.55)"
} as const;

/** OSRS interface chrome is squared. Four pixels is the ceiling, not a hint. */
export const RADIUS = { sm: "2px", md: "3px", max: 4 } as const;

/**
 * Three faces, three jobs. All SIL OFL 1.1.
 *
 * Deliberately NOT the RuneStar/FontStruct recreations of the game's own
 * fonts: those reproduce Jagex letterforms, and REBRAND.md 9.4 rules them out
 * under the Fan Content Policy. Cinzel is a Roman-inscription serif — carved
 * stone by construction rather than by imitation.
 */
export const FONTS = {
  display: '"Cinzel", serif',
  body: '"Fraunces", Georgia, serif',
  numeral: '"Pixelify Sans", monospace'
} as const;

/**
 * Faces that must never appear. REBRAND.md Section 3, F2.
 * scripts/rebrand-lint.mjs enforces this; the list lives here so the lint and
 * the system cannot drift apart.
 */
export const FORBIDDEN_FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Arial",
  "system-ui",
  "Poppins",
  "Space Grotesk",
  "Geist",
  "Montserrat"
] as const;
