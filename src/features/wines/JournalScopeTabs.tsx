import { useSearchParams } from 'react-router-dom';

export type JournalScope='tasted'|'cellar'|'favorites';

/**
 * The three things the Journal can be showing, and the promise that it is only
 * ever showing one of them. Bottles you hold and bottles you drank are separate
 * records with separate meanings, and interleaving them would make a cellar
 * line look like a tasting - so the scopes are exclusive by construction rather
 * than by a filter someone could clear.
 */
export function JournalScopeTabs({scope}:{scope:JournalScope}){
  const [,setParams]=useSearchParams();
  function select(next:JournalScope){
    const query=new URLSearchParams();
    if(next==='cellar')query.set('scope','cellar');
    if(next==='favorites')query.set('favorite','1');
    setParams(query,{replace:true});
  }
  const tab=(value:JournalScope,label:string)=>
    <button type="button" role="tab" aria-selected={scope===value} className={scope===value?'active':''} onClick={()=>select(value)}>{label}</button>;
  return <div className="journal-scope-tabs" role="tablist" aria-label="Journal scope">
    {tab('tasted','Tasted')}{tab('cellar','In cellar')}{tab('favorites','\u2665 Favorites')}
  </div>;
}
