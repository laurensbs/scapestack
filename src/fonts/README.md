# RuneScape fonts

From [RuneStar/fonts](https://github.com/RuneStar/fonts) release 1.103-0
(`RuneScape-Fonts.zip`). Licence: **CC0-1.0 / Public Domain** — verified in
each file's name-table (`licence: Public Domain`, vendor runestar.org).

Only the three faces the app uses are committed:

| File | Family name | Used for |
|---|---|---|
| RuneScape-Plain-12.ttf | RuneScape Plain 12 | identity numbers |
| RuneScape-Bold-12.ttf | RuneScape Bold 12 | buttons |
| RuneScape-Quill-Caps.ttf | RuneScape Quill Caps | section names |

**These are bitmap-grid faces: unitsPerEm is 16 (Quill Caps: 32).** They are
pixel-crisp ONLY at font sizes that are a multiple of 16px. The tokens
`--text-rs` (16px) and `--text-rs-display` (32px) are the only sizes they may
be rendered at — anything else breaks the pixel grid and looks smeared.
Enforced by tests/e2e/page-budget.spec.ts's exact-size assertion.
