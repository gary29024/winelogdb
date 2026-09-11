import { useEffect,useRef,useState } from 'react';
import { shouldUseSemanticQuery } from '../../lib/journal/semanticQuery';
import '../../journalSearch.css';

const SEARCH_DEBOUNCE_MS=300;

type Props={value:string;resetSeq:number;onCommit:(value:string)=>void};

/**
 * Keep keystrokes local to the input instead of re-rendering the whole Journal.
 * Ordinary identity searches retain the fast debounce. Once a draft becomes a
 * semantic/natural-language query, it must be explicitly submitted so composing
 * a description never spends one embedding request per pause in typing.
 */
export function JournalSearchInput({value,resetSeq,onCommit}:Props){
  const [draft,setDraft]=useState(value);
  const latestCommit=useRef(onCommit),timerRef=useRef<number|null>(null);
  latestCommit.current=onCommit;
  const semanticDraft=shouldUseSemanticQuery(draft);

  function clearTimer(){
    if(timerRef.current!=null){window.clearTimeout(timerRef.current);timerRef.current=null}
  }

  useEffect(()=>{
    clearTimer();
    setDraft(value);
  },[value,resetSeq]);

  useEffect(()=>()=>clearTimer(),[]);

  function commit(next=draft){
    clearTimer();
    if(next!==value)latestCommit.current(next);
  }

  function change(next:string){
    setDraft(next);
    clearTimer();
    if(next===value||shouldUseSemanticQuery(next))return;
    timerRef.current=window.setTimeout(()=>{timerRef.current=null;latestCommit.current(next)},SEARCH_DEBOUNCE_MS);
  }

  return <div className="journal-search-control">
    <label className="search">Search<input aria-label="Search wines" type="search" value={draft} onChange={event=>change(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();commit()}}} placeholder="Search names, regions, or describe a wine…" title="Names search automatically. For a description such as floral elegant Burgundy with fine tannins, press Enter or Search."/></label>
    {semanticDraft&&<button type="button" className="journal-semantic-search-button" onClick={()=>commit()} disabled={draft===value} aria-label="Run semantic search">Search</button>}
  </div>;
}
