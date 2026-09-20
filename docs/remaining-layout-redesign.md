# Remaining layout redesign

Continues merged PR283, preserving the existing colors, typography, permission rules and APIs.

## Account and owner navigation

Account uses `?section=profile|friends|usage`; Profile is the default. All sections remain mounted so drafts survive navigation. Incoming friend requests appear before existing friends and invitation tools. Sharing options retain owner-only bulk sharing and its existing confirmation. Friend and usage resources settle independently, with local retries and section-specific feedback. Failed usage is never displayed as zero usage.

Owner controls use `?section=members|usage|access|maintenance`. The legacy `/admin#member-usage` opens Usage. Budget and reconciliation warnings remain visible across sections. Saving a member action does not discard draft policy or budget changes. Invitations move into Members; maintenance failures do not block loading member data.

## Journal

Grid cards remain photo, name, producer, vintage, score and favorite only. No tasting/event, venue, date or shared-by copy is added. Shared-wine color and accessible ownership labels are retained. List view retains its richer metadata. Journal and cellar share a compact header and the existing exclusive scope navigation. Active filters can be removed without opening the disclosure. Page information stays in the pagination control. No-results and empty-journal states are distinct. Batch editing traps focus, handles Escape and restores focus to the trigger.

## Other page families

Passport moves recent wines ahead of milestones and uses theme tokens for its progress ring. Insights groups existing calculations into Overview, Preferences and History with anchor navigation. Producer, tasting, scan, printed-list and research pages use the shared compact header. Tasting management actions are disclosed separately from Log a wine, and deletion is isolated. Wine forms identify identity, facts and experience sections and reveal invalid fields inside disclosures. Collection, legal, login and dialog layouts receive responsive spacing and overflow refinements without changing their specialized content or artwork. The friend-tag dialog restores focus on dismissal.

## Validation

`npm run test`, `npm run lint`, `npm run build`, and `npm run test:e2e:layout`.

The layout browser suite uses synthetic API responses, checks owner/member behavior, old admin deep links, retained drafts, usage failure isolation, succinct/shared Journal cards, filter removal and dialog focus. It captures page-family screenshots and checks overflow at desktop, 320px dark mode and iPhone 15 Pro/Pro Max WebKit sizes. The same configuration includes PR283's wine-detail and iPhone regressions (including landscape and safe areas). These are browser emulations, not physical-device tests. No deployment or database migration is part of this change.
