import { stripProducerCatalogPrefix } from './catalogName';

export type CatalogLike={name:string;category?:string|null;appellation?:string|null;classification?:string|null;style?:string|null;notes?:string|null};

const normalize=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const styleFamily=(value:unknown)=>{
  const text=normalize(value),words=new Set(text.split(/\s+/).filter(Boolean));
  if(words.has('sparkling')||words.has('champagne')||words.has('petillant')||words.has('mousseux'))return 'sparkling';
  if(words.has('white')||words.has('blanc'))return 'white';
  if(words.has('rose'))return 'rose';
  if(words.has('red')||words.has('rouge'))return 'red';
  if(words.has('orange'))return 'orange';
  if(words.has('fortified')||words.has('port')||words.has('sherry')||words.has('madeira'))return 'fortified';
  return text;
};

export function catalogIdentityKey(wine:CatalogLike,producerNames:string[]=[]){
  const name=normalize(stripProducerCatalogPrefix(wine.name,producerNames));if(!name)return '';
  const appellation=normalize(wine.appellation),style=styleFamily(wine.category??wine.style);
  return `${name}::${appellation}::${style}`;
}

export function mergeCatalogRanges<T extends CatalogLike>(previous:T[],researched:T[],limit=150,producerNames:string[]=[]){
  const output:T[]=[],seen=new Set<string>(),researchedKeys=new Set<string>();
  for(const item of researched){
    const key=catalogIdentityKey(item,producerNames);if(!key||seen.has(key))continue;
    seen.add(key);researchedKeys.add(key);output.push(item);if(output.length>=limit)return {range:output,researchedCount:researchedKeys.size,retainedCount:0};
  }
  let retainedCount=0;
  for(const item of previous){
    const key=catalogIdentityKey(item,producerNames);if(!key||seen.has(key))continue;
    seen.add(key);output.push(item);retainedCount++;if(output.length>=limit)break;
  }
  return {range:output,researchedCount:researchedKeys.size,retainedCount};
}

export function catalogTextQualityIssue(value:unknown,field:string,maxLength:number){
  if(value==null)return null;
  if(typeof value!=='string')return `${field} is not text`;
  const text=value.trim();if(!text)return null;
  if(text.length>maxLength)return `${field} is unexpectedly long`;
  if(/([A-Za-z0-9])\1{7,}/i.test(text))return `${field} contains a repeated-character run`;
  if(/\S{72,}/.test(text))return `${field} contains an implausibly long token`;
  const compact=text.replace(/\s+/g,'');
  if(compact.length>=48){const counts=new Map<string,number>();for(const char of compact.toLowerCase())counts.set(char,(counts.get(char)??0)+1);const dominant=Math.max(0,...counts.values());if(dominant/compact.length>.58)return `${field} has abnormally low character diversity`}
  return null;
}

export function assertCatalogTextQuality(value:unknown,field:string,maxLength:number){
  const issue=catalogTextQualityIssue(value,field,maxLength);if(issue)throw new Error(`Catalogue quality check failed: ${issue}`);
}

export function suspiciousCatalogShrink(previousCount:number,nextCount:number){
  if(previousCount<8)return false;
  return nextCount<Math.max(4,Math.ceil(previousCount*.5));
}

const decodeHref=(value:string)=>value.replace(/&amp;/gi,'&').replace(/&#38;/g,'&').trim();
const hrefs=(html:string)=>[...(html.match(/<a\b[^>]*\bhref\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)[^>]*>/gi)??[])].map(tag=>tag.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)?.slice(1).find(Boolean)).filter((x):x is string=>Boolean(x)).map(decodeHref);
function visibleText(html:string){
  return html.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;|&#38;/gi,'&').replace(/&#64;/gi,'@').replace(/\s+/g,' ').trim();
}

export type OfficialContactCandidates={emails:string[];phones:string[];instagramUrls:string[];contactLinks:string[]};
export function extractOfficialContactCandidates(html:string,baseUrl:string):OfficialContactCandidates{
  let base:URL;try{base=new URL(baseUrl)}catch{return {emails:[],phones:[],instagramUrls:[],contactLinks:[]}};
  const emails:string[]=[],phones:string[]=[],instagramUrls:string[]=[],contactLinks:string[]=[];
  const add=(list:string[],value:string)=>{const clean=value.trim();if(clean&&!list.includes(clean))list.push(clean)};
  for(const href of hrefs(html)){
    if(/^mailto:/i.test(href)){const value=decodeURIComponent(href.replace(/^mailto:/i,'').split('?')[0]||'').trim();if(value)add(emails,value);continue}
    if(/^tel:/i.test(href)){const value=decodeURIComponent(href.replace(/^tel:/i,'').split('?')[0]||'').trim();if(value)add(phones,value);continue}
    let url:URL;try{url=new URL(href,base)}catch{continue}
    const host=url.hostname.toLowerCase().replace(/^www\./,'');
    if(host==='instagram.com'&&url.pathname&&url.pathname!=='/'){url.search='';url.hash='';add(instagramUrls,url.toString());continue}
    const baseHost=base.hostname.toLowerCase().replace(/^www\./,'');
    if(url.protocol!=='https:'||host!==baseHost)continue;
    if(/(?:^|[-_/])(contact|contactez|contacto|kontakt|impressum|legal|mentions|about|team|equipe|visit|visite)(?:[-_/]|$)/i.test(url.pathname)){
      url.hash='';add(contactLinks,url.toString());
    }
  }
  const text=visibleText(html);
  for(const match of text.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi))add(emails,match[0]);
  for(const match of text.matchAll(/(?:\b(?:tel(?:ephone)?|tél(?:éphone)?|phone)\.?\s*[:：]?\s*)(\+?\d[\d\s().\/-]{6,}\d)/gi))add(phones,match[1]);
  for(const match of text.matchAll(/(?:^|\s)(\+\d[\d\s().\/-]{6,}\d)(?=\s|$)/g))add(phones,match[1]);
  return {emails:emails.slice(0,10),phones:phones.slice(0,10),instagramUrls:instagramUrls.slice(0,10),contactLinks:contactLinks.slice(0,5)};
}
