# r/2007scape launch — checklist + draft

_Geen marketing-deck. Een copy-paste post + de screenshots die er bij
moeten + de drie kritische comments die je gaat krijgen + de eerlijke
antwoorden daarop._

---

## Vóór je post

1. **Maak een Reddit-account dat ouder is dan een paar dagen** met enige
   r/2007scape-comment-historie. Brand-new accounts worden door de
   spam-filter (en de subreddit-mods) automatisch verwijderd.
2. **Plausible is live** (commit `72b1aa3`). Check
   plausible.io/scapestack.org voordat je post — je wilt vanaf minuut 1
   zien wat er gebeurt.
3. **Drie screenshots** in de volgorde hieronder. Hou ze klein (~1200px
   breed), PNG. Geüpload via Reddit's eigen image-upload, niet imgur —
   Reddit-images zijn iets makkelijker te bekijken op mobile.
4. **Test je eigen flow** één keer met je echte RSN op productie. Niet
   met sample. Als je zelf afhaakt op een stap, gaat een vreemde dat ook.
5. **Tijd**: r/2007scape post-traffic piekt rond 18:00–22:00 UK-tijd op
   doordeweekse dagen. Niet weekend (weekend = OSRS-events,
   account-recoveries en gear-progress posts overspoelen alles).

---

## De post-draft

**Titel** (max 300 tekens; mod-rule "no clickbait" — concreet titlen):

> I built a free tool that looks at your stats and bank and tells you what's actually worth doing next

**Body** (max ~300 woorden — Reddit-readers haken af na een halve
schermhoogte):

> Hi. Solo dev, OSRS-player since RS2 days. I got back into the game
> last year and immediately hit the wall everyone hits: full bank,
> middling stats, no idea what to do. Wise Old Man tells me my levels.
> The wiki tells me drop rates. RuneLite tells me my GP/hr. Nobody told
> me *what to do tonight*.
>
> So I built **Scapestack** — a free site where you type your name,
> optionally paste your bank, and get a ranked list of what's worth
> doing now. Not 5 tools — one page that reads your account.
>
> What it does:
> - **Quests you can do today** — gated on your skills + QP from Hiscores
> - **Diaries you've passively unlocked** but don't know about
> - **Bosses your stats now support** + checks your bank to skip ones
>   where you have no gear
> - **Drop chase math** — "you've killed 250 CoX, that's a 0.7% chance
>   of a Tbow, your next iconic chase is Kodai" (skips iconics you
>   already have)
> - **Bank organizer** as a side-tool — paste banktags, get clean
>   use-case tabs, copy back to RuneLite
>
> What it isn't:
> - Not a plugin. Not a client. Not a botting tool. It runs in your
>   browser; we don't store your bank.
> - Not a Wise Old Man clone. Wise Old Man tracks progress; this tells
>   you what to do next with that progress.
> - Not monetised. No ads, no accounts, no signups. Buy-me-a-coffee in
>   the footer for hosting; that's it.
>
> Link: https://scapestack.org
>
> Try `/next` first — that's the heart of it. If you don't have time to
> type your name, there's a "see it with a sample bank" on the homepage.
>
> Feedback brutally welcome. Especially: what advice did it give you
> that was **wrong**? That's the thing I want to fix tomorrow.

**Flair** (subreddit-rule): `Tools`. Without flair it gets removed.

---

## Screenshots — drie stuks, in deze volgorde

### Shot 1 — `/next` result voor jou persoonlijk

- Navigeer naar `/next`, vul je eigen RSN, druk "Show me what to do".
- Wacht tot je echte top-3 verschijnt.
- Crop vanaf header tot en met **3 items in "Also worth doing"**.
- **Cover je RSN in de header niet af** — laat zien dat het echt jouw
  account is. Authenticiteit is wat de upvotes drijft, niet polish.

### Shot 2 — Bank organizer met een echte bank

- Navigeer naar `/bank?sample=1`. Of paste je eigen banktags.
- Wacht tot tabs verschijnen, scroll naar tab "Combat" of "Range" zodat
  een tab met écht herkenbaar gear in beeld komt (whip + Tbow + bandos).
- Crop van bovenrand tot onderkant van die ene tab.
- De OSRS-sprites zijn de kracht hier; zorg dat ze scherp blijven na
  Reddit's image-compression.

### Shot 3 — Eén KC-rec ingezoomd

- Op `/next` result, scroll naar de KC-section.
- Screenshot één tile, bv. "250 Chambers of Xeric KC · 1/23,000 Kodai
  insignia · 1.0% chance of one Kodai based on your KC."
- Laat zien dat het écht je eigen KC leest. Dit is wat geen andere tool
  doet — verkoop het.

---

## De drie kritische comments + hoe je reageert

### "Is this just a Wise Old Man wrapper?"

> No. WOM is amazing for tracking what you *have* done over time. This
> answers a different question: "given what you have, what's the next
> thing worth doing tonight?" The two tools complement each other — if
> you check WOM weekly to see your gains, you can check this when you
> log in and don't know where to go. (And it's open about reading from
> the OSRS Hiscores directly, same source WOM uses.)

### "How is this not a botting tool / plugin / TOS violation?"

> It runs entirely in your browser. The only thing it reads is the
> public OSRS Hiscores (same endpoint the official site uses) and an
> optional Bank Tags / Bank Memory export you paste yourself. There is
> no client injection, no plugin install, no account login, no automation
> of any in-game action. You can read the code — github.com/laurensbs/scapestack.

### "The advice it gave me is wrong / generic"

> Honest answer: that's the part I most want to hear about. The engine
> is rule-based, hand-tuned, with no LLM in the loop — so when it's
> wrong, it's wrong in a way I can fix. If you tell me which scenario
> (your stats + bank + the rec it gave you) I'll have a fix in the next
> push. There's also a `npm run audit:next` script in the repo that
> runs three hand-curated archetypes through the engine; I check that
> after every engine change.

---

## Tracking what worked

In Plausible after 24h, check:

- **Total uniques** — did the post drive real traffic? r/2007scape
  posts of this size typically peak at 500–2000 uniques.
- **`next:submit` count / total uniques** — funnel rate. If <10%,
  the homepage isn't selling /next hard enough.
- **`next:submit` props.hasRsn=false vs true** — do people actually
  type their RSN, or only click the sample? If hasRsn is rare, the
  trust messaging needs to be stronger.
- **`saved-bank:reuse` (24h+)** — are people coming back? Day-2
  return-rate is the real signal that the product is sticky.

If any of those numbers are bad, that's the next thing to fix —
**not** more polish on what already exists.
