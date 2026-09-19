export const AI_MODELS={
  recognitionPrimary:'gemini-3.1-flash-lite',
  recognitionEscalationSync:'gemini-3.8-flash',
  recognitionEscalationFlex:'gemini-3.8-flash',
  groundedResearchPrimary:'gemini-3.8-flash',
  groundedResearchFallback:'gemini-3.7-flash',
  vintagePrimary:'gemini-3.1-flash-lite',
  vintageEscalation:'gemini-3.8-flash',
  semanticWorkers:'@cf/qwen/qwen3-embedding-0.6b',
  semanticGemini:'gemini-embedding-001',
  producerRangeZai:'glm-4.7-flash',
  producerRangeZaiMeter:'zai/glm-4.7-flash',
  producerRangeWorkers:'@cf/qwen/qwen3-30b-a3b-fp8'
} as const;

export type AiRouteTransport=
  |'gemini-native-sync'
  |'gemini-native-flex-batch'
  |'gemini-native-grounded'
  |'ai-gateway-custom-provider'
  |'workers-ai'
  |'gemini-embeddings'
  |'hybrid';

export type AiRoutePolicy={
  transport:AiRouteTransport;
  models:readonly string[];
  note:string;
};

/**
 * Canonical inventory of the production AI use cases that actually run today.
 *
 * This is intentionally not a transport abstraction or future-routing plan.
 * Capability-specific behavior stays with its native implementation: Gemini
 * multimodal structured output, Google Search grounding, Vertex Flex/Batch,
 * Workers AI and custom AI Gateway providers each keep their existing request
 * semantics. WineLog owns domain-quality gates and application fallbacks.
 */
export const AI_ROUTES={
  recognitionInteractive:{
    transport:'gemini-native-sync',
    models:[AI_MODELS.recognitionPrimary],
    note:'Single/group/sheet/framing recognition. Gemini 3.1 Flash Lite with native multimodal structured output.'
  },
  recognitionEscalationSync:{
    transport:'gemini-native-sync',
    models:[AI_MODELS.recognitionEscalationSync],
    note:'Synchronous uncertain-recognition escalation. There is no separate availability model fallback on this path today.'
  },
  recognitionBatch:{
    transport:'gemini-native-flex-batch',
    models:[AI_MODELS.recognitionPrimary,AI_MODELS.recognitionEscalationFlex],
    note:'Vertex Flex when AI Gateway is configured, Developer API Batch otherwise; Flex escalation has its own policy key.'
  },
  lwinBackfill:{
    transport:'gemini-native-flex-batch',
    models:[AI_MODELS.recognitionPrimary],
    note:'Owner-triggered one-off unresolved LWIN repair. Local candidates first; Gemini 3.1 Flash Lite ranks only supplied candidates over AI Gateway Vertex Flex.'
  },
  champagneExtraction:{
    transport:'gemini-native-flex-batch',
    models:[AI_MODELS.recognitionPrimary],
    note:'Saved-photo Champagne detail extraction intentionally remains on Gemini 3.1 Flash Lite and Flex/Batch.'
  },
  wineDeepSearch:{
    transport:'gemini-native-grounded',
    models:[AI_MODELS.groundedResearchPrimary,AI_MODELS.groundedResearchFallback],
    note:'Google Search grounding plus durable research execution and WineLog grounding/quality validation.'
  },
  producerResearch:{
    transport:'gemini-native-grounded',
    models:[AI_MODELS.groundedResearchPrimary,AI_MODELS.groundedResearchFallback],
    note:'Producer profile/catalogue grounded research, including recovery and durable background execution.'
  },
  vintageIntelligence:{
    transport:'gemini-native-grounded',
    models:[AI_MODELS.vintagePrimary,AI_MODELS.vintageEscalation],
    note:'Grounded vintage window/intelligence. Keep the cheaper Gemini 3.1 Flash Lite first pass.'
  },
  producerRangeDirect:{
    transport:'hybrid',
    models:[AI_MODELS.producerRangeZai,AI_MODELS.producerRangeWorkers,AI_MODELS.groundedResearchPrimary,AI_MODELS.groundedResearchFallback],
    note:'Official-site extraction tries Z.AI, then Workers AI, then the existing grounded Gemini pipeline; WineLog enforces completeness/coverage.'
  },
  semanticEmbeddings:{
    transport:'hybrid',
    models:[AI_MODELS.semanticWorkers,AI_MODELS.semanticGemini],
    note:'Journal query/index embeddings. Workers AI is default; Gemini embeddings remain an explicit optional provider.'
  }
} as const satisfies Record<string,AiRoutePolicy>;

export type AiRouteName=keyof typeof AI_ROUTES;
