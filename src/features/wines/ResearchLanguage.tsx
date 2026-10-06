import type { useResearchTranslation } from './researchTranslation';
import '../../researchLanguage.css';

type State=ReturnType<typeof useResearchTranslation>;

/**
 * The EN / 中 buttons. Small enough to share a heading row; what happens after
 * a press (confirming, translating, errors) is ResearchLanguageStatus, which
 * sits below the heading where there is room for a sentence. See useResearchTranslation.
 */
export function ResearchLanguageSwitch({state}:{state:State}){
 if(!state.available)return null;
 const busy=state.phase==='looking'||state.phase==='translating';
 return <div className="research-language-switch" role="group" aria-label="Research language">
  <button type="button" aria-pressed={state.lang==='en'} disabled={busy} onClick={()=>void state.choose('en')}>EN</button>
  <button type="button" lang="zh-Hant-HK" aria-pressed={state.lang==='zh'} disabled={busy} onClick={()=>void state.choose('zh')} title="繁體中文 (Traditional Chinese)">中</button>
 </div>;
}

export function ResearchLanguageStatus({state}:{state:State}){
 if(!state.available)return null;
 return <>
  {state.phase==='looking'&&<p className="research-language-note" role="status">Looking for a saved translation…</p>}
  {state.phase==='translating'&&<p className="research-language-note" role="status"><span className="research-language-spinner" aria-hidden="true"/>Translating into Traditional Chinese…</p>}
  {state.phase==='confirm'&&<div className="research-language-confirm"><p>{state.partial?`${state.missingCount} section${state.missingCount===1?' is':'s are'} not translated yet. Translate ${state.missingCount===1?'it':'them'} into Traditional Chinese?`:'Translate this research into Traditional Chinese?'} This uses one AI request. The translation is saved, so opening it again is free.</p><button type="button" className="primary" onClick={()=>void state.translate()}>Translate</button><button type="button" className="secondary-danger" onClick={state.cancel}>Cancel</button></div>}
  {state.phase==='unavailable'&&<p className="research-language-note" role="status">{state.partial?'Some sections are not translated yet and are shown in English.':'No Chinese translation of this research yet.'} Only the account owner can create one.</p>}
  {state.phase==='error'&&<p className="research-language-note research-language-error" role="alert">{state.error||'The translation could not be loaded.'}</p>}
 </>;
}
