# Progressive account connection

Scapestack stays RSN-first. Typing an OSRS name creates only a browser-local
profile and is never treated as proof of account control.

## Connecting another browser

1. The browser requests a ten-minute pairing code for an RSN that already has
   a RuneLite claim.
2. The player enters that code in the Scapestack RuneLite panel.
3. RuneLite approves the code with its existing install bearer token.
4. The browser exchanges its one-time pairing secret for a 30-day HttpOnly,
   SameSite browser session.

The install token and browser session are stored as SHA-256 hashes. A raw token
is sent only over HTTPS for the request that proves it. Pairing codes and
browser secrets expire and are single-use.
Pairing starts are limited per claimed account and expired attempts are removed.

## Local data

Manual Bank Memory and Bank Tags exports remain on the device and stay scoped
to the stable connected account. A display-name change migrates that local bank
attachment, mood and recent-trip memory to the new name. RuneLite bank state is
part of the latest server sync and can still inform planning on a connected
browser.

Removing an account from a browser revokes that browser session and clears its
active local profile immediately. It does not delete server history. History
deletion remains a separate explicit privacy action.

## Conflicts and recovery

- A different install token cannot take an existing RSN claim.
- The same install token may move its existing account identity after an OSRS
  display-name change; immutable history keeps the same `account_id`.
- A second browser cannot recover an account from an RSN alone. The RuneLite
  installation that owns the claim must approve the temporary code.
