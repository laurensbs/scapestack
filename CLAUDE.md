# Scapestack — how to work here

## Standing authorisation

**Do not ask permission to continue.** Laurens has said, more than once, that he
does not want to approve each block. When a plan is agreed, work through it to
the end.

That covers:

- **Committing and pushing to `main`**, which deploys to production on Vercel.
- **Starting the next piece of work** without checking in first.
- **Making the judgement calls** the work needs — palette, copy, thresholds,
  scope. Decide, do it, and say what you decided.

Ask only when a choice is genuinely his to make: a promise to users being
withdrawn, money, something irreversible outside the repo. The equipment
question in `docs/design/SCAPESTACK-RETURNING-PLAYER-PROMPTBOOK-2026-07-26.md`
is the shape of a real one. "Which of these two should I build next" is not.

Report by saying what happened, not by asking what is next.

## Delegate design work

Any visual, layout, motion, copy or branding work goes to the
`scapestack-design` agent (`.claude/agents/scapestack-design.md`), not to
hand-styling. It reads the design system first and decides for itself. It has
already caught things a brief would not have: that RuneLite has no card-border
constant, and a Swing px-to-pt bug that was clipping every wrapped paragraph in
the plugin panel.

## The repo

- **Git dir is `.repo-git`**, not `.git`. Every git command needs
  `--git-dir=.repo-git --work-tree=.`
- **`npm run ci:check` is the gate.** Typecheck, tests, smoke, `audit:next`,
  `audit:controller`, `plugin:release-check`, build.
- **The plugin has its own suite:** `cd plugin && ./gradlew test --offline`.

## Rules learned by getting them wrong

**Verify against something that can produce a negative.** A deploy check that
polls for HTTP 200 approves the previous build. A database check with a fresh
row never exercises `ON CONFLICT`. A leak check against a 404 slug proves
nothing. All three happened here.

**Anything about SSR, caching, or what actually renders is only true on
`npm run build` + `next start`.** The dev server lies. This was shipped as fact
three separate times before the rule stuck.

**A new guard's first test is that it can fail.** Two guards in a row passed
vacuously: `audit:next`'s main-guard never fired because the repo path contains
a space, and a gear-gate name test regexed the wrong table and validated zero
names.

**Run an adversarial pass after every batch.** Five for five have found real
defects in fresh code, including two criticals. When one reports "0 confirmed",
check for agents that died — a killed agent returns null and is filtered out
exactly like a refutation.

**A page has a budget, and prose has never once enforced one.** Eight phases of
promptbook shipped in full and `/p/[rsn]` came out at 6.5 screens for 3,478
characters, with 39 empty `<img>` and 55% of the text semibold. Every additive
instruction landed; every paragraph about how it should feel did not. Sort this
repo's history by "was a number with a failing test attached" and it separates
cleanly — type scale, the missing typeface and the monotonic merge all stuck,
and nothing described in prose ever has. So: `/p/[rsn]` holds **three sections**,
and a new one may only land in a commit that removes one. See
`docs/SCAPESTACK-REBUILD-2026-08-02.md`.

**The gate must open the page.** `ci:check` typechecks, unit-tests, smokes,
audits and builds — 273 test files, none of which render anything. Playwright
was installed and configured and `npm run e2e` was simply never added to the
chain, which is how 39 broken images reached production with everything green.

**A migration that reads a new column backfills it in the same commit.**

**The browser pane can report `document.visibilityState === "hidden"`, and a
React streaming reveal will not have painted.** A DOM query then finds nothing
and reads exactly like a broken page. Force a paint — navigate again, or wait
for the content rather than for the load event — before believing an empty
result. This cost one round of "the plan does not render" that was wrong.

**One scale per meaning.** Two colour languages for "how good is this" — the
nine-step gate ramp and a three-tone status pill — ran side by side for months,
and the pill ended up painting an item count as an amber warning. A second way
to say the same thing is a bug in the design system, not a variant.

## The plugin ships one way

The Plugin Hub builds a single immutable commit and cannot be rolled back. The
server must accept a new contract version, on production, verified, **before**
any plugin sends it. All plugin work batches into one release.

Published today: `0.3.0` / contract 3. Candidate `0.4.0` / contract 4 is
prepared and deliberately unsubmitted.

## Voice

No AI language, ever. Across 1,985 player-written Plugin Hub descriptions the
words *seamless, powerful, effortless, elevate, empower, intuitive, robust,
streamline, transform, journey, ultimate, unleash* appear **zero times**. The
most-installed plugin in the game is described in four words. Write like a
player: dry, second-person, quantified. Count in ticks, trips, KC and multiples
of drop rate — never in "hours saved".

Full list, with sources: `docs/design/SCAPESTACK-DESIGN-SYSTEM.md`.
