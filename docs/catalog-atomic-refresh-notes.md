# Producer catalogue refresh invariants

This implementation deliberately separates Gemini slice retrieval from the live producer catalogue.

- A refresh stages bounded catalogue slices by research request ID.
- The visible `producers.catalog_json` is not changed until staged slices cover A–Z plus non-letter initials.
- Repeated-character / low-diversity generation artifacts are rejected before staging.
- A refresh that would cut an established catalogue below 50% of its prior canonical size is rejected and retried rather than committed.
- On terminal failure or cancellation, staged rows are discarded and the previous visible catalogue stays intact.
- On success, the complete staged range and the current run's profile/range sources replace the prior visible catalogue/source projection in one final producer update.

The staging table is temporary operational state, not research history. Existing research history remains the audit trail for prior accepted producer research.
