import { useMemo,useState } from 'react';
import { normalizeCuveeAlias } from '../../lib/cuvees/entities';
import { changeTastedCuveeCatalogLink,linkTastedCuveeToCatalog,unlinkTastedCuveeFromCatalog,type ProducerDetail,type TastedWine } from './api';
import '../../cuveeCatalogLinks.css';

type TastedGroup={cuveeId:string;name:string;appellation:string|null;wines:TastedWine[]};

const tokens=(value:string)=>new Set(normalizeCuveeAlias(value).split(/\s+/).filter(Boolean).filter(x=>!['grand','premier','cru','village','wine','cuvee'].includes(x)));
function similarity(source:TastedGroup,target:ProducerDetail['catalogCuvees'][number]){
  const a=tokens(source.name),b=tokens(target.canonicalName),union=new Set([...a,...b]);
  let shared=0;for(const token of a)if(b.has(token))shared+=1;
  let score=union.size?shared/union.size:0;
  const sa=normalizeCuveeAlias(source.appellation??''),ta=normalizeCuveeAlias(target.appellation??'');
  if(sa&&ta&&sa===ta)score+=.45;
  if(normalizeCuveeAlias(source.name)===normalizeCuveeAlias(target.canonicalName))score+=.5;
  return score;
}

export function CuveeCatalogLinks({producer,onChanged}:{producer:ProducerDetail;onChanged:()=>Promise<void>}){
  const [source,setSource]=useState<TastedGroup|null>(null),[editingLinkId,setEditingLinkId]=useState<string|null>(null),[selectedCatalogId,setSelectedCatalogId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const groups=useMemo(()=>{
    const map=new Map<string,TastedWine[]>();
    for(const wine of producer.tastedWines){if(!wine.cuveeId)continue;const list=map.get(wine.cuveeId)??[];list.push(wine);map.set(wine.cuveeId,list)}
    return [...map.entries()].map(([cuveeId,wines])=>({cuveeId,name:wines[0]?.wineName??'',appellation:wines[0]?.appellation??null,wines}));
  },[producer.tastedWines]);
  const unmatched=groups.filter(group=>!group.wines.some(wine=>wine.catalogCuveeId));
  const linkBySource=useMemo(()=>new Map(producer.cuveeCatalogLinks.map(link=>[link.sourceCuveeId,link])),[producer.cuveeCatalogLinks]);

  function openLink(group:TastedGroup,linkId:string|null=null,currentCatalogId=''){
    const ranked=[...producer.catalogCuvees].sort((a,b)=>similarity(group,b)-similarity(group,a));
    setSource(group);setEditingLinkId(linkId);setSelectedCatalogId(currentCatalogId||ranked[0]?.id||'');setError('');
  }
  function close(){if(busy)return;setSource(null);setEditingLinkId(null);setSelectedCatalogId('');setError('')}
  async function save(){
    if(!source||!selectedCatalogId||busy)return;
    const target=producer.catalogCuvees.find(item=>item.id===selectedCatalogId);if(!target)return;
    const action=editingLinkId?'Change catalog link':'Link tasted cuvée';
    if(!confirm(`${action}?\n\n${source.name}\n→ ${target.canonicalName}\n\nThis changes only the catalog mapping. Your tasting records, recognized name and cuvée research remain on their existing stable identity.`))return;
    setBusy(true);setError('');
    try{
      if(editingLinkId)await changeTastedCuveeCatalogLink(producer.id,editingLinkId,target.id);else await linkTastedCuveeToCatalog(producer.id,source.cuveeId,target.id);
      await onChanged();close();
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function unlink(link:ProducerDetail['cuveeCatalogLinks'][number]){
    if(!confirm(`Unlink “${link.sourceName}” from catalog wine “${link.catalogName}”?\n\nThe tasting records and cuvée identity are not deleted. The producer catalog will simply stop counting that tasted cuvée as the selected catalog wine.`))return;
    setBusy(true);setError('');
    try{await unlinkTastedCuveeFromCatalog(producer.id,link.id);await onChanged()}catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }

  if(!producer.catalogCuvees.length)return null;
  return <div className="cuvee-catalog-matching">
    <div className="cuvee-catalog-heading"><div><p className="section-label">CATALOG MATCHING</p><strong>Match different wine names safely</strong></div><small>Manual choices are remembered for this producer.</small></div>
    {error&&<p className="producer-error" role="alert">{error}</p>}
    {unmatched.length>0&&<div className="cuvee-unmatched-list">{unmatched.map(group=>{
      const existing=linkBySource.get(group.cuveeId);if(existing)return null;
      return <div className="cuvee-match-row" key={group.cuveeId}><div><strong>{group.name}</strong><span>{[group.appellation,[...new Set(group.wines.map(w=>w.vintage??'NV'))].join(' · ')].filter(Boolean).join(' · ')}</span><small>Not matched to the producer catalog</small></div><button type="button" disabled={busy} onClick={()=>openLink(group)}>Link to catalog wine</button></div>
    })}</div>}
    {producer.cuveeCatalogLinks.length>0&&<div className="cuvee-active-links"><span>Manual links</span>{producer.cuveeCatalogLinks.map(link=>{
      const group=groups.find(item=>item.cuveeId===link.sourceCuveeId)??{cuveeId:link.sourceCuveeId,name:link.sourceName,appellation:link.sourceAppellation,wines:[]};
      return <div className="cuvee-link-row" key={link.id}><div><strong>{link.sourceName}</strong><span>→ {link.catalogName}</span></div><div><button type="button" disabled={busy} onClick={()=>openLink(group,link.id,link.catalogCuveeId)}>Change</button><button type="button" className="secondary-danger" disabled={busy} onClick={()=>void unlink(link)}>Unlink</button></div></div>
    })}</div>}
    {!unmatched.length&&!producer.cuveeCatalogLinks.length&&<small>All tasted cuvées currently resolve directly to catalog identities.</small>}
    {source&&<div className="cuvee-link-backdrop" onClick={close} role="presentation"><div className="cuvee-link-sheet" role="dialog" aria-modal="true" aria-labelledby="cuvee-link-title" onClick={e=>e.stopPropagation()}><div className="cuvee-link-sheet-head"><div><p className="eyebrow">CATALOG LINK</p><h3 id="cuvee-link-title">{source.name}</h3>{source.appellation&&<small>{source.appellation}</small>}</div><button type="button" onClick={close} disabled={busy} aria-label="Close catalog link">×</button></div><label>Corresponding producer catalog wine<select value={selectedCatalogId} onChange={e=>setSelectedCatalogId(e.target.value)} disabled={busy}>{[...producer.catalogCuvees].sort((a,b)=>similarity(source,b)-similarity(source,a)).map((target,index)=>{const score=similarity(source,target),suggested=index===0&&score>=.45;return <option key={target.id} value={target.id}>{suggested?'Suggested · ':''}{target.canonicalName}{target.appellation?` · ${target.appellation}`:''}</option>})}</select></label><p>Only an existing catalog wine can be selected. WineLog will use this stable mapping for the producer’s “Tasted” status without rewriting the original tasting identity.</p>{error&&<p className="producer-error" role="alert">{error}</p>}<div className="cuvee-link-actions"><button type="button" onClick={close} disabled={busy}>Cancel</button><button type="button" onClick={()=>void save()} disabled={busy||!selectedCatalogId}>{busy?'Saving…':editingLinkId?'Change link':'Confirm link'}</button></div></div></div>}
  </div>;
}
