# Producer range research — Phase 2

Phase 2 changes only producer **range/catalogue refreshes**. It is embedded inside the existing Producer research workflow: there is no separate Range Refresh button. The same **Research producer / Refresh producer research** action starts the job, and Phase 2 decides internally whether the range can be refreshed cheaply from official sources. The existing grounded Gemini pipeline remains the quality fallback.

## Normal refresh path

When a producer already has a fresh saved profile and an official website, WineLog first:

1. reuses saved official range/source URLs;
2. crawls a small same-domain set of likely wine/range pages;
3. sends only that retrieved evidence to Z.AI GLM-4.7-Flash through Cloudflare AI Gateway BYOK for structured extraction;
4. commits the result only when the model says the evidence is complete and the range passes conservative coverage checks;
5. otherwise falls through to the existing Gemini 3.8/3.7 + Google Search workflow unchanged.

If the profile itself needs refreshing, the job also goes straight to the existing grounded Producer + Range research path. The user never has to choose a provider or start a separate range-research action.

No model is allowed to browse in the cheap path. Webpage text is treated as untrusted evidence, and returned source URLs must be URLs WineLog actually fetched.

## GLM provider

The only cheap range extractor is Z.AI `glm-4.7-flash` routed through the existing Cloudflare AI Gateway. The Z.AI provider key is stored in **AI Gateway BYOK** and is never stored in WineLog Worker variables or sent by WineLog as an upstream `Authorization` header.

The range-research provider order is:

1. Cloudflare AI Gateway custom provider `zai` -> Z.AI `glm-4.7-flash` using the Gateway-stored BYOK key;
2. the existing grounded Gemini + Google Search pipeline if Z.AI/Gateway is unavailable, fails, or the official-source evidence cannot establish a safe complete range.

Cloudflare Workers AI is **not** a Producer Range fallback. The Workers AI binding remains configured separately because Journal semantic search uses it.

WineLog continues to authenticate to AI Gateway with `CF_AI_GATEWAY_TOKEN`, and follows the existing `AI_GATEWAY_LOG_PAYLOADS` setting. Provider credentials remain inside AI Gateway.

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

As of September 2026 Z.AI lists GLM-4.7-Flash API tokens as free. If that primary path cannot be used, WineLog spends on the existing Gemini grounded fallback rather than attempting Cloudflare-hosted GLM.

## Missing wines and durable corrections

Duplicate/hide decisions continue to work as before. Phase 2 adds the opposite correction:

- **Add missing wine** stores a user-confirmed catalogue row separately from AI research.
- An incomplete official-source pass can surface **Possible missing wines** rather than silently changing the range.
- Suggestions can be added or ignored.
- Manual additions are replayed after every direct or grounded refresh, so replacing machine research cannot delete a user-confirmed wine.

The **+ Add missing wine** control is a manual catalogue correction, not another research or refresh button.

`catalog_researched_json` is the replaceable machine-researched base; `catalog_json` remains the visible, corrected range consumed by the rest of the app.

## Measuring the improvement

Z.AI GLM calls are recorded in the existing AI usage ledger as Producer Deep Search parts with **0 Google Search queries**. This makes before/after comparison available in the current Insights drill-down without a second analytics system.

Expected repeat-refresh targets:

- 0 grounded searches when official evidence is complete;
- 70–90% fewer grounded searches across repeat range refreshes;
- 70–90% fewer output tokens for stable producers;
- 80%+ lower marginal inference/search cost on successful direct-source refreshes.

Those are targets, not hard-coded assumptions. Actual requests, tokens, model parts and fallback frequency are measured by the existing usage ledger.
