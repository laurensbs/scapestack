# Scapestack Decision Funnel

Scapestack analytics measure whether the product helps a player choose, start
and finish a useful OSRS session. They do not recreate the account or bank in
an analytics vendor.

## Privacy boundary

- Raw RSNs are omitted rather than hashed.
- Bank rows, item lists, quantities, plugin payloads and claim tokens are never
  event properties.
- Recommendation IDs and boss slugs identify Scapestack content, not players.
- Runtime allow-lists remove unknown properties before transport.
- The transport is injectable and silently falls back to Plausible in the
  browser. Product behavior never depends on analytics availability.

## Funnel

| Stage | Event | Meaning |
| --- | --- | --- |
| Enter | `rsn:submitted` | A public-stats or sample plan was requested. |
| Shape | `mood:changed` | The player chose the kind or length of session. |
| Answer | `plan:first_rendered` | The first usable answer rendered. |
| See | `recommendation:impression` | A specific primary recommendation became visible. Rerenders are deduplicated. |
| Choose | `recommendation:accepted` | The player accepted the recommendation. |
| Start | `trip:started` | The player explicitly started it. |
| Finish | `trip:completed_manual` | The player marked it done. |
| Confirm | `outcome:viewed` | The player saw a reconciled completed, progressed or contradicted plan outcome. |
| Reject | `recommendation:skipped` | The player rejected it with a structured reason. |
| Explore | `recommendation:another` | The player requested a different route. |

## Return behaviour

One question: **which route brings a player back?** It exists because the
product is built around "what should I do next?", a question a player asks a
few times a year, while "is this Slayer task worth it?" is asked several times
a session. That reasoning is sound but unmeasured, and rebuilding on an
unmeasured hunch is expensive.

| Event | Meaning |
| --- | --- |
| `route:visit` | A tool route was opened. Once per arrival. The denominator. |
| `route:engaged` | The player did something on that route. At most once per visit. A visit without one is a bounce. |

`route` is one of `home`, `next`, `slayer`, `dps`, `bank`, `goals`, `profile`,
`plugin`. `visitor` is `first`, `returning_7d` or `returning_later`.

Recency comes from a per-route timestamp in the visitor's own localStorage —
no RSN, no server state, nothing that follows anyone between devices. A cleared
browser reads as a first visit, so the return number is biased low. That is the
honest direction to be wrong in when the number is being used to justify work.

Engagement reports the bucket recorded when the player *arrived*, not a fresh
reading. Re-deriving it would call every engaged visit a return, because the
arrival already wrote the timestamp.

Read the numbers with:

```sh
PLAUSIBLE_API_KEY=... node scripts/return-report.mjs --days 30
```

## Context events

- `bank:attached`, `bank:refreshed`
- `runelite:sync_success`, `runelite:sync_failure`
- `return:visit`, `timeline:viewed`
- `reminder:created`, `reminder:opened`, `reminder:cancelled`
- `outcome:viewed` with status and evidence type, never raw account values
- `boss:opened`, `boss:loadout_used`

Recommendation lifecycle events include the stable recommendation ID, content
kind, route family, mood, account stage, available context, session length and
render timing. `context` is one of `public_stats`, `bank`, `runelite`,
`bank_runelite` or `sample`.

`trip:completed_sync` remains in the contract for old clients, but new RuneLite
completion is reconciled server-side and observed through `outcome:viewed`.

Reminder events are only fired after an explicit player click from the return
recap. They store the goal kind and delivery mode, not the RSN, exact goal text,
bank contents or plugin payload.
