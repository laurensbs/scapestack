# Recommendation decision contract

`RecommendationDecision` is the typed boundary between Scapestack's ranking
output and the plan shown to a player. Ranking can still emit legacy
`Recommendation` objects while the UI migrates, but the primary `/next` card
is rendered from this contract.

## Why the boundary exists

A recommendation is not complete unless it contains a goal, first step, stop
point and completion rule. The contract also records which mood, timebox,
route and account mode were applied. This prevents the UI from turning missing
bank or RuneLite context into confident copy.

Every factual reason has one provenance:

- `public_stats`: public levels or boss KC;
- `bank`: the saved or plugin-synced bank used for the plan;
- `runelite`: exact completion state supplied by the Scapestack plugin;
- `preference`: the player's mood, timebox or route choice.

Missing context is stored in `unknowns`; it is never converted to a zero or a
confirmed blocker. Assumptions are separate and completion evidence is typed.
Quest, diary, Slayer, bank and boss-KC decisions can be recognized by a later
sync. Other activities explicitly require manual confirmation until a later
phase adds exact evidence.

## UI and copy

The ranking engine does not decide headline paragraphs. The UI calls
`recommendationDecisionCopy` to turn facts into the short `Why this pick`,
`Start` and `Finish after` lines. This keeps player-facing copy replaceable
without changing ranking or persisted evidence.

## Persistence

Only a browser paired to a RuneLite account can POST to
`/api/account/decision`. The server ignores browser-supplied RSNs and stores
the decision against the authenticated account ID. The full validated contract
is append-only JSONB beside compact timeline fields. Repeated renders of the
same decision within five minutes reuse the latest row.

The contract contains no authentication secret or raw bank payload. Explicit
account deletion cascades to the decision rows.
