# How screens load data

Every screen reads from the server through one place, `src/lib/query/client.ts`. It keeps one copy of
each answer, shares it between the screens that show it, and knows when it has stopped being true.

## Reading

| Use | When |
| --- | --- |
| `useLoad(key, load)` | A component shows something from the server. Returns `data`, `loading`, `failed`, `error` and `retry`. |
| `readShared(key, load)` | Code outside a component needs the same answer: a form filling itself in once, or a handler waiting for the refreshed record after its own save. |
| `setLoaded(key, next)` | A save returned the record as it now stands, and the screen should show it without another read. |

`key` names the answer. Two screens that use the same key share one request and one copy, so use the
same key for the same thing: `['wine', id]`, `['tasting', id]`, `['producer', id]`, `['tastings']`.

## When an answer stops being true

- **Any successful write** made through `apiFetch` calls `dataChanged()`. Open screens ask again in the
  background and copies kept for closed screens are dropped. A new write needs no extra code.
- **`discard(key)`** drops one named answer. `summariesChanged()` uses it for the Passport and the
  collections.
- **Changing account** forgets everything.

## Policies

Pass one as the third argument when the default does not fit.

| Policy | Meaning | Used by |
| --- | --- | --- |
| `summary` | Good for thirty seconds and left alone by ordinary writes; only `discard` makes it stale. | Passport, collections |
| `pinned` | Read once and kept until `discard`. | The open tasting |
| `keepPrevious` | Keep the last page on screen, with `loading` true, while the next arrives. | Cellar list |
| `skip` | Do not ask yet, because there is no id to ask about. | Pages opened without an id |

A loader that takes a parameter is given an `AbortSignal`, and its request is abandoned when the screen
closes or the key changes.

## What is deliberately not on it

- **The Journal list** (`LibraryPage`). It keeps the previous page painted with an error beside it when
  the next page fails, restores saved filters, and redirects from a page that no longer exists. Those
  are woven through one effect and are covered by their own tests.
- **Forms that fill themselves in once** (wine edit, open bottle, shared wine notes). A background
  refresh must not overwrite what someone is typing.
- **Small one-off probes** such as the cellar strip on a wine page, which ask once per visit and would
  otherwise be asked again after every unrelated save on that page.
- **Images and other blobs**, which are object URLs with their own lifetime.
- **Research status polling**, which is a timer, not an answer to keep.
- **Static reference data** (vintage charts, vineyard maps), which is loaded as files and cached by the
  browser.

## Tests

`tests/unit/dataLoading.test.tsx` covers the loader. It also lists the screens that have moved, so a
screen that goes back to hand-written loading state fails there.
