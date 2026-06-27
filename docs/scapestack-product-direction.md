# Scapestack Product Direction

## Anti-Bankstanding Reddit Fit

Scapestack is the anti-bankstanding session planner for OSRS.

## Critical Audit

1. Would it land on r/2007scape today?
   It is close, but Reddit will only care if the first screenshot shows one useful plan, not setup, status or explanation.

2. What does an OSRS player understand in 5 seconds?
   Type RSN, stop bankstanding, do the first plan, keep two backups if the mood changes.

3. What feels cringe or too SaaS?
   Anything that sounds like a dashboard, sync product, confidence system, payload viewer or AI wrapper.

4. Where can Scapestack still drift into dashboard mode?
   Optional gear/RuneLite sections, copied plan text, plugin fallback states and any card that explains inputs before showing the plan.

5. What is the actually useful moment?
   Scapestack says: start this trip, bring this gear, stop here, and it does not send you to stuff RuneLite knows you already finished.

Title:
I built a RuneLite-powered tool that tells you what to do next when you log in, so you stop bankstanding

Body:
I kept logging in, standing at the bank, checking Wiki pages and trackers, then logging out without doing anything.

So I built Scapestack: type your RSN and it gives you one thing to do first, plus two backups if you want a chill, GP, bossing, unlock or AFK session.

RuneLite stays in the background. It helps Scapestack avoid quests, diary steps, clog slots and Slayer calls you already finished. Gear paste can add supplies and GP later, but the first run only needs an OSRS name.

The goal is simple: less bankstanding, fewer Wiki tabs, one clear stop point.

First screenshot:
Show `/next` after an RSN run. The crop should include the header, one large "Do this first" card, two backup cards and the collapsed "Make this smarter" row. Do not show setup help, sync status, proof, IDs or debug copy.

The product promise:
- Type your OSRS name.
- Get one best move.
- See two backups: chill, GP, bossing, unlock or AFK.
- Start with one clear step.
- Stop at a clear stop point.

## Wow Moments

1. It tells you the first click, not a list of ideas.
2. It stops recommending finished quests, diary steps, clog slots and wrong Slayer calls once RuneLite is connected.
3. It turns bankstanding into a short session: goal, why, first step, timebox, stop point.

## Remove

- Any status panel above the plan.
- Any proof, raw counts or setup checklist before the plan.
- Any copy that sells sync instead of the next trip.
- Any repeated card grid that makes the product feel like a dashboard.

## Missing

- A stronger first-run sample for new players with no RSN confidence yet.
- A "low effort tonight" path that feels native for mobile players.
- A post-session "done, what next?" loop that makes Scapestack sticky without becoming a tracker.

## Copy Rules

Use player language: bankstanding, trip, KC, task, unlock, gear, supplies, GP, diary, quest, Slayer, clog, stop point.

Avoid player-facing technical language: signals, payload, readiness, data source, Plugin Hub, PR, exact account state.
