import { useEffect,useRef,useState } from 'react';

const SEARCH_DEBOUNCE_MS=300;

type Props={value:string;resetSeq:number;onCommit:(value:string)=>void};

/**
 * Keep keystrokes local to the input instead of re-rendering the whole Journal.
 * Only the settled value is promoted to the URL, which is what drives the
 * expensive wine-grid render and the server request.
 */
export function JournalSearchInput({value,resetSeq,onCommit}:Props){
  const [draft,setDraft]=useState(value);
  const latestCommit=useRef(onCommit);
  latestCommit.current=onCommit;

  useEffect(()=>setDraft(value),[value,resetSeq]);

  useEffect(()=>{
    if(draft===value)return;
    const timer=window.setTimeout(()=>latestCommit.current(draft),SEARCH_DEBOUNCE_MS);
    return()=>window.clearTimeout(timer);
  },[draft,value]);

  return <label className="search">Search<input aria-label="Search wines" type="search" value={draft} onChange={event=>setDraft(event.target.value)} placeholder="Search wines, makers, regions…"/></label>;
}
