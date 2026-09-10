# Save reliability and private thumbnails

## Save changes

The normal JSON and multipart wine create/edit endpoints now validate tasting structure as part of the wine input. A single D1 `batch()` commits the wine row, photo rows (when supplied), tasting, latest experience, live-tasting activity and optional structure together. A database failure rolls the batch back and returns an error instead of reporting that the wine was fully saved. Failed multipart creation removes the R2 objects uploaded for that attempt.

This intentionally changes live-tasting activity failure handling: closing or touching the active tasting previously ignored database errors. Those writes now participate in the same transaction, so failure rolls back the wine save and the user can retry. Historical wine edits still do not close or touch the active tasting.

Clearing every experience field updates the latest experience to empty values. The row is retained so an older experience cannot reappear as the latest. Editing a wine without any experience does not create an empty one. Omitting `tastingStructure` preserves it for older clients; sending `null` clears it.

Producer/cuvée linking remains a separate existing post-save operation. Group/batch promotion retains its existing workflow and separate structure endpoint; this change does not make all application operations one global transaction. Network interruption after a successful commit also remains distinct from a database rollback.

## Thumbnail delivery

- Small wine photos use `/api/images/:id?variant=thumbnail`.
- The Worker authenticates the request and checks image ownership in D1 before accessing either R2 or its internal edge cache. Cached thumbnails cannot bypass this check.
- Cloudflare's `IMAGES` binding reads private R2 bytes and produces one WebP variant, fitting inside 640 × 640 pixels without cropping or enlargement, at quality 75.
- Delivery checks the edge cache, then a permanent private R2 derivative at `thumb/v1/<original-object-key>.webp`, before reading and transforming the original. Generated WebPs are stored in the existing bucket using Standard storage; R2 and edge writes run in `waitUntil` without delaying the image response. Stored thumbnails also work when the Images binding is unavailable.
- Deleting a photo or wine removes its derivative along with the original. A check after persistence removes a derivative if deletion raced the background write. Cleanup remains best-effort during storage/database failures.
- The internal Cache API retains the transformed image for up to 30 days, subject to eviction and data-centre locality. Cache writes run in `waitUntil` so first-view delivery does not wait for them. Responses sent to the browser are always private and cacheable for one day.
- The default `/api/images/:id` continues to serve the original. The full-size viewer and story exports use that route. Thumbnail and original blob caches in the UI are separate.
- Missing bindings, transformation failures and exhausted free transformation allowance fall back to the original with a short five-minute browser cache. An original fallback is never stored as a thumbnail in R2 or the edge cache. A failed R2 derivative read falls back without assuming the thumbnail is missing and regenerating it.
- Existing photos get persistent thumbnails on their first uncached view; no re-upload, migration, bulk backfill or new bucket is required. The internal edge-cache namespace changes to populate R2 for previous photos. Previously cached browser images may remain until their cache expires. Generation adds one R2 write and one indexed D1 read to check for concurrent deletion, with no D1 writes.

## Cloudflare feasibility and free-tier constraints

Checked against Cloudflare documentation on 9 September 2026:

| Option | Suitability |
| --- | --- |
| Images binding with existing private R2 originals | Selected. Supports raw private image streams, one fixed transformation and authenticated delivery. |
| Public transformation URLs | Not selected: exposing original photos through public URLs is unnecessary. |
| Hosted Cloudflare Images storage | Not selected: hosted storage/delivery requires Images Paid. |
| Browser-generated persistent thumbnails | Possible, but adds upload/promotion/deletion handling and requires a separate path for existing photos. |

Cloudflare Images Free includes **5,000 unique transformations per calendar month**. Once exhausted, new transformations fail with error `9422`, without overage charges on the Free plan. Repeated transformations of identical source bytes and parameters in the same month count once. This implementation uses one fixed variant. Once its R2 write succeeds, future edge-cache misses reuse the derivative without invoking Images, including in later months or other data centres. This is not an exactly-once guarantee: concurrent first requests, failed persistence, manual/lifecycle deletion or a new thumbnail version can cause regeneration. The retained object has no application expiry; keep bucket lifecycle policies in mind.

**Keep the account on Images Free.** The code cannot inspect or change your billing plan. An account already on Images Paid can incur usage charges beyond its included allowance. This PR does not subscribe to a paid plan, provision hosted Images storage, change account billing or deploy the Worker.

The feature also uses the existing Workers, D1 and R2 request allowances; it does not make unlimited usage free or change the billing requirements of the app's existing queues. Edge-cache misses normally read the small derivative from R2; only a missing derivative needs the original and a transform. Each server request checks ownership in D1. Browser cache hits avoid those requests.

The Wrangler configuration declares the `IMAGES` binding. No public R2 access is needed. After deploying, verify a signed-in thumbnail request returns `image/webp`, then open the same photo full size and verify the original still loads. Check the account's Images plan and usage in the dashboard before deployment. If the binding is unavailable, retained R2 thumbnails still work; photos without one fall back to originals.

R2 Standard free allowances are shared account-wide: **10 GB-month of storage, 1 million Class A operations and 10 million Class B operations per month**, with free egress. The explicit `storageClass: Standard` prevents new derivatives from inheriting a bucket default of Infrequent Access, which is outside the R2 free tier. Derivatives add storage and one write per successful generation; edge misses add reads. R2 bills usage beyond its free allowances, unlike the Images Free transformation limit. This code does not inspect account-wide usage or impose a spending cap.

Sources:
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [R2PutOptions: omitted storage class inherits the bucket default](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/#r2putoptions)
- [Images pricing](https://developers.cloudflare.com/images/pricing/)
- [Optimize with Workers: private bytes, binding configuration and caching](https://developers.cloudflare.com/images/optimization/binding/)
- [Workers pricing and Free limits](https://developers.cloudflare.com/workers/platform/pricing/)

## Verification

Regression tests exercise the deployed Worker entrypoint with the full migration chain in SQLite and actual transaction rollback. They cover cleared values, older experiences, omitted structure, invalid structure, ownership, JSON/multipart failure and retry, and R2 cleanup. Thumbnail tests cover authentication on cache hits, deletion, fixed resize parameters, original delivery, cache failure, free-allowance fallback, R2 reuse after eviction, persistence failure, derivative deletion and a concurrent deletion race; a React test checks that enlarging a thumbnail requests and displays the original.

Cloudflare's production image service, the live account's plan and real-photo bandwidth savings are not exercised by these local tests.
