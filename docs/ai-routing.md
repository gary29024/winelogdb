# WineLog AI routing policy

WineLog separates **model policy** from **transport**. Model identifiers live in `src/lib/ai/policy.ts`; feature code should import them rather than hard-code current model names.

The policy deliberately keeps Gemini 3.1 Flash Lite where WineLog already uses it for low-cost recognition, Champagne extraction and first-pass vintage intelligence.

## Route inventory

| WineLog use case | Current transport | Current model order | Cloudflare Dynamic Route | Policy |
| --- | --- | --- | --- | --- |
| Single wine recognition | Gemini native `generateContent` through AI Gateway / Vertex when configured | `gemini-3.1-flash-lite` | No | Keep native multimodal JSON-schema behavior. |
| Group / sheet / framing recognition | Gemini native `generateContent` | `gemini-3.1-flash-lite` | No | Same low-cost recognition primary. |
| Recognition escalation | Gemini native synchronous request today | `gemini-3.8-flash` then availability target `gemini-3.7-flash` | `dynamic/winelog-recognition-escalation` | Dynamic-routing candidate. WineLog still decides whether the escalated answer is actually better. |
| Batch recognition | Vertex Flex through AI Gateway, or Developer API Batch when Gateway is absent | `gemini-3.1-flash-lite`, escalation `gemini-3.8-flash` | No | Keep provider-native Flex/Batch semantics. |
| Champagne photo extraction | Vertex Flex through AI Gateway, or Developer API Batch | `gemini-3.1-flash-lite` | No | Intentionally remains on 3.1 Flash Lite. |
| Wine Deep Search | Native Gemini/Vertex grounded research, durable Flex/Batch execution | `gemini-3.8-flash` -> `gemini-3.7-flash` | No | Google Search grounding and WineLog's grounding/quality gate are required. |
| Producer profile + catalogue research | Native Gemini/Vertex grounded research | `gemini-3.8-flash` -> `gemini-3.7-flash` | No | Same grounding and durable background constraints as wine research. |
| Vintage Window / Vintage Intelligence | Native grounded Gemini request | `gemini-3.1-flash-lite` -> `gemini-3.8-flash` | No | Keep cheap first pass; escalation only when evidence/result is unusable. |
| Producer Range direct extraction | AI Gateway custom Z.AI, then Workers AI, then grounded Gemini fallback | `zai/glm-4.7-flash` -> `@cf/qwen/qwen3-30b-a3b-fp8` -> grounded Gemini | `dynamic/winelog-producer-range-extraction` | Text-only extraction is a Dynamic Routing candidate, but WineLog must still enforce completeness/coverage before accepting it. |
| Journal semantic query/index embeddings | Workers AI by default; optional Gemini Embeddings | `@cf/qwen/qwen3-embedding-0.6b` or `gemini-embedding-001` | No | Embeddings are not chat-completion Dynamic Routes. |

## Ownership boundary

Cloudflare should eventually own **infrastructure failover** for compatible synchronous inference: provider errors, timeouts, retry count and model availability. WineLog continues to own domain correctness: schema validation, label evidence rules, confidence/identity selection, producer-range coverage, grounding validation and research-quality gates.

Grounded research, Vertex Flex and Gemini/Developer Batch remain on provider-native endpoints through AI Gateway because Dynamic Routes currently run through the OpenAI-compatible `/compat/chat/completions` surface rather than the native Gemini/Vertex request APIs.

## Dynamic route targets

The two route names reserved by the policy are:

- `dynamic/winelog-recognition-escalation`: Gemini 3.8 Flash primary -> Gemini 3.7 Flash fallback for compatible synchronous recognition escalation.
- `dynamic/winelog-producer-range-extraction`: Z.AI GLM-4.7-Flash primary -> Workers AI Qwen3-30B-A3B fallback for the text-only official-site extraction stage.

Do **not** switch application callers merely because the names exist in code. Deploy and validate the corresponding AI Gateway Dynamic Route first. The route should only replace transport availability logic; WineLog's existing quality gate remains authoritative.

## Changing a model

For a normal model refresh, edit `AI_MODELS` in `src/lib/ai/policy.ts`. Tests assert the intended route/model relationships there. Pricing-history rows remain separate from current routing so historical AI spend continues to use the model that actually ran.
