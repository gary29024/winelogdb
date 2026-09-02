import { useSearchParams } from 'react-router-dom';

export type JournalScope='tasted'|'cellar'|'favorites';

/**
 * The three things the Journal can be showing, and the promise that it is only
 * ever showing one of them. Bottles you hold and bottles you drank are separate
 * records with separate meanings, and interleaving them would make a cellar
 * line look like a tasting - so the scopes are exclusive by construction rather
 * than by a filter someone could clear.
 */
/**
 * The cellar is a lazily loaded page, and its chunk used to be requested by the
 * tap that needed it - queued behind every wine photo the journal still had in
 * flight, which is exactly when someone reaches for another scope. Warmed on
 * the press instead, the way the nav warms its own pages.
 */
const preloadCellar=()=>void import('../cellar/CellarPage');

export function JournalScopeTabs({scope}:{scope:JournalScope}){
  const [,setParams]=useSearchParams();
  function select(next:JournalScope){
    const query=new URLSearchParams();
    if(next==='cellar')query.set('scope','cellar');
    if(next==='favorites')query.set('favorite','1');
    setParams(query,{replace:true});
  }
  const warm=(value:JournalScope)=>value==='cellar'?preloadCellar:undefined;
  const tab=(value:JournalScope,label:string)=>
    <button type="button" role="tab" aria-selected={scope===value} className={scope===value?'active':''}
      onPointerDown={warm(value)} onFocus={warm(value)} onClick={()=>select(value)}>{label}</button>;
  return <div className="journal-scope-tabs" role="tablist" aria-label="Journal scope">
    {tab('tasted','Tasted')}{tab('cellar','In cellar')}{tab('favorites','\u2665 Favorites')}
  </div>;
}
