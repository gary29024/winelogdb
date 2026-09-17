// Never log arbitrary provider text: errors can echo credentials or prompts.
// Retain a constrained code and classify the message into safe local wording.
const ZAI_RETRYABLE_CODES=new Set(['1302','1303','1305','1312']);
const ZAI_CODE_MESSAGES:Record<string,string>={
  '1302':'Z.AI concurrency limit reported',
  '1303':'Z.AI request frequency limit reported',
  '1305':'Z.AI rate limit triggered',
  '1312':'Z.AI model high traffic reported'
};

export function isRetryableZaiProviderCode(code?:string){return Boolean(code&&ZAI_RETRYABLE_CODES.has(code))}

export async function gatewayErrorDetails(response:Response){
  const details:{httpStatus:number;providerCode?:string;providerMessage?:string;retryAfter?:string}={httpStatus:response.status};
  const retry=response.headers.get('Retry-After')?.trim();
  if(retry&&(/^\d{1,8}$/.test(retry)||/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(retry)))details.retryAfter=retry;
  try{
    if(!response.body)return details;
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
    try{
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16_384){await reader.cancel();return details}chunks.push(value)}
    }finally{reader.releaseLock()}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
    const body=JSON.parse(new TextDecoder().decode(bytes));
    const error=body?.error??body?.errors?.[0]??body;
    const code=String(error?.code??'');
    // Numeric provider codes and known symbolic codes only; arbitrary strings
    // (including a key accidentally returned as a code) must not reach logs.
    if(/^\d{1,8}$/.test(code)||/^(rate_limit_exceeded|insufficient_quota|invalid_api_key|authentication_error|permission_denied)$/.test(code))details.providerCode=code;
    const message=typeof error?.message==='string'?error.message.toLowerCase():'';
    if(details.providerCode&&ZAI_CODE_MESSAGES[details.providerCode])details.providerMessage=ZAI_CODE_MESSAGES[details.providerCode];
    else if(/specified key does not exist|provider key.*(?:does not exist|not found)|byok.*key.*(?:does not exist|not found|missing)/.test(message))details.providerMessage='AI Gateway provider key not found';
    else if(/concurren/.test(message))details.providerMessage='Concurrency limit reported';
    else if(/balance|credit|insufficient_quota|quota|spend limit/.test(message))details.providerMessage='Quota, balance, or spend limit reported';
    else if(/rate.?limit|too many requests|频率|限流/.test(message))details.providerMessage='Rate limit reported';
    else if(/api.?key|authenticat|unauthorized/.test(message))details.providerMessage='Authentication problem reported';
    else if(message)details.providerMessage='Unrecognized provider message withheld';
  }catch{/* Malformed, non-JSON, or interrupted bodies must not hide the status. */}
  return details;
}