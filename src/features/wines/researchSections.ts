import type { DeepSearchResult } from '../../lib/db/schema';
import { accountStorageKey } from '../../lib/auth/client';

/**
 * Shape and ordering shared by both wine detail pages, so a friend's copy of a
 * Deep Search result is laid out exactly like the owner's rather than growing
 * its own markup. The components that render it live in ResearchPresentation.
 */

export type DeepField='summary'|'expectedProfile'|'vintageQuality'|'producerDetails'|'producerWinemakingPractices'|'winemakingTechniques'|'terroir'|'drinkingWindow';

export const DEEP_FIELDS:DeepField[]=['summary','expectedProfile','vintageQuality','producerDetails','producerWinemakingPractices','winemakingTechniques','terroir','drinkingWindow'];

const DEEP_OPEN_FIELDS_KEY='winelog.deepSearch.openFields';
export function readOpenDeepFields():Set<DeepField>{
 try{
  const raw=window.localStorage.getItem(accountStorageKey(DEEP_OPEN_FIELDS_KEY));if(!raw)return new Set();
  const parsed=JSON.parse(raw) as unknown;
  return new Set(Array.isArray(parsed)?parsed.filter((x):x is DeepField=>DEEP_FIELDS.includes(x as DeepField)):[]);
 }catch{return new Set()}
}
export function writeOpenDeepFields(next:Set<DeepField>){
 try{window.localStorage.setItem(accountStorageKey(DEEP_OPEN_FIELDS_KEY),JSON.stringify([...next]))}
 catch{/* storage unavailable */}
}


/**
 * Only the research prose, so both the owner's full DeepSearchResult and the
 * narrower SharedDeepSearch a friend receives satisfy it. Asking for the whole
 * result here would force the shared payload to carry diagnostics it must not.
 */
export type ResearchProse=Pick<DeepSearchResult,
 'vintageQuality'|'producerDetails'|'producerWinemakingPractices'|'winemakingTechniques'|'terroir'|'drinkingWindow'>
 &{expectedProfile?:string};

/** Section order is the reading order on both pages; summary renders above these. */
export function researchSections(deep:ResearchProse|null|undefined):Array<[string,DeepField,string]>{
 if(!deep)return [];
 return ([
  ['What to expect','expectedProfile',deep.expectedProfile??''],
  ['Vintage quality','vintageQuality',deep.vintageQuality],
  ['Producer','producerDetails',deep.producerDetails],
  ['Producer-wide practices','producerWinemakingPractices',deep.producerWinemakingPractices],
  ['This wine / vintage winemaking','winemakingTechniques',deep.winemakingTechniques],
  ['Terroir','terroir',deep.terroir],
  ['Drinking window','drinkingWindow',deep.drinkingWindow]
 ] as Array<[string,DeepField,string]>).filter(([, ,value])=>Boolean(value));
}

export function sourceHost(url:string){try{return new URL(url).hostname.toLowerCase().replace(/^www\./,'')}catch{return ''}}

/** Gemini grounding often gives no page title, so several links on one host all
 * render as the bare hostname. Falling back to the last path segment turns
 * "wine.com / wine.com / wine.com" into three links a reader can tell apart. */
export function sourceLinkLabel(source:{title:string;url:string},host:string){
 const title=source.title?.trim();
 if(title&&title.toLowerCase().replace(/^www\./,'')!==host)return title;
 try{
  const segments=new URL(source.url).pathname.split('/').filter(Boolean),last=segments[segments.length-1];
  const decoded=last?decodeURIComponent(last).replace(/\.(?:html?|php|aspx?)$/i,'').replace(/[-_]+/g,' ').trim():'';
  if(decoded)return decoded;
 }catch{/* fall through to host */}
 return host||title||source.url;
}
