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
| Confirm | `trip:completed_sync` | Later RuneLite evidence confirmed progress. |
| Reject | `recommendation:skipped` | The player rejected it with a structured reason. |
| Explore | `recommendation:another` | The player requested a different route. |

## Context events

- `bank:attached`, `bank:refreshed`
- `runelite:sync_success`, `runelite:sync_failure`
- `return:visit`, `timeline:viewed`
- `boss:opened`, `boss:loadout_used`

Recommendation lifecycle events include the stable recommendation ID, content
kind, route family, mood, account stage, available context, session length and
render timing. `context` is one of `public_stats`, `bank`, `runelite`,
`bank_runelite` or `sample`.

Legacy Plausible event names remain in the contract during dashboard migration.
