# Onboarding tour for invited members

Status: proposed plan, nothing implemented yet.
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
Which means **Tastings**, **Insights**, **Achievements**, **Shared with me**
and **Account & friends** have no mobile nav entry at all. They are reachable
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

### First-run tour (6 steps, everyone)

Triggered on the first load of `/` when `tour_state` has no `first-run` entry.

| # | Points at | Says, roughly |
|---|-----------|---------------|
| 1 | Passport nav item | "This is your Passport — the map, stamps and progress of everything you have drunk. It fills in as you log wines." |
| 2 | Journal nav item | "Every wine you log lives here. **Your cellar is in here too** — bottles you own but have not opened yet are a tab at the top of this page, not a separate section." |
| 3 | Scan Wine button | "One button, four ways to add a bottle. Open it and the sheet explains each one — the short version is: one bottle, a lineup photo, a big batch, or an evening with friends." |
| 4 | Producers / Vintages | "Background on who made the wine and how a year turned out. These fill themselves in from your journal." |
| 5 | Account & friends (top bar) | "Your account, your friends, and what you share with them. Sharing a wine is separate from being friends — you choose per wine." |
| 6 | Nothing (closing card) | "That is the tour. Add your first bottle whenever you like, and you can replay this from Account & friends." |

Step 2 is the single most valuable step, which is why the cellar sentence is
bold. Step 5 earns its place because sharing-vs-friendship is a genuinely
non-obvious distinction in this app's model.

### Optional chapters

Offered from Account & friends, and each one short:

- **Adding wine** (4 steps) — walks the open scan sheet and names the four
  modes with when to use each.
- **Tastings** (3 steps) — that an evening is a container, that logged wines
  join the open one automatically, and where the live strip appears. Worth its
  own chapter precisely because Tastings has no mobile nav slot.
- **Sharing and friends** (3 steps, member-visible) — friend codes, per-wine
  sharing, and that "Shared with me" at `/shared` is where friends' wines
  arrive.
- **Progress** (3 steps) — Passport stamps, Insights, Achievements and
  collections. Also nav-less on mobile.

### Credits (members only, shown in context)

Not a chapter. A one-time explanatory panel inside the existing
`CreditConfirmation` modal, the first time a member is asked to confirm a
priced AI action:

> AI actions like label recognition and vintage research cost credits. This
> confirmation shows the price before anything is spent, and nothing is
> charged if you cancel. Your balance is on Account & friends.

The owner never sees it — `roles:['member']`. This is a better teaching moment
than day one, because the member is looking at a real price for a real action
they just asked for.

## 6. Files

New:

| File | Purpose |
|------|---------|
| `src/features/onboarding/steps.ts` | Step and chapter content as data |
| `src/features/onboarding/TourOverlay.tsx` | The spotlight + bubble, keyboard and focus handling |
| `src/features/onboarding/useTour.ts` | Which tour is active, step index, filtering by role/viewport |
| `src/features/onboarding/api.ts` | `PATCH /api/me/tour` |
| `src/onboarding.css` | Overlay styling, matching the existing per-feature CSS convention |
| `src/lib/db/migrations/0091_tour_state.sql` | The column |

Changed:

| File | Change |
|------|--------|
| `src/components/Layout.tsx` | `data-tour` attributes on nav items and the scan trigger; mount `<TourOverlay/>` beside the existing `<CreditConfirmation/>` |
| `worker/multiUser/auth.ts` | `PATCH /api/me/tour` |
| `src/features/auth/AccountPage.tsx` | "Replay tutorial" + chapter list |
| `src/features/auth/CreditConfirmation.tsx` | The one-time credits panel |
| `src/lib/db/schema.ts` | `tour_state` on the user type |

The overlay follows the modal conventions already in `Layout.tsx`: `role="dialog"`,
`aria-modal`, Escape to close, `body` overflow locked while open, focus handed
to the bubble and returned to the opener on close. Those patterns are already
written in this codebase and should be reused rather than reinvented.

## 7. Build order

Each phase is independently shippable and useful on its own.

1. **Column and endpoint.** Migration 0091, `PATCH /api/me/tour`, `tour_state`
   on the client account type. Nothing visible yet; verifiable by test.
2. **Engine and first-run tour.** Overlay, hook, the 6 steps, `data-tour`
   attributes, mount in `Layout`. This is the phase that solves the actual
   problem — ship it and stop if nothing else gets done.
3. **Replay and chapters.** Account page entry, the four optional chapters.
4. **Credits panel.** The one-time member explanation in `CreditConfirmation`.

## 8. Testing

Unit (`tests/unit`, which has 335 files of precedent):

- Step filtering: a member does not get owner steps, an owner does not get the
  credits panel, mobile and desktop get their own nav steps.
- Persistence: finishing writes `completed`, skipping writes `skipped`, and a
  returning member with a populated `tour_state` gets no tour.
- Anchor integrity: **every `anchor` in `steps.ts` has a matching `data-tour`
  in the rendered app.** This is the test that stops the tour rotting silently
  when someone restyles the nav.

E2E: a first-run walkthrough on `playwright.iphone.config.ts`, since the
mobile bottom bar is where the discoverability problem actually lives.

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
- **Copy.** The table above is my first draft of the wording, not finished
  text. You know how you want this app to sound; the content sits in one data
  file precisely so you can rewrite it without touching any logic.
