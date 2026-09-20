# App layout improvements

## iPhone and account-role validation

The phone layout is checked in WebKit using both iPhone 15 Pro and iPhone 15 Pro
Max profiles. The profiles include the smaller viewport left by Safari controls;
additional checks cover the full 393 × 852 and 430 × 932 CSS-pixel screens,
simulated safe-area insets, and landscape rotation. These are browser-emulation
checks, not a claim of testing on physical iPhones.

Wine headers scale their photo with the available width and place identity pills
below the photo/title row. Mobile wine actions use two columns with 44px tap
targets. Research quality occupies a separate row, expanded Journal filters use
two columns, and the compact touch navigation remains available in landscape.
Structure labels use the recorded axis name; a partial tasting is no longer
visually relabelled as Intensity just because its value appears first.

Owner and member accounts are tested independently: owners keep producer range
grouping, composition and refresh controls plus research model details; members
keep the simpler producer profile and research wording. Shared wines expose the
viewer's own experience editor without personal-wine edit or research controls.

Run `npx playwright install webkit`, then `npm run test:e2e:iphone`. The suite
checks wine detail, shared experience, Journal, producer, scan sheet, rotation
and safe-area clearance for both roles on both devices.

A layout pass across the wine detail page, the producer page, the Journal and
the app shell. No new colours, no new type scale, no new dependencies: the work
is to rearrange what is already there and to name one idea the app was already
living by without saying so.

## The idea

> **Give a fact a rank before you give it a name.**

WineLog knows a great deal about where each of its facts came from. The research
pipeline tiers its sources, scores its claims, records whether a statement was
directly cited, disputed or merely plausible, and keeps LWIN and ELID identifiers
against a wine. None of that reaches the reader. Every section on a wine page is
the same white card with the same border, the same radius and the same weight, so
a Liv-ex registry number, an AI-researched paragraph and a score the owner typed
themselves all read as equally authoritative.

Two reference designs prompted this pass, and both solve the same problem:

- A wine-detail mock-up that splits one page into **Overview** (derived),
  **Official reference (LWIN) — Read only**, and **Your Experience — Editable**.
  You learn who is responsible for a number before you read it.
- The `burgundy.atlas` producer view, which shows the **shape** of a domaine — a
  stacked bar reading "67% Premier Cru" — before it shows a list of vineyard
  names, and which lets the same holdings be re-sorted by village or by
  classification without changing pages.

Everything below follows from that one idea.

## Provenance ranks

Two badges distinguish personal records from research. Bottle facts remain
unbadged, including the catalogue identifiers integrated into Wine details.

| Rank | Badge | Means | Where |
| --- | --- | --- | --- |
| Yours | `✎ Yours` | typed by the account holder; editable | Your experience, Structure, Tags |
| Wine facts | *(none)* | bottle details, including catalogue identifiers | Wine details |
| Researched | `✨ Researched` | AI research, carrying its quality score | Deep Search |

Unbadged is the default: a badge on every section would mark
nothing, in the same way that a second tier of tracked-uppercase labels marked
nothing before `.section-label` became sentence case.

The badge is a variant of the existing `.chip` primitive in `styles.css`, not a
tenth invention. `src/components/SectionLabel.tsx` owns both the markup and the
stylesheet import, the way `WineFacts.tsx` already owns `wineClassification.css`.

## Wine detail page

### What was wrong

`.wine-identity` carried the photo gallery, add-photo, remove-photo, the group
photo context, the eyebrow, the title, the producer link, the favourite toggle,
a Wine-Searcher link, sharing, the fact pills, the drink-window check and cellar
stock — read content, edit controls and navigation in one box. It was centre
aligned, which costs the eye a fixed left edge to return to on every line, and it
was tall enough to fill most of a phone screen before a single fact. Edit and
Delete sat at the very bottom, below the longest section on the page.

### What it becomes

```
← Journal

┌─ IDENTITY ─────────────────────────────────────┐
│ ┌──────┐ NON-VINTAGE · SPARKLING               │
│ │ img  │ Grande Cuvée                          │
│ │      │ Krug                                › │
│ └──────┘ [Champagne AOC] [Grand Cru] [Chard.]  │
│  3 photos ›                                    │
└────────────────────────────────────────────────┘
  [ ♡ Favourite ]   [ Edit tasting ]

┌─ YOUR EXPERIENCE ──────────── ✎ Yours ─────────┐
┌─ STRUCTURE ────────────────── ✎ Yours ─────────┐
┌─ WINE DETAILS ─────────────────────────────────┐
│  Known LWIN / ELID and additional site facts  │
┌─ IN YOUR CELLAR ───────────────────────────────┐
┌─ RESEARCH ────────── ✨ Researched · 82/100 ───┐
#tags
Delete this wine
```

Your experience moves above Wine details because it is the reason the record
exists. Deep Search moves last because it is the longest section and the least
often the thing someone opened the page for. Structure appears only when the
viewer has entered at least one value. Drinking guidance stays in Deep Search;
the separate drink-window widget is removed. The cellar strip gets a row of its
own instead of riding in the identity card.

### Two deliberate departures from the mock-up

**No sticky bottom action bar.** `.mobile-nav` is already `position:fixed;
bottom:0` at 78px plus `env(safe-area-inset-bottom)`. A second fixed bar would
have to stack on it, fight the same inset, and would do nothing on desktop. An
action row directly beneath the identity card is visible without scrolling for
the same cost as a static row.

**Integrate reference facts into Wine details.** Known LWIN7, LWIN11 and ELID
identifiers belong beside the wine's other facts. Available type, site and parcel
details appear there too, with repeated place names and missing fields omitted.
Identity conflicts retain their review warning, and proposed LWIN corrections
remain explicit choices. There is no separate Official reference panel.

## Producer page

The range already had collapsible groups, colour swatches, counts and tasted
badges. Four things were missing.

### The pivot

The range grouped by wine style only — red, white, sparkling — which is the least
interesting of the three axes available for a Burgundy domaine. Both other axes
were already computed and unused:

- `catalogHierarchyLabel()` in `src/lib/cuvees/catalogPresentation.ts` returns
  Grand Cru / Premier Cru / Village / Regional / Other for any catalogue entry.
- the appellation on each entry gives the village.

A three-way segmented control regroups the same rows without a fetch:

```
[ Classification | Village | Style ]
```

All three axes are resolved once per catalogue row, so switching is a pure
rearrangement in the browser.

**Which axis opens first is chosen, not fixed.** Classification wins where it
separates anything, then village, then style. A Burgundy domaine therefore opens
on its cru mix, while a Napa producer — every wine unclassified, one appellation
— opens on style rather than on a single group called "Other / unclassified". A
choice the reader makes is remembered and beats the automatic one.

A grand cru is left standing as its own group on the village axis.
Clos de la Roche is an appellation in its own right, and the reference data does
not say which commune a grand cru sits in — the same gap that stops anyone saying
a wine is from the Pernand side of Corton. Inventing the parent would be a guess,
and wrong exactly at the boundaries people care about.

Collapse state is keyed by axis as well as by group, because "Red is collapsed"
says nothing about whether "Grand Cru" should be.

### Composition bar

A stacked proportion bar with a legend above the list, giving the shape of the
estate before the names.

**Cru tier is ordinal, not categorical.** Grand above Premier above Village above
Regional is a rank, so it takes one hue stepped dark to light and the reader sees
the order in the colour itself — rather than the four unrelated hues the
reference design uses. Unclassified is the absence of a rank rather than the
bottom of one, so it stays neutral and is not in the ramp. Villages are names,
not ranks, so they take categorical slots in a fixed order instead, folding into
one neutral "Other" past the fifth rather than repeating a hue.

Every palette here was validated rather than eyeballed: the cru ramp for monotone
lightness, step separation and light-end contrast against its own surface in each
mode; the categorical slots for lightness band, chroma floor, colour-vision
separation and normal-vision separation. Three of the light-mode slots sit under
3:1 on paper, which is why the legend prints every count and percentage — the
numbers are the required relief, not decoration.

**The bar always shows the whole range.** A filter chip narrows the list beneath
it and never the shape above it: redrawing the bar as 100% of whatever survived
the filter would answer a different and much less useful question. Slots are
assigned to villages by size once, so filtering cannot repaint the survivors
either.

A tone is defined once, as a custom property keyed on `data-tone`, so the dot on
a group header is guaranteed to be the same colour as that group's segment in the
bar above it. Six hard-coded hexes in `producer.css`
(`.catalog-swatch.white{background:#e0c76c}` and its siblings) are gone with it —
they broke the rule at the top of `styles.css` and, being fixed values, could not
follow dark mode.

### Count line and filter chips

`21 wines · 18 appellations · 6 tasted` under the location in the hero, so the
page says how big the estate is before it is scrolled.

Filter chips — `(All 18) (Grand Cru 1) (Premier Cru 12) (Village 4)` — are a
different gesture from collapse. Collapse hides what you have decided against;
a chip narrows to the one thing you want. On a forty-wine domaine the chips are
much the faster of the two, and both are kept.

## Journal

`.journal-viewbar` carried the result count, the page number, a filter reset, a
Select toggle and a List/Grid switch, growing five more buttons in selection
mode, and sat under six filter inputs in a scrolling pill row. That is two dense
rows of furniture before any wine on a phone.

The six filters fold behind a `Filters (2)` disclosure. Search stays out,
because it is the control used every visit. Reset moves off the view bar and in
beside the filters, where it is about what is being shown rather than about
layout. The fields stay mounted and are hidden rather than unmounted, so a
half-typed filter survives being folded away, and the disclosure opens on arrival
when something is already narrowing the list — a filtered journal whose filters
are hidden looks like a journal that has lost wines.

A disclosure rather than the modal sheet first sketched: the sheet buys focus
management and a backdrop for a row of six inputs that do not need either.

**The composition bar was deliberately not added here.** The journal loads one
page at a time, so the only mix available on the client is the mix of the current
page. A bar drawn from 36 wines under a heading reading "73 matching wines" would
be a misleading chart, and an honest one needs the aggregate from the server.
That is a data change, not a layout change, and it is left for its own piece of
work.

## App shell

`Layout.tsx` rendered brand → account link → nav under `justify-content:
space-between`, which put the account link between the brand and the navigation.
Brand left, nav centre, account and Scan right.

The scan action rode inside `.desktop-nav`, and so disappeared with it on a
phone, where the tab bar carries it. Out on its own it has to be told, or it
appears twice.

`<PageHeader>` — eyebrow, title, subtitle, count line, media, actions — now backs
both wine pages. **The producer hero keeps its own treatment**: it lays the
estate's name over a photograph, which is a genuinely different shape from
media-beside-text, and forcing the shared component onto it would have cost the
hero image for the sake of uniformity. It gains the count line and nothing else.

## Owner and member

Both roles get the same wine page, the same provenance badges and the same
integrated wine facts. The differences are wording, not layout: an owner sees the
research model, the job's own stage message and a request id, where a member
sees "Research updated", a plain progress line and a support id.

The producer page is the real fork. `rangeAllowed = !memberView && !sharedOnly`,
because the wine range is the expensive half of producer research, so a member
gets the profile, the producer-wide practices and the contacts only. Everything
this pass added to the range — the composition bar, the pivot and the filter
chips — is therefore owner-only, and a member's producer page is about a third
shorter. Their heading reads "Producer profile" rather than "Profile & range",
they get one research action instead of two, the producer-wide footnote is
hidden, and range and catalogue hosts are filtered out of the sources list.

**A bug this pass introduced, found by drawing the member's page.** The
catalogue reaches every viewer's browser whatever their role — only the
rendering is gated — so the new hero count line counted it unconditionally and
would have read "18 wines · 12 appellations" above a page that then showed a
member no range at all: a header promising something the page does not deliver.
The count line now respects `rangeAllowed` and falls back to the member's own
tasted-cuvée count, which is theirs and is on the page. Pinned by two tests in
`producerRangeCollapse`.

Worth deciding separately: a member's producer page is now mostly profile,
contacts and their own tastings. If that reads as thin, the cheap half of the
range — a composition bar over the wines they have actually tasted — could be
shown without granting range research.

## Phases

| Phase | Work |
| --- | --- |
| 1a | `SectionLabel` with provenance badge, `PageHeader`, `CompositionBar` |
| 1b | Wine detail: hero, section order, badges, action row, LWIN block |
| 2a | Producer: count line, composition bar, filter chips, swatch tokens |
| 2b | Producer: Classification / Village / Style pivot |
| 3 | Journal filter sheet; shell header order; `PageHeader` adoption |

Phase 1a is pure addition and breaks nothing. Each later phase depends only on
1a, so they can land in any order after it.

## Guards

The CSS guard tests in `tests/unit` constrain this work, and the new code is
written to them rather than around them:

- `designTokens.test.ts` — every `var()` resolves, every token in `:root` is
  referenced, the dark block holds only declarations, and no rule pins a light
  background without also pinning its text colour.
- `buttonTiers.test.ts` — a button that paints a background declares its colour
  and its border; a transparent button declares
  `:hover:not(:disabled)`; a selected `.active` state names the pointer so iOS
  cannot leave it blanked; a section label is sentence case.
- `cssSelectorIntegrity.test.ts` — no `.a.b` pair that no element ever carries.

New tests added with this work:

- `compositionShares.test.ts` — the proportion maths: sums to exactly 100 across
  a spread of awkward splits, never inflates an empty entry to fill the row, and
  keeps the caller's order so a filter cannot repaint the survivors.
- `sectionProvenance.test.ts` — the two badges, including that wine facts stay
  silent and that the badge joins the shared chip primitive.
- `catalogVillageLabel.test.ts` — a village and its premier cru land together,
  and a grand cru is left standing as its own place.
- `wineDetailOrder.test.ts` — the reading order of both wine pages, that photo
  management is out of the identity card, and that nothing pins a second bar to
  the edge the navigation already owns.

`externalWineIdentityPresentation` keeps LWIN and ELID in Wine details, including
additional catalogue fields and warnings for disputed matches.
`producerRangeCollapse` pins the chosen-axis behaviour, with a style fallback.
Browser checks cover owner and shared pages, populated and empty Structure,
integrated identifiers, and Deep Search drinking guidance at phone and desktop
widths. Source-scanning test helpers normalize Windows path separators.
