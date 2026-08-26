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

const structuredKey='(?:name|category|appellation|classification|style|notes|range)';
function hasStrongEmbeddedJsonFragment(value:string){
  const text=value.trim();if(!text)return false;
  if(/}\s*,\s*{/.test(text)||/]\s*,\s*\[/.test(text))return true;
  if(new RegExp(`["']${structuredKey}["']\\s*:`,'i').test(text))return true;
  if(new RegExp(`\\b${structuredKey}\\b\\s*[:=]\\s*[\\[{]`,'i').test(text))return true;
  return false;
}
function hasWeakCatalogFieldLeakage(value:string){
  const text=value.trim();if(!text)return false;
  if(new RegExp(`\\b${structuredKey}\\b\\s*[:=]\\s*(?:null|true|false|["'])`,'i').test(text))return true;
  if(new RegExp(`\\b${structuredKey}\\b\\s+(?:null|true|false)\\b`,'i').test(text))return true;
  // A field path left dangling on the end of the value: "Still dry white唱.notes".
  // The same swallowed-record glitch as the cases above, but the model stopped
  // before writing the value, so there is no colon or literal to key off - only
  // a key name hanging off a full stop where a sentence cannot continue.
  if(new RegExp(`\\.\\s*${structuredKey}\\s*$`,'i').test(text))return true;
  return false;
}

export function hasLikelyEmbeddedJsonFragment(value:string){return hasStrongEmbeddedJsonFragment(value)||hasWeakCatalogFieldLeakage(value)}

function sanitizeStructuredJson(value:unknown,path='root'):unknown{
  if(typeof value==='string'){
    if(hasStrongEmbeddedJsonFragment(value))throw new Error(`Structured JSON contains an embedded record fragment at ${path}`);
    if(hasWeakCatalogFieldLeakage(value)){
      const match=path.match(/^root\.range\[\d+\]\.(name|appellation|classification|style|notes)$/);
      if(match){
        if(match[1]==='name')throw new Error(`Structured JSON contains an embedded record fragment at ${path}`);
        return null;
      }
      throw new Error(`Structured JSON contains an embedded record fragment at ${path}`);
    }
    return value;
  }
  if(Array.isArray(value))return value.map((item,index)=>sanitizeStructuredJson(item,`${path}[${index}]`));
  if(value&&typeof value==='object'){
    const out:Record<string,unknown>={};
    for(const [key,item] of Object.entries(value as Record<string,unknown>))out[key]=sanitizeStructuredJson(item,`${path}.${key}`);
    return out;
  }
  return value;
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
    try{return sanitizeStructuredJson(JSON.parse(candidate))}catch(e){if((e as Error).message.startsWith('Structured JSON contains'))throw e}
  }
  throw new Error('Invalid structured JSON');
}
