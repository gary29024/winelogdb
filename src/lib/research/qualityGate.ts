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
// Appellation bodies, consorzi, regulatory councils and national trade bodies.
// The list is deliberately multi-region: when it only named French and Napa
// hosts, a wine researched from excellent Italian, German or Australian sources
// could never be scored above 'grounded'.
const AUTHORITATIVE_HOSTS=[
  // France
  'inao.gouv.fr','bourgogne-wines.com','vins-bourgogne.fr','champagne.fr','bordeaux.com','vinsdealsace.com',
  'vins-rhone.com','loirevalleywine.com','vinsdeprovence.com','languedoc-wines.com','jura-vins.com',
  // Italy
  'consorziobrunello.it','chianticlassico.com','langhevini.it','consorziobarolobarbaresco.it','federdoc.com',
  // Spain, Portugal
  'riojawine.com','doriberadelduero.es','sherry.wine','ivdp.pt','winesofportugal.com','vinhoverde.pt',
  // Germany, Austria, Hungary
  'deutscheweine.de','vdp.de','austrianwine.com','oesterreichwein.at','tokaj.hu',
  // New World
  'napavintners.com','sonomawinegrape.org','wineinstitute.org','oregonwine.org','washingtonwine.org',
  'wineaustralia.com','nzwine.com','wosa.co.za','winesofchile.org','winesofargentina.org'
];
// Wine-specific editorial and reference publications with named critics.
const SPECIALIST_HOSTS=[
  'jancisrobinson.com','decanter.com','vinous.com','larvf.com','guildsomm.com','wine-searcher.com','wineanorak.com',
  'robertparker.com','winespectator.com','jamessuckling.com','falstaff.com','gamberorosso.it','vinum.eu',
  'trinkmag.com','meiningers-international.com','bourgogne-report.com','winemag.com','tim-atkin.com',
  'thewinecellarinsider.com','winebusiness.com','wineenthusiast.com','klwines.com'
];
// Official/academic domains outside the .gov and .gouv.fr patterns already matched.
const OFFICIAL_TLD=/\.(?:gov|gov\.[a-z]{2}|gouv\.[a-z]{2}|govt\.nz|gob\.[a-z]{2}|gv\.at|edu|edu\.[a-z]{2}|ac\.[a-z]{2})$/;
const TIER_RANK:Record<ResearchSourceTier,number>={none:0,grounded:1,specialist:2,authoritative:3};
const VERIFIED_SCORE:Record<ResearchSourceTier,number>={none:0,grounded:82,specialist:90,authoritative:96};
// Independent corroboration lifts confidence. Without it a 'grounded' field sat
// permanently below the 85 needed for 'verified', so any wine outside the host
// lists was capped at 'mixed' however well sourced it was.
const CORROBORATION_BONUS=[0,0,3,6] as const;
export function distinctSourceHosts(sources:ResearchSourceLike[]){
  return new Set(sources.map(source=>host(source.url)).filter(Boolean)).size;
}

const host=(value:string)=>{try{return new URL(value).hostname.toLowerCase().replace(/^www\./,'')}catch{return ''}};
const matchesHost=(candidate:string,known:string)=>candidate===known||candidate.endsWith(`.${known}`);
function sourceTier(source:ResearchSourceLike):ResearchSourceTier{
  const h=host(source.url);if(!h)return 'none';
  if(OFFICIAL_TLD.test(h)||AUTHORITATIVE_HOSTS.some(item=>matchesHost(h,item)))return 'authoritative';
  if(SPECIALIST_HOSTS.some(item=>matchesHost(h,item)))return 'specialist';
  return /^https:/i.test(source.url)?'grounded':'none';
}
export function bestResearchSourceTier(sources:ResearchSourceLike[]):ResearchSourceTier{
  let best:ResearchSourceTier='none';for(const source of sources){const tier=sourceTier(source);if(TIER_RANK[tier]>TIER_RANK[best])best=tier}return best;
}

function firstText(value:string){return value.trim().slice(0,260).toLowerCase()}
export function explicitResearchStatus(value:string):ResearchFieldStatus|null{
  const text=firstText(value);if(!text)return null;
  if(/\bnot applicable\b|\bdoes not apply\b/.test(text))return 'not_applicable';
  if(/\bconflicting\b|\bsources? (?:disagree|conflict)\b|\bcannot reconcile\b|\binconsistent sources?\b/.test(text))return 'conflicting';
  if(/\bcould not (?:be )?verified\b|\bcannot be verified\b|\bunable to verify\b|\bcannot be confirmed\b|\bnot publicly (?:available|documented)\b|\bno reliable (?:public )?(?:source|evidence|information)\b|\bnot found in reliable\b|\bunverified\b/.test(text))return 'not_found';
  return null;
}

const YEAR_PATTERN=/\b(19\d{2}|20\d{2}|21\d{2}|2200)\b/g;
function yearsIn(value:string){return [...value.matchAll(YEAR_PATTERN)].map(match=>Number(match[1]));}

// A year that is cited as history or comparison is not a claim about which
// vintage this is. "The domaine converted to biodynamics in 2008" and "the
// warmest season since 2003" are both correct in a 2016 field, so only a year
// presented as the wine's own vintage may fail the gate.
// Anywhere in the run-up to the year: the clause is about history or comparison.
const CONTEXT_MARKER=/\b(?:since|before|after|until|between|than|compared\s+(?:to|with)|versus|vs|unlike|founded|established|acquired|bought|purchased|inherited|converted|certified|replanted|planted|built|created|took\s+over|back\s+in|as\s+in|such\s+as|e\.g|for\s+example|earlier|previous(?:ly)?)\b/i;
// Immediately before: the year continues a range, as in "2015 and 2017".
const RANGE_CONTINUATION=/(?:and|or|to|[-–—/,])\s*$/i;
export function nonContextualYears(value:string){
  const years:number[]=[];
  for(const match of value.matchAll(YEAR_PATTERN)){
    const before=value.slice(Math.max(0,match.index-60),match.index);
    if(CONTEXT_MARKER.test(before)||RANGE_CONTINUATION.test(before))continue;
    years.push(Number(match[1]));
  }
  return years;
}
function vintageMismatch(field:DeepResearchField,value:string,subject:ResearchSubjectLike){
  if(field!=='vintageQuality'&&field!=='winemakingTechniques')return false;
  const vintage=typeof subject.vintage==='number'?subject.vintage:null;if(vintage==null)return false;
  if(yearsIn(value).includes(vintage))return false;
  const asserted=nonContextualYears(value);
  return asserted.length>0;
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
  const corroboration=CORROBORATION_BONUS[Math.min(distinctSourceHosts(sources),CORROBORATION_BONUS.length-1)];
  let score=Math.min(100,VERIFIED_SCORE[tier]+(tier==='none'?0:corroboration));
  if(warnings.includes('vintage-specific-detail-in-producer-scope'))score=Math.max(0,score-12);if(hardFailure)score=Math.max(0,score-35);
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
