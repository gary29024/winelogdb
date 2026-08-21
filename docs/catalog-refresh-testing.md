# Producer catalogue refresh regression checklist

1. Existing producer catalogue remains visible while a refresh is running.
2. A failed slice is retried without exposing a partial new catalogue.
3. Repeated-character output is rejected before staging.
4. A suspicious large range shrink is not committed.
5. A complete healthy refresh replaces the catalogue once, then synchronizes catalogue cuvée identities.
6. Cancelling research removes request-scoped staging and leaves the prior visible catalogue intact.
7. Profile & range references are collapsed by default on the producer page.
