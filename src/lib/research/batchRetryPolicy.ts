export type ResearchBatchPollAction='retry'|'fallback'|'fail';

export function researchBatchPollDelay(pollCount:number){
  if(pollCount<=0)return 15;
  if(pollCount===1)return 30;
  if(pollCount===2)return 60;
  if(pollCount===3)return 120;
  if(pollCount===4)return 300;
  return 900;
}

export function researchBatchErrorPollDelay(pollCount:number){
  if(pollCount<=0)return 30;
  if(pollCount===1)return 60;
  if(pollCount===2)return 120;
  if(pollCount===3)return 300;
  return 900;
}

/**
 * The primary 3.7 model gets two retryable status failures before failover.
 * The fallback 3.6 model gets a larger bounded budget, then the run fails
 * instead of polling forever.
 */
export function researchBatchTransientAction(attempt:number,pollCount:number):ResearchBatchPollAction{
  if(attempt<=1)return pollCount>=2?'fallback':'retry';
  return pollCount>=4?'fail':'retry';
}

/**
 * Batch is asynchronous, but WineLog should not leave a visibly stalled model
 * running indefinitely. The primary model fails over after the fifth poll
 * (~4 minutes with the normal schedule); the fallback gets one extra poll
 * (~9 minutes) before the run terminates.
 */
export function researchBatchStallAction(attempt:number,pollCount:number):ResearchBatchPollAction{
  if(attempt<=1)return pollCount>=4?'fallback':'retry';
  return pollCount>=5?'fail':'retry';
}
