#!/usr/bin/env bash
# Mirror plugin/ into a standalone repo for RuneLite Plugin Hub submission.
#
# Usage:
#   ./scripts/extract-plugin.sh <target-dir> [--clean] [--dry-run]
#
# Examples:
#   ./scripts/extract-plugin.sh ~/code/scapestack-runelite-plugin
#   ./scripts/extract-plugin.sh ~/code/scapestack-runelite-plugin --clean
#   ./scripts/extract-plugin.sh ~/code/scapestack-runelite-plugin --dry-run
#
# Why a copy and not a submodule: the Plugin Hub clones a single ref of
# a single repo. A submodule layout would force them to clone the whole
# monorepo just to build the plugin. A flat dedicated repo keeps the
# review-surface tiny.
#
# Idempotent: re-running over an existing target updates files in place
# (good for incremental releases). Pass --clean to wipe the target first
# when the file layout has changed significantly.
# Pass --dry-run to preview the rsync/update surface without modifying the
# standalone repo.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <target-dir> [--clean] [--dry-run]" >&2
  exit 1
fi

TARGET=""
CLEAN="false"
DRY_RUN="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --clean)
      CLEAN="true"
      ;;
    --dry-run)
      DRY_RUN="true"
      ;;
    -*)
      echo "Unknown option: $1" >&2
      echo "Usage: $0 <target-dir> [--clean] [--dry-run]" >&2
      exit 1
      ;;
    *)
      if [[ -n "$TARGET" ]]; then
        echo "Unexpected extra argument: $1" >&2
        echo "Usage: $0 <target-dir> [--clean] [--dry-run]" >&2
        exit 1
      fi
      TARGET="$1"
      ;;
  esac
  shift
done

if [[ -z "$TARGET" ]]; then
  echo "Missing target directory" >&2
  echo "Usage: $0 <target-dir> [--clean] [--dry-run]" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN_DIR="$ROOT/plugin"

if [[ ! -d "$PLUGIN_DIR" ]]; then
  echo "Plugin dir not found at $PLUGIN_DIR" >&2
  exit 2
fi

# rsync preserves timestamps + mode bits (de gradle wrapper heeft +x nodig).
# Excludes:
#  - build/ + bin/ + .gradle/: gradle outputs
#  - .idea/ + *.iml:    IDE metadata
#  - README.md:         generated below as reviewer-facing standalone README
#  - LICENSE:           BSD-2 file leeft alleen in het standalone repo
# De wrapper (gradlew/.bat + gradle/wrapper/) gaat WEL mee — Plugin Hub
# CI gebruikt 'm om te bouwen zonder system-gradle te installeren.
RSYNC_ARGS=(
  -a
  --exclude 'build/' \
  --exclude 'bin/' \
  --exclude '.gradle/' \
  --exclude '.idea/' \
  --exclude '*.iml' \
  --exclude 'README.md' \
  --exclude 'LICENSE'
)

write_standalone_readme() {
  cat > "$1" <<'EOF'
# Scapestack Sync (RuneLite plugin)

Syncs your OSRS quest, diary, collection-log, and Slayer state to
[scapestack.org](https://www.scapestack.org) after you opt in via
`Auto-sync on login`, so Path-to-Max can label quest, diary, collection-log
and Slayer coverage from a verified RuneLite payload instead of only
hiscores heuristics.

The plugin does not POST progress by default. Enable `Auto-sync on login`
in RuneLite settings to send login snapshots; optionally enable
`Sync on quest complete` for immediate quest refreshes.

When sync succeeds, RuneLite chat shows the verified `/next` link for that RSN
(`?source=plugin-sync&bank=none`). Local/self-hosted Sync endpoints produce
local/self-hosted `/next` links, so testers do not accidentally jump to
production after syncing against `localhost`.

## Data contract

Sent after opt-in: RSN, plugin version, quest and diary completion,
loaded collection-log item IDs, Slayer state, and the local install token
only as the Authorization bearer on claim/sync requests.

Never sent: RuneScape password, bank, inventory, equipment, GE offers, chat,
friends list, clicks, key presses, screenshots, local files, or RuneLite
config folders, IP address, or machine fingerprint.

The server stores `sha256(token) → RSN` first-wins. The raw token stays
local except for HTTPS claim and sync requests where it is sent as
`Authorization: Bearer <token>`.

This repo is the publish-ready mirror of the canonical source in
[laurensbs/scapestack/plugin](https://github.com/laurensbs/scapestack/tree/main/plugin).
Bug reports, PRs, and roadmap discussion happen in the main repo.

## Install via Plugin Hub

In RuneLite: Configuration → Plugin Hub → search "Scapestack Sync."

## Build locally

```sh
./gradlew build
./gradlew test
./gradlew runClient
```
EOF
}

if [[ "$DRY_RUN" == "true" ]]; then
  echo "Dry-run mode: previewing Plugin Hub mirror changes for $TARGET"

  COMPARE_TARGET="$TARGET"
  TEMP_TARGET=""
  TEMP_README="$(mktemp)"
  write_standalone_readme "$TEMP_README"
  if [[ "$CLEAN" == "true" || ! -d "$TARGET" ]]; then
    TEMP_TARGET="$(mktemp -d)"
    COMPARE_TARGET="$TEMP_TARGET"
    if [[ "$CLEAN" == "true" && -d "$TARGET" ]]; then
      CLEAN_COUNT="$(find "$TARGET" -mindepth 1 -maxdepth 1 ! -name '.git' | wc -l | tr -d ' ')"
      echo "Clean mode would remove $CLEAN_COUNT top-level target entr$( [[ "$CLEAN_COUNT" == "1" ]] && echo "y" || echo "ies" ) before copying."
    elif [[ ! -d "$TARGET" ]]; then
      echo "Target does not exist yet; previewing as a fresh standalone repo."
    fi
  fi

  RSYNC_OUTPUT="$(rsync -ani "${RSYNC_ARGS[@]}" "$PLUGIN_DIR/" "$COMPARE_TARGET/" | grep -v '^\.d..t.... ' || true)"
  if [[ -n "$RSYNC_OUTPUT" ]]; then
    echo "$RSYNC_OUTPUT"
  fi

  if [[ ! -f "$TARGET/README.md" ]]; then
    echo ">f+++++++++ README.md (generated)"
  elif ! cmp -s "$TEMP_README" "$TARGET/README.md"; then
    echo ">f.st.... README.md (generated)"
  fi
  if [[ -f "$ROOT/LICENSE" && ! -f "$TARGET/LICENSE" ]]; then
    echo ">f+++++++++ LICENSE (copied from monorepo)"
  fi
  if [[ -f "$TARGET/README.md.published" ]]; then
    echo "*deleting   README.md.published (legacy generated file)"
  fi

  if [[ -z "$RSYNC_OUTPUT" && -f "$TARGET/README.md" && ( ! -f "$ROOT/LICENSE" || -f "$TARGET/LICENSE" ) ]]; then
    echo "No rsync file changes detected."
  fi

  if [[ -n "$TEMP_TARGET" ]]; then
    rm -rf "$TEMP_TARGET"
  fi
  rm -f "$TEMP_README"

  echo
  echo "Dry-run only; no files were changed."
  exit 0
fi

mkdir -p "$TARGET"

if [[ "$CLEAN" == "true" ]]; then
  echo "Clean mode: wiping $TARGET contents (keeping .git if present)"
  find "$TARGET" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
fi

rsync "${RSYNC_ARGS[@]}" "$PLUGIN_DIR/" "$TARGET/"

# Generate a top-level README from this canonical release template so
# Plugin Hub reviewers do not see stale standalone copy.
write_standalone_readme "$TARGET/README.md"
echo "Wrote $TARGET/README.md"

if [[ -f "$TARGET/README.md.published" ]]; then
  rm -f "$TARGET/README.md.published"
  echo "Removed legacy $TARGET/README.md.published"
fi

# Copy the monorepo LICENSE if present and the target doesn't have one.
if [[ -f "$ROOT/LICENSE" && ! -f "$TARGET/LICENSE" ]]; then
  cp "$ROOT/LICENSE" "$TARGET/LICENSE"
  echo "Copied LICENSE from monorepo"
fi

echo
echo "✓ Plugin mirrored to $TARGET"
echo "  Next steps:"
echo "    cd $TARGET"
echo "    git init        # if first time"
echo "    git add -A && git commit -m 'Release vX.Y.Z'"
echo "    git tag vX.Y.Z && git push --tags"
