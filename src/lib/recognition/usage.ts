import { geminiCallTokens,recordAiUsage,type AiUsageEnv,type AiUsageEvent } from '../usage/aiUsage';

/** Capture before parsing: unusable answers and rejected escalations still cost tokens. */
export function recognitionUsage(env:AiUsageEnv,owner:string,event:Pick<AiUsageEvent,'kind'|'runId'|'targetId'|'tier'>){
  const calls:Array<{model:string;promptTokens:number;outputTokens:number;units:number}>=[];
  return {
    capture(model:string,usage:Parameters<typeof geminiCallTokens>[0]){
      const call={model,...geminiCallTokens(usage),units:0};
      calls.push(call);
      return call;
    },
    async flush(){
      for(const call of calls.splice(0))await recordAiUsage(env,owner,{...event,...call,requests:1});
    }
  };
}
export type RecognitionUsage=ReturnType<typeof recognitionUsage>;
