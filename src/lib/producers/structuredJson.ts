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

export function hasLikelyEmbeddedJsonFragment(value:string){
  const text=value.trim();if(!text)return false;
  if(/}\s*,\s*{/.test(text)||/]\s*,\s*\[/.test(text))return true;
  const lower=text.toLowerCase();
  const key='(?:name|category|appellation|classification|style|notes|range)';
  if(new RegExp(`\\b${key}\\b\\s*[:=]\\s*(?:null|true|false|["'\\[{])`,'i').test(lower))return true;
  if(new RegExp(`\\b${key}\\b\\s+(?:null|true|false)\\b`,'i').test(lower))return true;
  return false;
}

function assertNoEmbeddedJsonFragments(value:unknown,path='root'){
  if(typeof value==='string'){
    if(hasLikelyEmbeddedJsonFragment(value))throw new Error(`Structured JSON contains an embedded record fragment at ${path}`);
    return;
  }
  if(Array.isArray(value)){for(let i=0;i<value.length;i++)assertNoEmbeddedJsonFragments(value[i],`${path}[${i}]`);return}
  if(value&&typeof value==='object')for(const [key,item] of Object.entries(value as Record<string,unknown>))assertNoEmbeddedJsonFragments(item,`${path}.${key}`);
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
    try{const parsed=JSON.parse(candidate);assertNoEmbeddedJsonFragments(parsed);return parsed}catch(e){if((e as Error).message.startsWith('Structured JSON contains'))throw e}
  }
  throw new Error('Invalid structured JSON');
}
