# Save reliability and private thumbnails

## Save changes

The normal JSON and multipart wine create/edit endpoints now validate tasting structure as part of the wine input. A single D1 `batch()` commits the wine row, photo rows (when supplied), tasting, latest experience, live-tasting activity and optional structure together. A database failure rolls the batch back and returns an error instead of reporting that the wine was fully saved. Failed multipart creation removes the R2 objects uploaded for that attempt.

Clearing every experience field updates the latest experience to empty values. The row is retained so an older experience cannot reappear as the latest. Editing a wine without any experience does not create an empty one. Omitting `tastingStructure` preserves it for older clients; sending `null` clears it.

Producer/cuvée linking remains a separate existing post-save operation. Group/batch promotion retains its existing workflow and separate structure endpoint; this change does not make all application operations one global transaction. Network interruption after a successful commit also remains distinct from a database rollback.

## Thumbnail delivery

- Small wine photos use `/api/images/:id?variant=thumbnail`.
- The Worker authenticates the request and checks image ownership in D1 before accessing either R2 or its internal edge cache. Cached thumbnails cannot bypass this check.
- Cloudflare's `IMAGES` binding reads private R2 bytes and produces one WebP variant, fitting inside 640 × 640 pixels without cropping or enlargement, at quality 75.
- The internal Cache API retains the transformed image for up to 30 days, subject to eviction and data-centre locality. Responses sent to the browser are always private and cacheable for one day.
- The default `/api/images/:id` continues to serve the original. The full-size viewer and story exports use that route. Thumbnail and original blob caches in the UI are separate.
- Missing bindings, transformation failures and exhausted free transformation allowance fall back to the original with a short five-minute browser cache. An original fallback is never put in the thumbnail edge cache.
- Existing photos benefit on first view. No migration, bulk backfill, new R2 bucket, permanent derivative storage or extra D1 writes are required.

## Cloudflare feasibility and free-tier constraints

Checked against Cloudflare documentation on 9 September 2026:

| Option | Suitability |
| --- | --- |
| Images binding with existing private R2 originals | Selected. Supports raw private image streams, one fixed transformation and authenticated delivery. |
| Public transformation URLs | Not selected: exposing original photos through public URLs is unnecessary. |
| Hosted Cloudflare Images storage | Not selected: hosted storage/delivery requires Images Paid. |
| Browser-generated persistent thumbnails | Possible, but adds upload/promotion/deletion handling and requires a separate path for existing photos. |

Cloudflare Images Free includes **5,000 unique transformations per calendar month**. Once exhausted, new transformations fail with error `9422`, without overage charges on the Free plan. Repeated transformations of identical source bytes and parameters in the same month count once. This implementation uses one fixed variant and catches failure to keep photos viewable.

**Keep the account on Images Free.** The code cannot inspect or change your billing plan. An account already on Images Paid can incur usage charges beyond its included allowance. This PR does not subscribe to a paid plan, provision hosted Images storage, change account billing or deploy the Worker.

The feature also uses the existing Workers, D1 and R2 request allowances; it does not make unlimited usage free or change the billing requirements of the app's existing queues. Cache misses still read the original from R2, and each server request checks ownership in D1. Browser cache hits avoid those requests.

The Wrangler configuration declares the `IMAGES` binding. No public R2 access is needed. After deploying, verify a signed-in thumbnail request returns `image/webp`, then open the same photo full size and verify the original still loads. Check the account's Images plan and usage in the dashboard before deployment. If the binding is unavailable, the fallback preserves usability but provides no thumbnail bandwidth reduction.

Sources:
- [Images pricing](https://developers.cloudflare.com/images/pricing/)
- [Optimize with Workers: private bytes, binding configuration and caching](https://developers.cloudflare.com/images/optimization/binding/)
- [Workers pricing and Free limits](https://developers.cloudflare.com/workers/platform/pricing/)

## Verification

Regression tests exercise the deployed Worker entrypoint with the full migration chain in SQLite and actual transaction rollback. They cover cleared values, older experiences, omitted structure, invalid structure, ownership, JSON/multipart failure and retry, and R2 cleanup. Thumbnail tests cover authentication on cache hits, deletion, fixed resize parameters, original delivery, cache failure and free-allowance fallback; a React test checks that enlarging a thumbnail requests and displays the original.

Cloudflare's production image service, the live account's plan and real-photo bandwidth savings are not exercised by these local tests.
