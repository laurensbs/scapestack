# Account snapshot deltas

`compareAccountSnapshots` is the canonical comparison between two immutable
RuneLite account snapshots. It returns structured facts, never UI sentences.

## States

Every domain distinguishes:

- `changed`: an observed movement;
- `unchanged`: both snapshots are available and equal;
- `unknown`: one side did not contain enough data;
- `unavailable`: the source explicitly could not provide the data;
- `regressed`: monotonic progress such as XP, completed quests, clog slots or
  boss KC moved backwards and should be treated as a source correction rather
  than negative player progress.

Missing fields are never converted to zero. A first sync is a baseline and has
no progress facts. Identical sync retries reuse the existing snapshot and do
not add a delta.

## Stable identity

Each delta ID is SHA-256 of `previousChecksum:currentChecksum`. A first-sync ID
uses `first:currentChecksum`. Current time and freshness are excluded, so the
same snapshot pair always reconciles to the same delta and can later be matched
to a recommendation or trip.

## Facts for consumers

Consumers receive small typed facts such as:

```ts
{ kind: "xp", key: "Cooking", amount: 250000, before: 2000000, after: 2250000 }
{ kind: "boss-kc", key: "Vorkath", amount: 4, before: 48, after: 52 }
{ kind: "quest", key: "Dragon Slayer II" }
```

Presentation code decides whether and how to phrase those facts. This prevents
the persistence layer from becoming a dashboard-copy generator.

## Bank privacy

Full bank rows remain only in the latest-state projection. Historical deltas
are calculated only when both banks are available and retain the 100 largest
quantity movements. The delta records total changed-row count and whether the
details were truncated. An unavailable or unknown bank never produces fake
removals.

## Freshness

- `fresh`: at most six hours old;
- `recent`: more than six hours and at most seven days old;
- `stale`: older than seven days;
- `unknown`: invalid or future timestamp.
