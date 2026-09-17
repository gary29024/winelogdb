# WineLog AI model and transport policy

WineLog separates **model policy** from **transport implementation**. Current model identifiers live in `src/lib/ai/policy.ts`; feature and worker code should import them instead of hard-coding active model names.

This policy deliberately keeps Gemini 3.1 Flash Lite on the low-cost paths where it is currently used: primary recognition, Champagne extraction, and first-pass Vintage Intelligence.

## Route inventory

| WineLog use case | Current transport | Current model order | Runtime behavior |
| --- | --- | --- | --- |
| Single wine recognition | Native Gemini `generateContent` through AI Gateway / Vertex when configured | `gemini-3.1-flash-lite` | Multimodal structured output. |
| Group / sheet / framing recognition | Native Gemini `generateContent` | `gemini-3.1-flash-lite` | Same low-cost recognition primary. |
| Synchronous recognition escalation | Native Gemini `generateContent` | `gemini-3.8-flash` | Triggered by WineLog confidence/identity rules. No separate 3.7 availability fallback exists on this path today. |
| Batch recognition | Vertex Flex through AI Gateway, or Developer API Batch when Gateway is absent | `gemini-3.1-flash-lite`, Flex escalation `gemini-3.8-flash` | Flex escalation has a separate policy key from synchronous escalation so the transports can diverge safely later. |
| Champagne photo extraction | Vertex Flex through AI Gateway, or Developer API Batch | `gemini-3.1-flash-lite` | Intentionally remains on 3.1 Flash Lite. |
| Wine Deep Search | Native Gemini/Vertex grounded research with durable background execution | `gemini-3.8-flash` -> `gemini-3.7-flash` | 3.7 is a real availability/grounding fallback. Google Search grounding and WineLog quality gates are required. |
| Producer profile + catalogue research | Native Gemini/Vertex grounded research | `gemini-3.8-flash` -> `gemini-3.7-flash` | Same grounded primary/fallback policy as wine research. |
| Vintage Window / Vintage Intelligence | Native grounded Gemini request | `gemini-3.1-flash-lite` -> `gemini-3.8-flash` | Keep cheap first pass; escalate only when the first answer/evidence is unusable. |
| Producer Range direct extraction | AI Gateway custom Z.AI, then Workers AI, then existing grounded Gemini pipeline | `glm-4.7-flash` -> `@cf/qwen/qwen3-30b-a3b-fp8` -> grounded Gemini | WineLog enforces official-source, completeness and coverage gates before accepting a cheap extraction. |
| Journal semantic query/index embeddings | Workers AI by default; optional Gemini Embeddings | `@cf/qwen/qwen3-embedding-0.6b` or `gemini-embedding-001` | Embedding-specific transport, not chat completion. |

`zai/glm-4.7-flash` is the AI-usage **metering/pricing key** for the Z.AI call; the provider model sent upstream is `glm-4.7-flash`.

## Ownership boundary

WineLog keeps the capability-specific transports that already match each workload. AI Gateway remains useful for authentication, BYOK, logging and provider transport, but there is no additional generic Dynamic Routing layer in the application architecture.

WineLog owns domain correctness and application-level fallback decisions: structured-result validation, label evidence rules, recognition result selection, producer-range completeness, grounding validation and Deep Search quality gates.

Google Search grounding, Vertex Flex, Gemini/Developer Batch, Workers AI and custom-provider requests therefore stay on their existing native/provider-specific paths.

## Changing a model safely

A model refresh is a two-part operational change when the model is billable:

1. **Add pricing first.** Add a new `{ "from": "<go-live date>", "input": ..., "output": ... }` window for the new model under `AI_COST_MODEL_RATES` in `wrangler.jsonc`. Never rewrite an existing historical window, because that would re-price past usage.
2. **Then change the active model.** Update the relevant identifier in `AI_MODELS` in `src/lib/ai/policy.ts` and run the policy/wiring tests.

For Z.AI, `producerRangeZai` is the upstream routing value while `producerRangeZaiMeter` is the pricing key. If that provider/model changes, update the pricing row and the meter key together before switching the upstream model.

Historical usage fixtures and persisted historical model strings should not be rewritten merely because the current model changes; they describe what actually ran at the time.
