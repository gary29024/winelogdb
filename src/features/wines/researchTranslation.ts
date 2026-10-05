import { useEffect,useMemo,useRef,useState } from 'react';
import { apiJson } from '../../lib/auth/api';
import { getAccount } from '../../lib/auth/client';
import type { DeepField } from './researchSections';

/**
 * The EN / 繁中 switch on a research result.
 *
 * Chinese is made on demand, never automatically: the first press looks for a
 * saved translation of exactly this English (free), and only if there is none
 * does the owner get asked to spend one model call making it. A member can read
 * a translation that already exists but cannot pay for a new one yet.
 */
export type ResearchLang='en'|'zh';
const LANG='zh-Hant-HK';
type Translation={fields:Record<string,string>};
type Phase='idle'|'looking'|'confirm'|'translating'|'unavailable'|'error';

export function useResearchTranslation(fields:Record<string,string>){
 // Only non-empty text is sent, so a section with no research is not "translated".
 const english=useMemo(()=>Object.fromEntries(Object.entries(fields).filter(([,text])=>text.trim())),[fields]);
 const key=JSON.stringify(english);
 const [lang,setLang]=useState<ResearchLang>('en'),[translated,setTranslated]=useState<Record<string,string>|null>(null);
 const [phase,setPhase]=useState<Phase>('idle'),[error,setError]=useState('');
 // New English (a re-run, another wine) never keeps the old Chinese on screen,
 // and a reply for the previous English that lands afterwards is dropped.
 const current=useRef(key);
 useEffect(()=>{current.current=key;setLang('en');setTranslated(null);setPhase('idle');setError('')},[key]);
 const stale=(asked:string)=>asked!==current.current;
 const canTranslate=getAccount()?.role!=='member'&&Object.keys(english).length>0;

 async function choose(next:ResearchLang){
  setError('');
  if(next==='en'){setLang('en');if(phase==='confirm'||phase==='unavailable')setPhase('idle');return}
  if(translated){setLang('zh');return}
  setPhase('looking');const asked=key;
  try{
   const {translation}=await apiJson<{translation:Translation|null}>('/api/research/translation/lookup','POST',{lang:LANG,fields:english});
   if(stale(asked))return;
   if(translation){setTranslated(translation.fields);setLang('zh');setPhase('idle');return}
   setPhase(canTranslate?'confirm':'unavailable');
  }catch(e){if(!stale(asked)){setError((e as Error).message);setPhase('error')}}
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
 /** The text to show for a field: Chinese when chosen and available, else the English. */
 const text=(field:string,fallback:string)=>lang==='zh'&&translated?.[field]?translated[field]:fallback;
 return {lang:translated&&lang==='zh'?'zh' as const:'en' as const,phase,error,choose,translate,cancel,text,available:Object.keys(english).length>0};
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
