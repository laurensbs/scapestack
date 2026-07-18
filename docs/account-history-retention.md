# Account history retention

Scapestack keeps two deliberately different forms of sync data.

## Latest account state

`player_sync` is the current projection used to plan a session quickly. It may
contain the latest bank item list because gear, supplies and quantities affect
the recommendation. A new sync replaces this row. It is not an activity log.

## Immutable progress history

`sync_snapshot` appends a row only when the normalized account state changes.
Identical retries use the same SHA-256 checksum and do not create progress.
Snapshots contain skills, completed quests and diaries, collection-log item
IDs, optional boss KC, Slayer state and a compact bank summary. They never
contain a complete historical bank. The bank summary contains only
availability, item count and an irreversible checksum. When two available
banks differ, the snapshot delta may retain up to 100 changed rows (item ID,
name and before/after quantity) so Scapestack can explain a restock, drop or
supply burn without retaining either full bank.

Recommendation decisions, trip events, outcome matches and preference choices
are separate append-only tables. Recommendation rows include the validated
typed decision contract: its provenance facts, unknowns, applied preferences,
completion evidence and compact boundary copy. They contain no authentication
tokens, raw plugin payloads or full bank contents.

## Retention and deletion

- Default snapshot retention metadata is 365 days.
- Historical raw-bank retention is effectively zero: raw banks are not copied
  into history. `bank_payload_retention_hours` documents the upper bound for
  any future temporary processing and defaults to 24 hours.
- Claim tokens are stored only as SHA-256 hashes.
- `requestAccountDeletion` records the request and optional grace period.
- `DELETE /api/account/delete` is the browser-facing deletion path. It requires
  the connected HttpOnly account cookie, ignores any RSN in the URL/body, checks
  same-origin browser requests, then calls `deleteAccountHistory` for the
  connected account only.
- `deleteAccountHistory` removes the current projection and claim, then deletes
  the account identity. Foreign-key cascades remove every snapshot, decision,
  trip event, outcome, preference and retention row.
- Append-only tables reject updates at the database rule layer. Explicit
  privacy deletion remains allowed.

No UI component issues SQL directly. Server repository methods own all reads,
writes and privacy deletion.
