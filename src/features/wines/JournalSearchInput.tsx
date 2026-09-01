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
  const latestCommit=useRef(onCommit),timerRef=useRef<number|null>(null);
  latestCommit.current=onCommit;

  useEffect(()=>{
    if(timerRef.current!=null){window.clearTimeout(timerRef.current);timerRef.current=null}
    setDraft(value);
  },[value,resetSeq]);

  useEffect(()=>()=>{if(timerRef.current!=null)window.clearTimeout(timerRef.current)},[]);

  function change(next:string){
    setDraft(next);
    if(timerRef.current!=null)window.clearTimeout(timerRef.current);
    if(next===value){timerRef.current=null;return}
    timerRef.current=window.setTimeout(()=>{timerRef.current=null;latestCommit.current(next)},SEARCH_DEBOUNCE_MS);
  }

  return <label className="search">Search<input aria-label="Search wines" type="search" value={draft} onChange={event=>change(event.target.value)} placeholder="Search wines, makers, regions…"/></label>;
}
