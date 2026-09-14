# Producer range research — Phase 2

Phase 2 changes only producer **range/catalogue refreshes**. It is embedded inside the existing Producer research workflow: there is no separate Range Refresh button. The same **Research producer / Refresh producer research** action starts the job, and Phase 2 decides internally whether the range can be refreshed cheaply from official sources. The existing grounded Gemini pipeline remains the quality fallback.

## Normal refresh path

When a producer already has a fresh saved profile and an official website, WineLog first:

1. reuses saved official range/source URLs;
2. crawls a small same-domain set of likely wine/range pages;
3. sends only that retrieved evidence to Z.AI GLM-4.7-Flash through Cloudflare AI Gateway BYOK for structured extraction;
4. retries only known transient Z.AI 429 conditions, up to three total Z.AI attempts;
5. if Z.AI remains unavailable or returns an invalid model result, tries the separately hosted Cloudflare Workers AI copy of GLM-4.7-Flash;
6. commits a cheap-path result only when the model says the evidence is complete and the range passes conservative coverage checks;
7. otherwise falls through to the existing Gemini 3.8/3.7 + Google Search workflow unchanged.

If Z.AI successfully extracts a range but the official evidence itself is incomplete, WineLog does **not** spend on a second copy of the same model: it goes directly to grounded Gemini. Workers AI is the resilience fallback for provider/model failure, not a second opinion on weak source evidence.

If the profile itself needs refreshing, the job also goes straight to the existing grounded Producer + Range research path. The user never has to choose a provider or start a separate range-research action.

No model is allowed to browse in the cheap path. Webpage text is treated as untrusted evidence, and returned source URLs must be URLs WineLog actually fetched.

## GLM provider chain

The primary cheap extractor is Z.AI `glm-4.7-flash` routed through the existing Cloudflare AI Gateway. The Z.AI provider key is stored in **AI Gateway BYOK** and is never stored in WineLog Worker variables or sent by WineLog as an upstream `Authorization` header.

The range-research provider order is:

1. Cloudflare AI Gateway custom provider `zai` -> Z.AI `glm-4.7-flash` using the Gateway-stored BYOK key;
2. Cloudflare Workers AI -> `@cf/zai-org/glm-4.7-flash`, using the existing `AI` binding and no additional provider key;
3. the existing grounded Gemini + Google Search pipeline if both cheap providers fail or the official-source evidence cannot establish a safe complete range.

Workers AI is independently hosted by Cloudflare, so a Z.AI provider-side rate limit does not automatically imply the Workers AI copy is unavailable. The same official evidence, validation rules and durable catalogue overlay are used before a Workers AI result can be committed.

WineLog continues to authenticate to AI Gateway with `CF_AI_GATEWAY_TOKEN`, and follows the existing `AI_GATEWAY_LOG_PAYLOADS` setting. Provider credentials remain inside AI Gateway. The Workers AI path uses the existing Cloudflare binding and needs no secret.

### One-time Cloudflare setup

Create a Custom Provider in **AI > AI Gateway > Custom Providers**:

- Name: `Z.AI`
- Slug: `zai`
- Base URL: `https://api.z.ai`
- Enabled: yes

Then open the `winelog` AI Gateway and add the Z.AI provider key through **Provider Keys / BYOK** using the default alias. Do not create a `ZAI_API_KEY` Worker secret.

WineLog calls:

```text
https://gateway.ai.cloudflare.com/v1/{account-id}/winelog/custom-zai/api/paas/v4/chat/completions
```

AI Gateway appends `/api/paas/v4/chat/completions` to the Custom Provider base URL and injects the stored provider credential upstream.

As of September 2026 Z.AI lists GLM-4.7-Flash API tokens as free. WineLog keeps that as the first choice, but repeated transient rate limits now have a bounded retry and an independent Workers AI fallback before grounded Gemini is used.

## Missing wines and durable corrections

Duplicate/hide decisions continue to work as before. Phase 2 adds the opposite correction:

- **Add missing wine** stores a user-confirmed catalogue row separately from AI research.
- An incomplete official-source pass can surface **Possible missing wines** rather than silently changing the range.
- Suggestions can be added or ignored.
- Manual additions are replayed after every direct or grounded refresh, so replacing machine research cannot delete a user-confirmed wine.

The **+ Add missing wine** control is a manual catalogue correction, not another research or refresh button.

`catalog_researched_json` is the replaceable machine-researched base; `catalog_json` remains the visible, corrected range consumed by the rest of the app.

## Measuring the improvement

Both GLM routes are recorded in the existing AI usage ledger as Producer Deep Search parts with **0 Google Search queries**:

- Z.AI BYOK: `zai/glm-4.7-flash`
- Workers AI: `@cf/zai-org/glm-4.7-flash`

That separation makes it possible to see how often Z.AI succeeds, how often Workers AI rescues a provider failure, and how often the run still reaches grounded Gemini. The Workers AI ledger uses list token pricing so comparisons remain conservative even while a daily free Neuron allowance absorbs actual spend.

Expected repeat-refresh targets:

- 0 grounded searches when official evidence is complete;
- 70–90% fewer grounded searches across repeat range refreshes;
- 70–90% fewer output tokens for stable producers;
- 80%+ lower marginal inference/search cost on successful direct-source refreshes.

Those are targets, not hard-coded assumptions. Actual requests, tokens, model parts and fallback frequency are measured by the existing usage ledger.

## Debugging a run that appears stuck

A missing `thumb/v1/...` R2 object is a thumbnail cache miss, not a producer research failure. The image route reads the original and generates a derivative when Images is available, or serves the original as a fallback. Check the enclosing image HTTP response before treating a missing-object storage span as a failed request.

For research, correlate `producer_range_route` and `producer_range_phase2` logs by `requestId`. The latter includes Z.AI attempts/retries, Workers AI attempts, model errors, parsing failures, incomplete-evidence fallback, and successful completion. Adding a Gateway provider key does not guarantee a Z.AI call: the official-site evidence must first pass the crawl gate.

Website requests have a six-second timeout and each cheap-path crawl visits at most six URLs. Z.AI waits up to 60 seconds for its first streamed response, uses a 30-second idle-stream timeout, and has a 180-second absolute stream ceiling. Known transient Z.AI 429 codes (`1302`, `1303`, `1305`, `1312`) receive at most two retries, respecting a valid `Retry-After` header up to 30 seconds or otherwise using short jittered backoff. Workers AI gets one bounded 75-second fallback attempt. These are provider-stage limits, not limits on the whole research run. Gemini has its own bounded polling and retry policy. Runs with no progress for 45 minutes are marked failed when their status is read; active-run lookup uses that same window.

The provider key belongs to AI Gateway's `zai` custom provider with its default BYOK alias. A Worker secret named `ZAI_API_KEY` alone is not consumed by this path. Confirm actual attempts in Insights / AI spend / Producer Deep Search / View runs / Request breakdown (`zai/glm-4.7-flash` or `@cf/zai-org/glm-4.7-flash`), or the correlated Gateway/Workers logs. A recorded attempt does not by itself prove that extraction succeeded.

Failed Gateway calls also emit `producer_range_phase2` / `gateway_error` with `requestId`, `producerId`, `httpStatus`, and (when available) `providerCode`, a safe `providerMessage` category, and validated `retryAfter`. Only numeric or allowlisted symbolic codes are retained. Raw messages, payloads, headers, and credentials are never logged by this diagnostic; unrecognized messages are withheld. Error-body reads are capped at 16 KiB and remain inside the existing model timeout. Full Gateway payload logging is not required.
PR review hardening: Retry-After longer than 30 seconds skips further Z.ai attempts and advances to the Workers AI fallback; it is never shortened into an early retry. Cancellation is checked after retry waits and after the Workers AI crawl. Both providers share URL discovery, prioritization, tracking deduplication, apex fallback, and evidence prompting. The Workers AI 75-second timeout aborts its binding request as well as ending the wait.
