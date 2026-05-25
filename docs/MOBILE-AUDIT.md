# Mobile audit — mei 2026

_Geen fixes. Een lijst van wat breekt of voelt verkeerd op mobile,
gerangschikt op pijn. De Reddit-launch landt ~60 % op mobile; alles
hier kan kosten op die helft van het publiek._

Audit gedaan door de code te lezen met een mobile-mindset (geen
echte browser-test). Drie viewports overwogen: iPhone SE (375px),
iPhone 14 (390px), iPad (768px).

---

## `/` — homepage

### High priority

1. **Hero h1 te groot op 375px.** `text-[44px]` op de smallste viewport
   geeft "Less bank standing, more Gielinor." als ~3 regels waarvan
   "Gielinor" net niet meer past — risico op horizontal-scroll bij
   verkeerde line-break. _Fix-grootte: `text-[36px]` op default,
   sm: `44px`._

2. **BossArena overlapt de hero-tekst op tablet.** De grid is
   `lg:grid-cols-[1.1fr_1fr]` — dat splitst pas op `lg` (1024px+). Op
   iPad (768px) zit de arena ondér de tekst maar gebruikt nog steeds
   `min(460px, 90vw)`. De ambient-glow op `-15%` insets bloedt in de
   onderkant van de hero-CTA-knoppen. _Fix: arena marge bovenaan op md,
   of inset-glow op `-10%` zetten._

3. **Hero CTA-buttons in twee regels stapelen op 375px.** "What should
   I do next? →" + "✨ See it with a sample bank" zijn samen ~340px op
   375px viewport met `px-5` padding. `flex-wrap` doet zijn werk en
   stapelt, maar de tweede knop ziet er dan uit als een afterthought.
   _Fix: `w-full sm:w-auto` op de buttons zodat ze fullwidth stapelen,
   niet wrap-met-spatie._

### Medium

4. **Footer "Solo project · No ads · No accounts" + "Help keep
   Scapestack going" met BMC-button is een 2-kolom grid
   (`sm:grid-cols-[1fr_auto]`) die op 375px stapelt naar 1 kolom. Werkt,
   maar de BMC-button valt links onder uitgelijnd. _Visuele preference,
   geen breaker — `items-center` op de outer container zou centreren._

### Low / OK

- ToolCards (3-grid) → 2-grid → 1-grid trapje werkt netjes via
  `sm:grid-cols-2 lg:grid-cols-3`.
- `px-5 sm:px-8` op `<main>` is correct mobile-first.
- Hero subhead `max-w-xl` cap is harmless op smaller viewports.

---

## `/next`

### High priority

5. **HeadlineCard `size-12` (48px) sprite-tile naast `text-[19px]`
   title kan op 375px overflowen** als de title 2+ woorden heeft. Niet
   echt een bug — `flex-1 min-w-0 + truncate` zou helpen maar ontbreekt
   in HeadlineCard. Bij een title als "1,500 Vorkath KC" past het; bij
   "Karamja Diary — Hard" net. _Fix: voeg `min-w-0` toe aan de
   `flex-1`-div in HeadlineCard zodat truncate werkelijk truncates._

6. **KC-recs met `<KcProbabilityGraph>` open kunnen overflowen.** De
   SVG heeft `viewBox="0 0 200 80"` en `w-full h-auto`, dat schaalt
   prima. Maar de bottom-row met "At your X KC: Y%" + "50% at ~ Z" is
   een `flex justify-between` zonder wrap. Op 320px viewport (oude
   iPhones) kan dat ineenklemmen. _Fix: `flex flex-col gap-1
   sm:flex-row sm:justify-between`._

7. **NextIntake textarea + submit-button** stacken via `flex-wrap`.
   De textarea is `flex-1 min-w-[200px]` en de button is shrink-0.
   Op 375px gebeurt het wel maar het stuiterende effect bij focus
   (de focus-shadow `0_0_0_3px` voegt 3px toe op alle zijden) duwt
   de button naar de volgende regel. _Fix: `min-w-[180px]` + accepteer
   stack, of gebruik `gap-2 flex-col sm:flex-row`._

### Medium

8. **`<SavedBankBanner>` modal op 375px.** `max-w-md` (448px) is
   breder dan 375px viewport-margin, dus de `p-4` outer padding zou de
   modal moeten croppen. Maar de inner modal heeft zelf geen
   max-width-fallback voor uitsluitend mobile, dus hij wordt 343px
   breed (375 - 2×16). Werkbaar, maar de title "Welcome back,
   adventurer" + close-X kan krap. _Fix: titel inkorten op mobile of
   `tracking-[0.14em]` i.p.v. `0.18em`._

---

## `/bank`

### High priority

9. **Bank result-grid `grid-cols-4 sm:grid-cols-6 lg:grid-cols-11`
   is goed gechoreografeerd**, maar op 375px (`grid-cols-4`) zijn de
   item-slots zo'n 72px breed — net groot genoeg voor de sprite maar
   te krap voor het quantity-getal als die "5.0K" of langer is. Risico
   op text-overflow op rare item-kwantums. _Fix: `text-[8px]` voor
   qty op mobile zodat het nooit clipped._

10. ~~**Bank tab-row scroll op overflow.**~~ Bij nadere inspectie:
    de tabs zijn `flex-wrap`, niet `overflow-x-auto`. Op smal scherm
    wrappen ze naar meerdere rijen — dat werkt prima. Audit fout.

11. ~~**Drag-drop op touch devices** — sensor config check nodig.~~ Bij
    nadere inspectie: `useSensor(TouchSensor, { activationConstraint:
    { delay: 200, tolerance: 6 } })`. 200ms long-press + 6px tap-buffer
    = correct. Geen fix nodig.

### Medium

12. **`<DropCelebration>` banner is `flex items-center gap-4`** met
    een 56px sprite-tile + tekst + ×-button. Op 375px met een lange
    item-naam ("Tumeken's shadow") kan de naam wrap, maar de tile
    blijft vast. Visueel werkbaar, kan strakker. _Geen breaker._

---

## Cross-cutting

13. **Header mobile-toggle bestaat (regel 116/126 in header.tsx).** Werkt
    waarschijnlijk, maar de mobile-nav-drop heeft geen "current page"-
    highlight zoals desktop. _Lichte UX-onvolledigheid; niet breaking._

14. **Geen `theme-color` op specifieke pagina's.** Layout heeft
    `themeColor: "#07090C"` voor de status-bar tint op iOS Safari.
    Past bij de site. Geen issue.

15. **Focus-rings op buttons gebruiken `ring-2`. Werken op desktop;
    op mobile zijn ze onzichtbaar omdat er geen focus-state is tijdens
    tappen.** Geen probleem — touch heeft geen focus.

---

## Wat ik nu zou fixen, in volgorde

1. **#1 + #3 + #5** (hero h1-grootte, CTA-button stacking, HeadlineCard
   truncate). Concrete one-liners, raken eerste-indruk op mobile.
2. **#9 + #10** (bank qty-text + tab-scroll-cue). De bank-tool is
   bestaand-publieks-tool; mobile-bugs hier kosten power-users.
3. **#11** (drag-drop touch config). Audit + fix. Touch is mobile.
4. **De rest** is medium of cosmetisch. Niet doen tot er klacht over is.

Niet bouwen voor scenario's die niet uit echte mobile-feedback komen.
Deze doc is de eerlijke versie; de echte test is jij of een vriend met
een iPhone die `npm run dev` opent in mobile DevTools.
