# Scapestack Reddit Launch Check - 2026-07-15

## First Screenshot

Use `/next?rsn=lauky&bank=local&intent=short` after the plan has loaded.

Crop:
- the "Do this first" trip card;
- one visible backup row;
- the Randomize button;
- the top nav with the saved RSN, bank and RuneLite state.

Do not crop in:
- setup docs;
- support buttons;
- raw bank rows;
- sync setup;
- debug-looking IDs.

The screenshot should prove the whole pitch in one glance: Scapestack knows the account, picks one trip, and offers a backup if the player is not in that mood.

## Reddit Post Title

I built a RuneLite-powered tool that tells you what to do next so you stop bankstanding

## Reddit Post Body

I kept logging in, opening the bank, checking a few tabs, then doing nothing.

So I built Scapestack: type your RSN, pick the kind of session you want, and it gives you one thing to do first.

It can also use your bank and RuneLite sync if you want:

- bank helps with gear, supplies and boss checks;
- RuneLite helps avoid quests, diaries, clog slots and Slayer mistakes you already finished;
- both are optional;
- bank paste stays on your device.

The goal is not to replace the Wiki, WOM or RuneLite. It is the layer before that: "I have 45 minutes, what trip should I actually do?"

Current useful bits:

- one main trip and two alternatives;
- "Can I kill this?" boss picker from your bank;
- skill plans that check what supplies you already own;
- unlock routes for diaries, quests and untradeables;
- a small weekly recap so the next plan can change after progress.

I am trying to make it feel more like an OSRS companion than a generic productivity app. Feedback from midgame mains, irons and returning players would help a lot.

Link: https://www.scapestack.org

## Expected Objections

### "Why not just use the Wiki?"

Use the Wiki for the guide. Scapestack is for picking the next trip before you know which guide to open.

### "This sounds like another AI wrapper."

The core value is account context, bank checks and RuneLite progress. The app should be useful even when it only returns a short trip, a stop point and a reason.

### "I do not want to give account login details."

Scapestack never asks for a RuneScape login. The public path only needs an RSN. Bank paste is local to the browser.

### "I do not want another RuneLite plugin."

RuneLite is optional. Without it, Scapestack still uses public stats and optional bank paste. RuneLite just helps skip finished stuff and make fewer bad suggestions.

### "Will this tell me to do content I cannot afford?"

That is exactly why bank paste exists. If the bank is missing supplies or gear, the app should say what to bring, what to buy, or what to skip for now.

## Privacy Answer

Scapestack does not need your OSRS password.

Bank paste is stored on your device and used to work out gear, supplies, GP and boss setups. The shared trip text must never include raw bank contents.

RuneLite sync is opt-in. Its job is to make planning smarter by telling Scapestack what quests, diary steps, clog slots, Slayer task and bank context are already known.

## Why RuneLite Is Optional

The first-session promise is RSN -> one plan.

RuneLite improves that plan later by reducing repeat suggestions:

- avoid completed quests;
- avoid finished diary steps;
- avoid collection-log guesses;
- use live Slayer context;
- refresh bank context from the plugin when enabled.

Players should never feel blocked by sync. They should feel that sync makes the next trip sharper.

## Why Bank Stays Local

Bank data is sensitive enough that it should not be treated like a normal account profile.

For the web app, local storage is enough for the main use case: "what can I do with what I own right now?"

The app can still calculate:

- best owned boss setup;
- missing upgrades;
- supplies for the next trip;
- cooking, herblore and crafting materials;
- whether to leave the bank or shop first.

## Launch Polish Checklist

- The first visible page should say "Stop bankstanding" and make the RSN flow obvious.
- `/next` should feel like a trip board, not a report.
- `/dps` should start as a clickable boss picker.
- `/goals` should start with the next unlock, not a completion percentage.
- `/bank` should open as a compact paste/save flow.
- `/plugin` should be check RSN, status, fix.
- Support asks belong after a useful result, not beside the main action.
- Mobile should be the default reading mode.
