export function shouldRetryRecognitionStatus(status:number){
  return status===429||status>=500;
}

export function shouldRetryRecognitionFailure(input:{status?:number|null;timedOut:boolean;networkError:boolean}){
  if(input.timedOut)return false;
  if(typeof input.status==='number')return shouldRetryRecognitionStatus(input.status);
  return input.networkError;
}
