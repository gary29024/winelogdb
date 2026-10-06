import { useEffect,useMemo,useRef,useState } from 'react';
import { apiJson } from '../../lib/auth/api';
import { getAccount } from '../../lib/auth/client';
import type { DeepField } from './researchSections';

/**
 * The EN / 繁中 switch on a research result.
 *
 * Research runs translate themselves as their last step, so the Chinese is
 * normally already saved: it is looked up (free) as soon as the research is on
 * screen, and the switch is instant. Each section is saved on its own, so a
 * page can have some sections in Chinese and others not yet - research saved
 * before translation existed, or a run whose translation step failed. The
 * owner is then offered the missing sections; a member reads what exists.
 */
export type ResearchLang='en'|'zh';
const LANG='zh-Hant-HK';
type Translation={fields:Record<string,string>};
type Phase='idle'|'looking'|'confirm'|'translating'|'unavailable'|'error';

export function useResearchTranslation(fields:Record<string,string>){
 // Only non-empty text is sent, so a section with no research is not "translated".
 const english=useMemo(()=>Object.fromEntries(Object.entries(fields).filter(([,text])=>text.trim())),[fields]);
 const key=JSON.stringify(english),available=Object.keys(english).length>0;
 const [lang,setLang]=useState<ResearchLang>('en'),[translated,setTranslated]=useState<Record<string,string>>({});
 const [phase,setPhase]=useState<Phase>('idle'),[error,setError]=useState('');
 const current=useRef(key),lookup=useRef<Promise<Record<string,string>>|null>(null);
 const stale=(asked:string)=>asked!==current.current;
 const lookUp=()=>lookup.current??=apiJson<{translation:Translation}>('/api/research/translation/lookup','POST',{lang:LANG,fields:english}).then(body=>body.translation?.fields??{});
 // New English (a re-run, another wine) never keeps the old Chinese on screen,
 // and a reply for the previous English that lands afterwards is dropped.
 useEffect(()=>{
  current.current=key;lookup.current=null;setLang('en');setTranslated({});setPhase('idle');setError('');
  if(!available)return;
  const asked=key;
  lookUp().then(found=>{if(!stale(asked))setTranslated(found)},()=>{if(!stale(asked))lookup.current=null});
 },[key]);
 const canTranslate=getAccount()?.role!=='member'&&available;
 const missing=Object.keys(english).filter(field=>!translated[field]);

 async function choose(next:ResearchLang){
  setError('');
  if(next==='en'){setLang('en');if(phase==='confirm'||phase==='unavailable')setPhase('idle');return}
  const asked=key;let found=translated;
  if(missing.length){
   setPhase('looking');
   try{found=await lookUp()}catch(e){lookup.current=null;if(!stale(asked)){setError((e as Error).message);setPhase('error')}return}
   if(stale(asked))return;
   setTranslated(found);
  }
  const stillMissing=Object.keys(english).filter(field=>!found[field]);
  if(stillMissing.length<Object.keys(english).length)setLang('zh');
  setPhase(!stillMissing.length?'idle':canTranslate?'confirm':'unavailable');
 }
 async function translate(){
  setPhase('translating');setError('');const asked=key;
  try{
   const {translation}=await apiJson<{translation:Translation}>('/api/research/translation','POST',{lang:LANG,fields:english});
   if(stale(asked))return;
   setTranslated(translation.fields);setLang('zh');setPhase('idle');
  }catch(e){if(!stale(asked)){setError((e as Error).message);setPhase('error')}}
 }
 const cancel=()=>{setPhase('idle');setError('')};
 const showing=lang==='zh'&&Object.keys(translated).length>0;
 /** The text to show for a field: Chinese when chosen and available, else the English. */
 const text=(field:string,fallback:string)=>showing&&translated[field]?translated[field]:fallback;
 return {lang:showing?'zh' as const:'en' as const,phase,error,choose,translate,cancel,text,available,
  /** Sections still in English while 繁中 is chosen. */
  missingCount:missing.length,partial:showing&&missing.length>0};
}

/** Section headings are fixed UI text, so they are translated here rather than by the model. */
export const DEEP_FIELD_LABELS_ZH:Record<DeepField,string>={
 summary:'摘要',
 expectedProfile:'預期風格',
 vintageQuality:'年份質素',
 producerDetails:'酒莊',
 producerWinemakingPractices:'酒莊整體釀酒方式',
 winemakingTechniques:'此酒／此年份的釀造',
 terroir:'風土 (Terroir)',
 drinkingWindow:'適飲期'
};

/** The small fixed labels around research, in the language being read. Written here, never by the model. */
export const RESEARCH_COPY={
 en:{
  sections:(n:number)=>`${n} research section${n===1?'':'s'}`,
  expandAll:'Expand all',collapseAll:'Collapse all',
  sources:(n:number,sites:number)=>`${n} source${n===1?'':'s'}${sites>0?` · ${sites} website${sites===1?'':'s'}`:''}`,
  domaineContext:'General domaine context; not automatically treated as verified for this exact vintage.',
  practicesHeading:'General winemaking practices',
  producerWide:'Producer-wide context only. Exact cuvée/vintage techniques are researched separately on the wine page.',
  references:(n:number,range:boolean,sites:number)=>`${n} ${range?'profile & range':'research'} reference${n===1?'':'s'}${sites?` · ${sites} website${sites===1?'':'s'}`:''}`
 },
 zh:{
  sections:(n:number)=>`${n} 個研究部分`,
  expandAll:'全部展開',collapseAll:'全部收起',
  sources:(n:number,sites:number)=>`${n} 個資料來源${sites>0?` · ${sites} 個網站`:''}`,
  domaineContext:'酒莊整體背景，未自動視為此年份已核實的資料。',
  practicesHeading:'酒莊整體釀酒方式',
  producerWide:'僅為酒莊整體背景。個別酒款／年份的釀造技術會在酒款頁面另行研究。',
  references:(n:number,range:boolean,sites:number)=>`${n} 個${range?'酒莊簡介及酒款系列':'研究'}參考資料${sites?` · ${sites} 個網站`:''}`
 }
} as const;
