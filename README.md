# Scapestack

**Stop bankstanding. Pick the next trip.**

You log in, stand at the bank, open four wiki tabs, and log out again without
doing anything. Scapestack fixes that: type your OSRS name and it gives you one
thing to do first, plus two backups if you want a different kind of session.

Live at **[scapestack.org](https://www.scapestack.org)**.

## How it works

Scapestack is two halves that need each other.

**The website** does the thinking. Given what it knows about your account, it
picks a trip, the gear to bring, the first step, and a stop point.

**The [RuneLite plugin](https://github.com/laurensbs/scapestack-runelite-plugin)**
does the seeing. Hiscores only expose levels and XP, so without the plugin the
planner has to guess whether you already finished a quest — and guessing wrong
means recommending something you did last year. The plugin runs inside your game
client and reports what actually happened: quests, diaries, collection log,
observed boss KC, your Slayer task, and your bank contents.

The bank is the part that matters most. Knowing what's in it turns *"this boss is
theoretically possible at your levels"* into *"you can do this boss right now,
with this setup."*

### The handshake

1. The plugin generates a random install token locally and keeps it.
2. On first sync it calls `POST /api/sync/claim` to bind that token to an RSN.
   Binding is first-wins, so nobody else can take over your name later.
3. Every sync after that hits `POST /api/sync` with the token as a bearer. The
   server only ever stores `sha256(token)`, never the token itself.
4. On success the plugin opens `/next?rsn=...&source=plugin-sync&bank=none`, and
   the site plans from the fresh snapshot instead of stale browser state.

Sync is **off by default**. The player has to enable `Sync on login` themselves.

### What the plugin never sends

Password, inventory, equipment, GE offers, chat, friends list, clicks, key
presses, screenshots, local files, RuneLite config, IP address, machine
fingerprint. Progress and bank items only.

Equipment is still on that list. The v4 contract reserves a slot for it and
the plugin fills it with `unsupported`, so the choice is visible rather than
silent. Full contract in
[`plugin/README.md`](plugin/README.md).

## Pages

| Route | What it answers |
| --- | --- |
| `/next` | *What do I do right now?* — one plan plus two backups |
| `/bank` | *Can I leave the bank?* — organize into RuneLite Bank Tags |
| `/dps` | *Can I kill this?* — gear, first trip, stop point, upgrade check |
| `/goals` | *What unlock next?* — closest useful quest, diary, cape or milestone |
| `/slayer` | *Is this task worth it?* — do, skip, block, burst or cannon |
| `/quests`, `/diary`, `/skills` | Per-area reference |
| `/ge`, `/gp`, `/hiscore` | Prices, GP tracker, player lookup |
| `/u/[rsn]`, `/share` | Shareable profiles and trips |
| `/plugin` | RuneLite setup |

## Repo layout

```
src/app/          Next.js App Router — pages and API routes
src/lib/          Planner logic (next-up, bosses, classifier, sync, …)
src/components/   UI
plugin/           RuneLite plugin source (Java) — mirrored to the standalone repo
data/             Generated game data: items, quests, diaries, drop rates
scripts/          Data builders, audits, release gates
tests/            Vitest unit tests + Playwright e2e
docs/             Product audits and promptbooks
```

## Related repositories

| Repo | Role |
| --- | --- |
| [`scapestack`](https://github.com/laurensbs/scapestack) | This one. Source of truth for website **and** plugin. |
| [`scapestack-runelite-plugin`](https://github.com/laurensbs/scapestack-runelite-plugin) | Publish-ready mirror of `plugin/`. RuneLite requires a standalone repo. |
| [`plugin-hub-1`](https://github.com/laurensbs/plugin-hub-1) | Fork of RuneLite's hub, used to open publish PRs. |

Bug reports and PRs belong here, not in the mirror.

## Getting started

Requires Node 20+ and a Postgres database ([Neon](https://neon.tech) is what
production uses).

```sh
npm install
```

Create `.env.local`:

```sh
DATABASE_URL=postgresql://...
```

Then create the schema and start the dev server:

```sh
npm run db:init
npm run dev
```

Runs on **http://localhost:4173**.

To point a local RuneLite build at your dev server:

```sh
cd plugin && ./gradlew runClient -Dscapestack.syncUrl=http://127.0.0.1:4173/api/sync
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server on port 4173 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run e2e` | Playwright (run `npm run e2e:install` once first) |
| `npm run smoke` | Fast end-to-end sanity pass |
| `npm run audit:next` | Checks `/next` output against planner rules |
| `npm run plugin:release-check` | Plugin version/contract parity gate |
| `npm run ci:check` | Everything above, in release order |

Run `npm run ci:check` before any release.

## Releasing the plugin

The Plugin Hub builds one immutable commit from the standalone repo, so
publishing is a deliberate multi-step process — extract, test standalone, push,
then pin the SHA in a hub PR. `plugin/release-manifest.json` is the release
authority and deliberately separates `candidate` (what this repo supports) from
`published` (what RuneLite currently installs).

Full procedure: [`plugin/PUBLISHING.md`](plugin/PUBLISHING.md).

The plugin's version is intentionally **not** tied to this package's version.

## Data

`data/` is generated, not hand-edited. Rebuild with the `scripts/build-*.mjs`
builders. Prices come live from the OSRS Wiki real-time API, cached one hour in
process with stale fallback.
