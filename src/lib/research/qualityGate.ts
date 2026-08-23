export type ResearchScopeQualityName='producer'|'terroir'|'vintage_context'|'wine_vintage';
export type DeepResearchField='summary'|'vintageQuality'|'producerDetails'|'producerWinemakingPractices'|'winemakingTechniques'|'terroir'|'drinkingWindow';
export type ResearchFieldStatus='verified'|'not_found'|'conflicting'|'not_applicable';
export type ResearchSourceTier='authoritative'|'specialist'|'grounded'|'none';
export type ResearchSourceLike={title:string;url:string};
export type ResearchSubjectLike=Record<string,string|number|null>;
export type ResearchFieldQuality={status:ResearchFieldStatus;sourceTier:ResearchSourceTier;score:number;warnings:string[]};
export type DeepResearchQuality={status:'verified'|'mixed'|'limited';score:number;sourceTier:ResearchSourceTier;warnings:string[];fields:Partial<Record<DeepResearchField,ResearchFieldQuality>>};

const SCOPE_FIELDS:Record<ResearchScopeQualityName,DeepResearchField[]>={
  producer:['producerDetails','producerWinemakingPractices'],
  terroir:['terroir'],
  vintage_context:['vintageQuality'],
  wine_vintage:['summary','winemakingTechniques','drinkingWindow']
};
const AUTHORITATIVE_HOSTS=['inao.gouv.fr','bourgogne-wines.com','vins-bourgogne.fr','champagne.fr','napavintners.com'];
const SPECIALIST_HOSTS=['jancisrobinson.com','decanter.com','vinous.com','larvf.com','guildsomm.com','wine-searcher.com','wineanorak.com'];
const TIER_RANK:Record<ResearchSourceTier,number>={none:0,grounded:1,specialist:2,authoritative:3};
const VERIFIED_SCORE:Record<ResearchSourceTier,number>={none:0,grounded:82,specialist:90,authoritative:96};

const host=(value:string)=>{try{return new URL(value).hostname.toLowerCase().replace(/^www\./,'')}catch{return ''}};
const matchesHost=(candidate:string,known:string)=>candidate===known||candidate.endsWith(`.${known}`);
function sourceTier(source:ResearchSourceLike):ResearchSourceTier{
  const h=host(source.url);if(!h)return 'none';
  if(h.endsWith('.gov')||h.endsWith('.gov.uk')||h.endsWith('.gouv.fr')||h.endsWith('.edu')||AUTHORITATIVE_HOSTS.some(item=>matchesHost(h,item)))return 'authoritative';
  if(SPECIALIST_HOSTS.some(item=>matchesHost(h,item)))return 'specialist';
  return /^https:/.test(source.url)?'grounded':'none';
}
export function bestResearchSourceTier(sources:ResearchSourceLike[]):ResearchSourceTier{
  let best:ResearchSourceTier='none';for(const source of sources){const tier=sourceTier(source);if(TIER_RANK[tier]>TIER_RANK[best])best=tier}return best;
}

function firstText(value:string){return value.trim().slice(0,260).toLowerCase()}
export function explicitResearchStatus(value:string):ResearchFieldStatus|null{
  const text=firstText(value);if(!text)return null;
  if(/\bnot applicable\b|\bdoes not apply\b/.test(text))return 'not_applicable';
  if(/\bconflicting\b|\bsources? (?:disagree|conflict)\b|\bcannot reconcile\b|\binconsistent sources?\b/.test(text))return 'conflicting';
  if(/\bcould not (?:be )?verified\b|\bunable to verify\b|\bcannot be confirmed\b|\bnot publicly (?:available|documented)\b|\bno reliable (?:public )?(?:source|evidence|information)\b|\bnot found in reliable\b|\bunverified\b/.test(text))return 'not_found';
  return null;
}

function yearsIn(value:string){return [...value.matchAll(/\b(19\d{2}|20\d{2}|21\d{2}|2200)\b/g)].map(match=>Number(match[1]));}
function vintageMismatch(field:DeepResearchField,value:string,subject:ResearchSubjectLike){
  if(field!=='vintageQuality'&&field!=='winemakingTechniques')return false;
  const vintage=typeof subject.vintage==='number'?subject.vintage:null;if(vintage==null)return false;
  const years=yearsIn(value);return years.length>0&&!years.includes(vintage);
}
function generalPracticeLeak(field:DeepResearchField,value:string,subject:ResearchSubjectLike){
  if(field!=='winemakingTechniques'||typeof subject.vintage!=='number')return false;
  const text=value.toLowerCase();
  const general=/\b(generally|typically|usually|producer-wide|domaine-wide|house style|as a rule)\b/.test(text);
  const exact=new RegExp(`\\b${subject.vintage}\\b|\\bthis vintage\\b|\\bfor this vintage\\b|\\bexact (?:wine|vintage)\\b`,'i').test(value);
  return general&&!exact;
}
function producerVintageLeak(field:DeepResearchField,value:string){
  if(field!=='producerWinemakingPractices')return false;
  const years=yearsIn(value);if(!years.length)return false;
  return !/\b(var(?:y|ies|ied)|example|for example|e\.g\.|not a producer-wide rule|vintage-specific)\b/i.test(value);
}

export function assessResearchField(field:DeepResearchField,value:string,subject:ResearchSubjectLike,sources:ResearchSourceLike[]):ResearchFieldQuality&{pass:boolean}{
  const text=value.trim(),tier=bestResearchSourceTier(sources),warnings:string[]=[];
  if(!text)return {status:'verified',sourceTier:tier,score:0,warnings:['missing-field'],pass:false};
  const explicit=explicitResearchStatus(text);
  if(explicit){
    const base=explicit==='not_applicable'?92:explicit==='not_found'?78:68;
    return {status:explicit,sourceTier:tier,score:Math.min(100,base+(tier==='authoritative'?4:tier==='specialist'?2:0)),warnings,pass:true};
  }
  if(tier==='none')warnings.push('no-grounding-source');
  if(vintageMismatch(field,text,subject))warnings.push('wrong-vintage-reference');
  if(generalPracticeLeak(field,text,subject))warnings.push('general-practice-presented-as-exact-vintage');
  if(producerVintageLeak(field,text))warnings.push('vintage-specific-detail-in-producer-scope');
  const hardFailure=warnings.includes('no-grounding-source')||warnings.includes('wrong-vintage-reference')||warnings.includes('general-practice-presented-as-exact-vintage');
  let score=VERIFIED_SCORE[tier];if(warnings.includes('vintage-specific-detail-in-producer-scope'))score=Math.max(0,score-12);if(hardFailure)score=Math.max(0,score-35);
  return {status:'verified',sourceTier:tier,score,warnings,pass:!hardFailure};
}

export function assessResearchScope(scope:ResearchScopeQualityName,payload:Record<string,string>,subject:ResearchSubjectLike,sources:ResearchSourceLike[]){
  const fields=SCOPE_FIELDS[scope].map(field=>[field,assessResearchField(field,payload[field]??'',subject,sources)] as const);
  const warnings=[...new Set(fields.flatMap(([,quality])=>quality.warnings))];
  return {pass:fields.every(([,quality])=>quality.pass),fields:Object.fromEntries(fields) as Partial<Record<DeepResearchField,ResearchFieldQuality>>,warnings};
}

export function buildDeepResearchQuality(entries:Array<{scope:ResearchScopeQualityName;payload:Record<string,string>;subject:ResearchSubjectLike;sources:ResearchSourceLike[]}>):DeepResearchQuality{
  const fields:Partial<Record<DeepResearchField,ResearchFieldQuality>>={},warnings:string[]=[];let tier:ResearchSourceTier='none';
  for(const entry of entries){
    const assessed=assessResearchScope(entry.scope,entry.payload,entry.subject,entry.sources);Object.assign(fields,assessed.fields);warnings.push(...assessed.warnings);
    const entryTier=bestResearchSourceTier(entry.sources);if(TIER_RANK[entryTier]>TIER_RANK[tier])tier=entryTier;
  }
  const values=Object.values(fields),score=values.length?Math.round(values.reduce((sum,item)=>sum+item.score,0)/values.length):0;
  const uniqueWarnings=[...new Set(warnings)];
  const status:DeepResearchQuality['status']=score>=85&&!uniqueWarnings.length?'verified':score>=65?'mixed':'limited';
  return {status,score,sourceTier:tier,warnings:uniqueWarnings.slice(0,20),fields};
}
