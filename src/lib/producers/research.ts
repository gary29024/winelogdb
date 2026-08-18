import { mapProducerRow } from './entities';

type Env={DB:D1Database;GEMINI_API_KEY:string};
type ProducerResearch={homeCountry:string;homeRegion:string;homeLocality:string;profile:string;range:Array<{name:string;appellation?:string|null;classification?:string|null;style?:string|null;notes?:string|null}>};
type GeminiResponse={candidates?:Array<{content?:{parts?:Array<{text?:string}>};groundingMetadata?:{groundingChunks?:Array<{web?:{title?:string;uri?:string}}>} }>};
const MODEL='gemini-3.7-flash';

export async function runProducerResearch(env:Env,owner:string,id:string,confirmation?:string){
  if(confirmation!=='RUN_PRODUCER_RESEARCH')return {status:400 as const,body:{error:'Producer research requires explicit confirmation'}};
  const row=await env.DB.prepare('SELECT * FROM producers WHERE owner_id=? AND id=?').bind(owner,id).first<Record<string,unknown>>();
  if(!row)return {status:404 as const,body:{error:'Producer not found'}};
  const name=String(row.canonical_name);
  const prompt=`Research the wine producer ${JSON.stringify(name)} using reliable public web sources, prioritizing the producer's official website and reputable importer/distributor pages.

Return the producer's PHYSICAL HOME/BASE location, not the regions or appellations where its wines are produced. For example, homeRegion means where the domaine/estate/company is based.

Also identify the producer's current or most recently documented wine range as completely as reliable public sources allow. Do not invent cuvees. If a wine is seasonal, discontinued, uncertain, negociant-only, or not clearly current, explain that briefly in notes. Preserve official spellings and appellation names.

Return JSON only with:
- homeCountry: country where the producer is based
- homeRegion: administrative/wine region where the producer is based
- homeLocality: village/town/city where the producer is based
- profile: concise but substantive producer overview
- range: array of objects with name, appellation, classification, style, notes

Use empty strings or nulls when a field cannot be verified. The range may be empty if reliable sources do not support a catalog.`;
  const requestBody=JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],tools:[{google_search:{}}],generationConfig:{responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{homeCountry:{type:'STRING'},homeRegion:{type:'STRING'},homeLocality:{type:'STRING'},profile:{type:'STRING'},range:{type:'ARRAY',items:{type:'OBJECT',properties:{name:{type:'STRING'},appellation:{type:'STRING',nullable:true},classification:{type:'STRING',nullable:true},style:{type:'STRING',nullable:true},notes:{type:'STRING',nullable:true}},required:['name']}}},required:['homeCountry','homeRegion','homeLocality','profile','range']}}});
  let lastError='Producer research failed';
  for(let attempt=0;attempt<2;attempt++){
    try{
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:requestBody});
      if(!response.ok){lastError=`Producer research failed (${response.status})`;if(attempt===0&&(response.status===429||response.status>=500)){await new Promise(r=>setTimeout(r,900));continue}throw new Error(lastError)}
      const gemini=await response.json() as GeminiResponse,candidate=gemini.candidates?.[0],text=candidate?.content?.parts?.map(x=>x.text??'').join('')??'';
      const parsed=JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g,'')) as ProducerResearch;
      if(!parsed||typeof parsed.profile!=='string'||!Array.isArray(parsed.range))throw new Error('Producer research returned an invalid structured response');
      const range=parsed.range.filter(x=>x&&typeof x.name==='string'&&x.name.trim()).slice(0,120);
      const seen=new Set<string>(),sources=(candidate?.groundingMetadata?.groundingChunks??[]).flatMap(x=>x.web?.uri?[{title:x.web.title??x.web.uri,url:x.web.uri}]:[]).filter(x=>{if(seen.has(x.url))return false;seen.add(x.url);return true}).slice(0,20);
      const now=new Date().toISOString();
      await env.DB.prepare('UPDATE producers SET home_country=?,home_region=?,home_locality=?,profile=?,catalog_json=?,sources_json=?,research_model=?,researched_at=?,updated_at=? WHERE owner_id=? AND id=?').bind(parsed.homeCountry?.trim()||null,parsed.homeRegion?.trim()||null,parsed.homeLocality?.trim()||null,parsed.profile.trim(),JSON.stringify(range),JSON.stringify(sources),MODEL,now,now,owner,id).run();
      const updated=await env.DB.prepare('SELECT * FROM producers WHERE owner_id=? AND id=?').bind(owner,id).first<Record<string,unknown>>();
      return {status:200 as const,body:mapProducerRow(updated!)};
    }catch(e){lastError=(e as Error).message||lastError;if(attempt===0){await new Promise(r=>setTimeout(r,900));continue}}
  }
  return {status:502 as const,body:{error:lastError}};
}
