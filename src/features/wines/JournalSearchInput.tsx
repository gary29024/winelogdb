import { useEffect,useRef,useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { shouldUseSemanticQuery } from '../../lib/journal/semanticQuery';
import '../../journalSearch.css';

const SEARCH_DEBOUNCE_MS=300;

type Props={value:string;resetSeq:number};

/**
 * Keep keystrokes local to the input instead of re-rendering the whole Journal.
 * Every settled draft still runs the cheap lexical search. Descriptive drafts
 * additionally offer Smart search, which opts into an embedding request only
 * when the user presses Enter or taps the button.
 *
 * A positive semantic attempt counter keeps Smart search retryable: repeating
 * the same search changes the URL and causes a real Journal refresh instead of
 * presenting a disabled completed state while background indexing catches up.
 */
export function JournalSearchInput({value,resetSeq}:Props){
  const [draft,setDraft]=useState(value),[params,setParams]=useSearchParams();
  const timerRef=useRef<number|null>(null),paramsRef=useRef(params);
  paramsRef.current=params;
  const semanticDraft=shouldUseSemanticQuery(draft);
  const attempt=Math.max(0,Number.parseInt(params.get('semantic')??'0',10)||0);
  const semanticActive=semanticDraft&&attempt>0&&draft===value;

  function clearTimer(){
    if(timerRef.current!=null){window.clearTimeout(timerRef.current);timerRef.current=null}
  }

  useEffect(()=>{
    clearTimer();
    setDraft(value);
  },[value,resetSeq]);

  useEffect(()=>()=>clearTimer(),[]);

  function commit(next:string,smart:boolean){
    clearTimer();
    // React Router's setSearchParams callback closes over the params from the
    // render that created it. A debounce can outlive that render, so build from
    // the latest ref and pass a concrete URLSearchParams instead; otherwise a
    // filter changed during these 300 ms can be silently overwritten.
    const updated=new URLSearchParams(paramsRef.current);
    next?updated.set('query',next):updated.delete('query');
    if(next&&shouldUseSemanticQuery(next)){
      const previousAttempt=next===value?Math.max(0,Number.parseInt(updated.get('semantic')??'0',10)||0):0;
      updated.set('semantic',smart?String(previousAttempt+1):'0');
    }else updated.delete('semantic');
    updated.delete('offset');
    setParams(updated,{replace:true});
  }

  function change(next:string){
    setDraft(next);
    clearTimer();
    if(next===value&&attempt===0)return;
    timerRef.current=window.setTimeout(()=>{timerRef.current=null;commit(next,false)},SEARCH_DEBOUNCE_MS);
  }

  return <div className="journal-search-control">
    <label className="search">Search<input aria-label="Search wines" type="search" value={draft} onChange={event=>change(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();commit(draft,semanticDraft)}}} placeholder="Search names, regions, or describe a wine…" title="Search updates automatically. For a description such as floral elegant Burgundy with fine tannins, use Smart search for meaning-based matches."/></label>
    {semanticDraft&&<button type="button" className={`journal-semantic-search-button${semanticActive?' active':''}`} onClick={()=>commit(draft,true)} aria-label="Run smart search">{semanticActive?'↻ Smart search again':'✨ Smart search'}</button>}
  </div>;
}
