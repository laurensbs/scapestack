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
IDs, Slayer state and a compact bank summary. They never contain bank item
names, item IDs or quantities. The bank summary contains only availability,
item count and an irreversible checksum.

Recommendation decisions, trip events, outcome matches and preference choices
are separate append-only tables. They contain stable product identifiers and
small decision fields, not authentication tokens or raw plugin payloads.

## Retention and deletion

- Default snapshot retention metadata is 365 days.
- Historical raw-bank retention is effectively zero: raw banks are not copied
  into history. `bank_payload_retention_hours` documents the upper bound for
  any future temporary processing and defaults to 24 hours.
- Claim tokens are stored only as SHA-256 hashes.
- `requestAccountDeletion` records the request and optional grace period.
- `deleteAccountHistory` removes the current projection and claim, then deletes
  the account identity. Foreign-key cascades remove every snapshot, decision,
  trip event, outcome, preference and retention row.
- Append-only tables reject updates at the database rule layer. Explicit
  privacy deletion remains allowed.

No UI component issues SQL directly. Server repository methods own all reads,
writes and privacy deletion.
