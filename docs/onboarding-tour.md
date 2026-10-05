# Onboarding tour for invited members

Status: all four phases built.
Reviewed against `main` at `74350b8` (v1.3.0, 2026-10-05).

## 1. Why this is needed now

The multi-user work is no longer upcoming — it has already shipped. PR #224
("Add multi-user accounts, sharing, and AI credit controls") merged on
2026-09-17, bringing `app_users` with `owner`/`member` roles, invite-only
signup, Google sign-in, friendships, selective wine sharing and the AI credit
system (migrations 0063–0069; schema is now at 0090).

So the remaining gap is not the migration. It is that an invited member signs
in with Google, gets redirected to `/`, and lands on a Passport page in an app
with roughly twenty routes and four different ways to add a wine — with no
explanation of any of it.

There is currently **no onboarding code of any kind** in the repository: no
tour, no coach marks, no welcome screen, no help page. A search for
`onboard|tutorial|walkthrough|coach mark|first run|tour|welcome` across `src`,
`worker` and `docs` returns only unrelated matches (achievement definitions,
research campaign text).

## 2. What a new member actually cannot find

These are the specific discoverability problems the tour has to solve. They
come from reading `src/components/Layout.tsx` and `src/App.tsx` as they stand.

**The mobile bottom bar has five slots, and four major features are not in
them.** The slots are Passport, Journal, Scan Wine, Producers, Vintages.
Which means **Tastings**, **Achievements**, **Shared with me** and
**Account & friends** have no mobile nav entry at all. (Insights is no longer a
page: `/insights` redirects to `/vintages`.) They are reachable
only through the scan sheet, links on the Passport, or the top bar. On a phone,
a new member will simply never discover them.

**One button hides four separate flows.** "Scan Wine" opens a sheet containing
Single Wine, Group Photo, Batch Scan and Start Tasting, plus "Add manually
instead". The sheet does carry an explanatory paragraph, but you have to open
the sheet to read it, and the four options are genuinely different operations
with different costs.

**The cellar is not a page.** Bottles you own but have not drunk live at
`/journal?scope=cellar` — the same route as the Journal with a scope switch.
Nothing on first sight tells you that. Likewise "open a bottle" (moving a
cellar holding into the drunk-wine log) is a concept with no obvious home.

**Credits are invisible until they bite.** Members pay credits for AI actions.
`src/lib/auth/client.ts` intercepts AI routes, fetches a quote, and either
pops the `CreditConfirmation` modal or returns a 402 reading "This needs N
credits; M are available." For a member who was never told credits exist,
the first encounter with that message is confusing and feels like a failure.

**Owner and member see different apps.** The owner is bill-direct and
zero-credit, and gets "Owner tools" on the Account page; members see only
their own usage. A single one-size tour would show members things they cannot
use, and bore the owner with credit explanations that do not apply.

## 3. The approach: a guided tour over the real screen

In plain terms: small numbered speech bubbles that point at the actual buttons
in the app, one at a time, with "Next", "Back" and "Skip". The rest of the
screen dims slightly so the highlighted thing stands out.

The reason to do it this way rather than a welcome slideshow is that the
problem above is a *location* problem. People do not need to be told that
WineLog logs wine; they need to be shown that the cellar is inside the Journal
and that Tastings exists at all. A bubble pointing at the real Journal tab
teaches that. A slideshow does not.

Three rules keep it from becoming annoying:

1. **Skippable and replayable.** "Skip" ends it permanently; a "Replay
   tutorial" link on the Account page brings it back. Nobody is ever trapped.
2. **Short on first run.** The first-run tour is 6 steps — enough to locate
   things. Everything deeper becomes an optional chapter the member can start
   when they want it.
3. **Teach where it matters, not all up front.** The credits explanation is
   better attached to the first AI action than recited on day one.

### How the pieces fit

A **step** is just data: which element to point at, what the bubble says, and
who should see it.

```ts
type TourStep = {
  id: string;                       // 'nav-journal'
  anchor: string;                   // data-tour value of the element to spotlight
  title: string;
  body: string;
  roles?: Array<'owner'|'member'>;  // omitted = everyone
  viewport?: 'mobile'|'desktop';    // omitted = both
  route?: string;                   // navigate here before showing the step
};
```

Elements are marked in the existing JSX with a `data-tour` attribute, e.g.
`<NavLink to="/journal" data-tour="nav-journal">`. This matters: anchoring to
`data-tour` rather than to CSS classes means a later restyle of the nav will
not silently break the tour. The overlay finds the element with
`document.querySelector('[data-tour="nav-journal"]')`, reads its
`getBoundingClientRect()`, and positions the bubble next to it.

Because the desktop top bar and the mobile bottom bar contain different items,
steps carry a `viewport` and the engine filters on a `matchMedia` check — the
same breakpoint the CSS already uses. Role filtering works the same way off
`getAccount()?.role`, which `src/lib/auth/client.ts` already exposes.

## 4. Where "already seen it" is remembered

Per-user in the database, as decided. The clean insertion point already
exists.

Add migration `src/lib/db/migrations/0091_tour_state.sql`:

```sql
ALTER TABLE app_users ADD COLUMN tour_state TEXT NOT NULL DEFAULT '{}';
```

The payoff is that `worker/multiUser/auth.ts` authenticates with
`SELECT u.* FROM auth_sessions s JOIN app_users u ...`, and `/api/me` returns
that row as `{user}`. So a new column on `app_users` flows into the account
payload the client already fetches on boot via `bootstrapAccount()` — no new
read endpoint, no extra request on startup.

For writing, add `PATCH /api/me/tour` next to the existing `/api/me` PATCH in
`worker/multiUser/auth.ts` (which already does `verifyOrigin` + `authenticate`,
the pattern to copy). It takes `{completed:string[], skipped:boolean}`, and
stores it as JSON.

Why JSON in one column rather than a table: this is a small bag of flags read
only by its own user, never queried across users or joined. A table would buy
nothing and cost a migration plus a join. If chapters later need per-chapter
timestamps for analytics, that is the moment to split it out.

One deliberate detail: progress is saved **when a tour ends or is skipped**,
not on every step. That is one write per member per tour instead of six, and
the worst case of a mid-tour browser crash is that the tour starts again — a
better failure than six writes on every first run.

## 5. The content

### First-run tour (7 steps on a desktop, 6 on a phone)

Triggered on the first load of `/` when `tour_state` has no `first-run` entry.

| # | Points at | Says, roughly |
|---|-----------|---------------|
| 1 | Passport nav item | "The map, stamps and progress of everything you have drunk. It fills in as you log wines." |
| 2 | Journal nav item | "Every wine you log lives here. **Your cellar is in here too** — bottles you own but have not opened are under the Cellar tab, not a separate section." |
| 3 | Scan Wine button | "One button, four ways in — one bottle, a lineup photo, a big batch, or an evening with friends. You can always add by hand." |
| 4 | Tastings nav item | *Desktop only.* "An evening is a container: every wine you log while it is running joins it." |
| 5 | Producers nav item | "Producers and Vintages — background that builds itself from your Journal." |
| 6 | Account & friends | "Sharing is per wine and separate from being friends: adding a friend does not hand over your Journal." |
| 7 | Nothing (closing card) | "That is the tour. You can run it again from Account & friends." |

Step 2 is the single most valuable step, which is why the cellar sentence is
bold. Step 6 earns its place because sharing-vs-friendship is a genuinely
non-obvious distinction in this app's model.

Only step 4 is viewport-specific, for a real reason: the top bar carries a
Tastings link and the five-slot tab bar has no room for one, so on a phone the
subject is covered by Start Tasting inside the scan sheet instead.

**Anchors are shared between the two navs.** Passport, Journal and Producers
each appear twice in the markup under one anchor name, and the engine
spotlights whichever copy has a real box — a `display:none` element measures
0×0. That is what keeps the wording written once instead of twice, and it is
what the e2e spec checks at both widths, since jsdom lays nothing out and
cannot tell the two copies apart.

### Optional chapters

Offered from Account & friends, three of them, three steps each. A chapter
**navigates to the page it is about** before talking; the first-run tour never
does, because the chrome it describes is on every screen already. Each is about
somewhere a phone cannot reach from the tab bar, which is the whole reason they
exist.

- **Tastings** — takes you to `/tastings`, then points at Scan Wine for how to
  start one, then explains that logged wines join the open evening by
  themselves.
- **Friends and sharing** — takes you to `/account`, then friend codes, then
  that sharing is per wine and separate from friendship.
- **Stamps and collections** — the Passport's counters, then across to
  `/achievements` to ring the collections section, then stamps.

Seen chapters are **ticked rather than hidden**: they are worth re-reading, and
a list that empties itself as you use it stops being somewhere to look things
up.

**There is deliberately no "adding wine" chapter.** The scan sheet already
explains its four modes in its own copy, every time it is opened. A chapter
would have had to prise that sheet open and then fight it for the layer it sits
on, to repeat a good explanation worse.

One consequence of navigating: a chapter crosses to a lazily loaded route, so
the anchor the next step wants does not exist at the moment the step asks for
it. The engine therefore waits for an anchor — watching for DOM changes, with a
1.2s grace period — before concluding it is missing. Declaring absence on the
first look would have skipped every step that follows a route change.

### Credits (members only, shown in context)

Not a chapter. A one-time panel inside the existing `CreditConfirmation`
dialog, the first time a member is asked to confirm a priced AI action:

> Credits pay for the AI work behind scanning labels and researching producers
> and vintages. You are shown the price before anything is spent, nothing is
> charged if you cancel, and your balance is on **Account & friends**.

The owner never sees it — owner AI is billed direct and costs no credits, so
the panel would be a lie. A cancel counts as having been told, since they read
it either way. Recorded as `credits-intro` in the same `tour_state`, because it
is the same kind of "already told you".

## 6. Files

Built:

| File | Purpose |
|------|---------|
| `src/lib/db/migrations/0091_tour_state.sql` | The column |
| `src/features/onboarding/steps.ts` | Step content as data, and the role/viewport filter |
| `src/features/onboarding/useTour.ts` | Active step, anchor measurement, replay hook |
| `src/features/onboarding/TourOverlay.tsx` | Spotlight, bubble, keyboard and focus |
| `src/features/onboarding/api.ts` | Reads `tour_state`, writes it through `PATCH /api/me/tour` |
| `src/onboarding.css` | Overlay styling |
| `worker/multiUser/auth.ts` | `PATCH /api/me/tour` and its validator |
| `worker/multiUser/common.ts`, `src/lib/auth/client.ts` | `tour_state` on the member/account types |
| `src/components/Layout.tsx` | `data-tour` anchors; mounts `<TourOverlay/>` beside `<CreditConfirmation/>` |
| `src/features/auth/AccountPage.tsx` | The tour list under Getting around |
| `src/features/auth/CreditConfirmation.tsx` | The one-time credits panel |
| `src/features/achievements/AchievementsPage.tsx` | The `collections` anchor |

Two deviations from the original plan, both deliberate:

- **No `src/lib/db/schema.ts` change.** That file has no app-user type; the
  account shape lives in `worker/multiUser/common.ts` and
  `src/lib/auth/client.ts`, and those are what changed.
- **Replay shipped in phase 2, not phase 3.** The closing step's copy promises
  it is there, so shipping the copy without the entry would have been a lie.

Added for phases 3–4: `chapters` in `steps.ts`, route handling and the anchor
grace period in `useTour.ts`, the chapter list in `AccountPage.tsx`, the
`collections` anchor on `AchievementsPage.tsx`, and the one-time panel in
`CreditConfirmation.tsx`.

The overlay follows the modal conventions already in `Layout.tsx` — Escape to
close, focus handed to the panel — with one deliberate departure: it is **not**
modal. The dim layer takes no pointer events and nothing locks the page, so
`aria-modal` is omitted rather than claiming a trap the overlay does not set.
Every anchor sits in the chrome that persists across routes, so someone who
taps a nav item mid-tour simply navigates and the next step is still on screen.

## 7. Build order

All four phases are built:

1. **Column and endpoint** — migration 0091, `PATCH /api/me/tour`, `tour_state`
   on the account types.
2. **Engine and first-run tour** — overlay, hook, steps, anchors, mounted in
   `Layout`, plus the replay entry.
3. **Chapters** — route-aware steps, the three chapters, the list on Account &
   friends with seen ticks.
4. **Credits panel** — the one-time member explanation in `CreditConfirmation`.

## 8. Testing

All green: 5575 unit tests across 337 files, plus 8 e2e tests.

Unit:

- `tests/unit/tourState.test.ts` (8) — the endpoint. Stores a finish and a skip,
  rejects a body that is not the expected shape, keeps only step ids the app
  could have issued, caps the list, and enforces the same-origin and session
  checks.
- `tests/unit/tourAnchors.test.ts` (13) — two guards against silent rot, both
  verified by mutation: **every anchor in a step exists in the rendered app**
  (deleting a `data-tour` fails it), and **every route a chapter navigates to is
  a route `App.tsx` actually has** (renaming one fails it). Plus both navs still
  carrying the shared anchors, the role/viewport filter, and distinct tour ids.
- `tests/unit/tourOverlay.test.tsx` (15) — opens for a new member, stays away
  from one who finished or skipped, walks forward and back, writes exactly once
  and only at the end, Escape counts as a skip, replay reopens it, a step whose
  anchor is absent is passed over *after* waiting, chapters name themselves, an
  unknown tour id is ignored, and closing a chapter part-way records nothing.
- `tests/unit/creditsIntro.test.tsx` (6) — the panel appears for a member's
  first priced action and not the second, never for the owner, a cancel still
  counts as told, and the action genuinely waits on the decision.

E2E (`tests/e2e/onboarding-tour.spec.ts`, 8 tests, chromium at two viewports) —
what jsdom cannot do. That the spotlight comes to rest around the nav item
**actually on screen**, top bar at 1280px and tab bar at 390px; that the phone
gets 6 steps and the desktop 7; that the bubble stays inside the viewport at
every step; and that a chapter started from Account navigates, waits for the
lazily loaded page, and rings a section of it.

Two bugs these found, both of which would otherwise have shipped:

- The step-skipping logic treated "not measured yet" and "measured and absent"
  as the same `null`, so **step one of every tour was skipped** — the tour
  opened on step 2.
- Concluding absence on the first look **skipped every chapter step that
  follows a route change**, because a lazily loaded page has not rendered yet
  when the step asks for its anchor.

## 9. Things worth your decision

- **Pilot timing.** Members are invite-only today, so the tour will first be
  seen by people you invited personally and could brief by hand. That is
  arguably the best time to ship it — small, forgiving audience.
- **The deeper fix the tour only papers over.** Four significant features have
  no mobile nav entry. A tour makes them findable once; it does not make them
  reachable. At some point the answer is a "More" slot in the bottom bar or a
  Passport that links out to all of them. Worth planning separately —
  `docs/app-layout-improvements.md` and `docs/remaining-layout-redesign.md`
  look like where that conversation already lives.
- **Copy.** The wording that shipped is a first draft, not finished text. You
  know how you want this app to sound; it all sits in `steps.ts` precisely so
  you can rewrite it without touching any logic. The anchor test will tell you
  if you break a pointer while editing.
- **Whether a phone needs its own Tastings step.** Right now the subject rides
  inside the scan step on a phone. If pilot members still miss Tastings, that is
  the first thing to add.
