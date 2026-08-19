export function firstBalancedJsonObject(text:string){
  let start=-1,depth=0,inString=false,escaped=false;
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(start<0){if(char==='{'){start=i;depth=1}continue}
    if(inString){
      if(escaped){escaped=false;continue}
      if(char==='\\'){escaped=true;continue}
      if(char==='"')inString=false;
      continue;
    }
    if(char==='"'){inString=true;continue}
    if(char==='{')depth++;
    else if(char==='}'&&--depth===0)return text.slice(start,i+1);
  }
  return null;
}

export function parseStructuredJsonText(text:string):unknown{
  const raw=text.replace(/^\uFEFF/,'').trim();
  const attempts:string[]=[];
  if(raw)attempts.push(raw);
  const fenced=raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if(fenced)attempts.push(fenced);
  const balanced=firstBalancedJsonObject(raw);
  if(balanced)attempts.push(balanced);
  const seen=new Set<string>();
  for(const candidate of attempts){
    if(!candidate||seen.has(candidate))continue;seen.add(candidate);
    try{return JSON.parse(candidate)}catch{}
  }
  throw new Error('Invalid structured JSON');
}
