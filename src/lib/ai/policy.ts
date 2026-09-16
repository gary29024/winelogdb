export const AI_MODELS={
  recognitionPrimary:'gemini-3.1-flash-lite',
  recognitionEscalationPrimary:'gemini-3.8-flash',
  recognitionEscalationFallback:'gemini-3.7-flash',
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

export const AI_DYNAMIC_ROUTES={
  recognitionEscalation:'dynamic/winelog-recognition-escalation',
  producerRangeExtraction:'dynamic/winelog-producer-range-extraction'
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
  dynamicRoute?:string;
  dynamicReady:boolean;
  note:string;
};

/**
 * Canonical inventory of every production AI use case.
 *
 * `dynamicReady` means the workload can eventually move behind Cloudflare
 * Dynamic Routing without losing a capability WineLog currently relies on.
 * It does not mean traffic is already sent to /compat/chat/completions. Dynamic
 * routes must be deployed in AI Gateway before a caller is switched over.
 *
 * Grounding, Flex and Batch stay provider-native because those capabilities use
 * Vertex/Gemini-specific request semantics. WineLog continues to own the
 * domain-quality gate even when infrastructure routing later moves to Cloudflare.
 */
export const AI_ROUTES={
  recognitionInteractive:{
    transport:'gemini-native-sync',
    models:[AI_MODELS.recognitionPrimary],
    dynamicReady:false,
    note:'Single/group/sheet/framing recognition. Keep Gemini 3.1 Flash Lite and native multimodal structured output.'
  },
  recognitionEscalation:{
    transport:'gemini-native-sync',
    models:[AI_MODELS.recognitionEscalationPrimary,AI_MODELS.recognitionEscalationFallback],
    dynamicRoute:AI_DYNAMIC_ROUTES.recognitionEscalation,
    dynamicReady:true,
    note:'Availability fallback target for uncertain recognition; WineLog still decides whether an escalated answer is better.'
  },
  recognitionBatch:{
    transport:'gemini-native-flex-batch',
    models:[AI_MODELS.recognitionPrimary,AI_MODELS.recognitionEscalationPrimary],
    dynamicReady:false,
    note:'Vertex Flex when AI Gateway is configured, Developer API Batch otherwise. Keep provider-native semantics.'
  },
  champagneExtraction:{
    transport:'gemini-native-flex-batch',
    models:[AI_MODELS.recognitionPrimary],
    dynamicReady:false,
    note:'Saved-photo Champagne detail extraction intentionally remains on Gemini 3.1 Flash Lite and Flex/Batch.'
  },
  wineDeepSearch:{
    transport:'gemini-native-grounded',
    models:[AI_MODELS.groundedResearchPrimary,AI_MODELS.groundedResearchFallback],
    dynamicReady:false,
    note:'Google Search grounding plus durable Flex/Batch research and WineLog grounding/quality validation.'
  },
  producerResearch:{
    transport:'gemini-native-grounded',
    models:[AI_MODELS.groundedResearchPrimary,AI_MODELS.groundedResearchFallback],
    dynamicReady:false,
    note:'Producer profile/catalogue grounded research, including split recovery and durable background execution.'
  },
  vintageIntelligence:{
    transport:'gemini-native-grounded',
    models:[AI_MODELS.vintagePrimary,AI_MODELS.vintageEscalation],
    dynamicReady:false,
    note:'Grounded vintage window/intelligence. Keep the cheaper Gemini 3.1 Flash Lite first pass.'
  },
  producerRangeDirect:{
    transport:'hybrid',
    models:[AI_MODELS.producerRangeZai,AI_MODELS.producerRangeWorkers,AI_MODELS.groundedResearchPrimary,AI_MODELS.groundedResearchFallback],
    dynamicRoute:AI_DYNAMIC_ROUTES.producerRangeExtraction,
    dynamicReady:true,
    note:'Official-site evidence extraction can route Z.AI to Workers AI; WineLog must retain completeness/coverage gates and grounded research fallback.'
  },
  semanticEmbeddings:{
    transport:'workers-ai',
    models:[AI_MODELS.semanticWorkers,AI_MODELS.semanticGemini],
    dynamicReady:false,
    note:'Journal query/index embeddings. Workers AI is default; Gemini embeddings remain an explicit optional provider.'
  }
} as const satisfies Record<string,AiRoutePolicy>;

export type AiRouteName=keyof typeof AI_ROUTES;
