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
