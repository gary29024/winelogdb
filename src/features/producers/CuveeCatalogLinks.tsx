import { useMemo,useState } from 'react';
import { CATALOG_HIERARCHY_LABELS,catalogChoicesForPresentation,type CatalogPresentationChoice } from '../../lib/cuvees/catalogPresentation';
import { cuveeStyleFamily,normalizeCuveeAlias } from '../../lib/cuvees/entities';
import { changeTastedCuveeCatalogLink,linkTastedCuveeToCatalog,unlinkTastedCuveeFromCatalog,type ProducerDetail,type TastedWine } from './api';
import '../../cuveeCatalogLinks.css';

export type TastedCuveeGroup={cuveeId:string|null;catalogCuveeId:string|null;name:string;appellation:string|null;wineStyle:string|null;grapes:string[];releaseFamily:boolean;wines:TastedWine[]};
type CatalogTarget=CatalogPresentationChoice;

const tokens=(value:string)=>new Set(normalizeCuveeAlias(value).split(/\s+/).filter(Boolean).filter(x=>!['grand','premier','cru','village','wine','cuvee'].includes(x)));
function similarity(source:TastedCuveeGroup,target:CatalogTarget){
  const a=tokens(source.name),b=tokens(target.canonicalName),union=new Set([...a,...b]);
  let shared=0;for(const token of a)if(b.has(token))shared+=1;
  let score=union.size?shared/union.size:0;
  const sa=normalizeCuveeAlias(source.appellation??''),ta=normalizeCuveeAlias(target.appellation??'');
  if(sa&&ta&&sa===ta)score+=.45;
  if(normalizeCuveeAlias(source.name)===normalizeCuveeAlias(target.canonicalName))score+=.5;
  const sourceStyle=cuveeStyleFamily(source.wineStyle),targetStyle=cuveeStyleFamily(target.wineStyle);
  if(sourceStyle&&targetStyle)score+=sourceStyle===targetStyle?0.4:-0.8;
  return score;
}

function targetLabel(target:CatalogTarget){
  const parts:string[]=[];
  for(const value of [target.canonicalName,target.classification,target.wineStyle,target.appellation]){
    const text=String(value??'').trim(),key=normalizeCuveeAlias(text);if(!text||parts.some(item=>normalizeCuveeAlias(item)===key))continue;parts.push(text);
  }
  return parts.join(' · ');
}

export function CuveeCatalogLinks({producer,group,onChanged}:{producer:ProducerDetail;group:TastedCuveeGroup;onChanged:()=>Promise<void>}){
  const [open,setOpen]=useState(false),[selectedCatalogId,setSelectedCatalogId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const link=useMemo(()=>producer.cuveeCatalogLinks.find(item=>item.sourceCuveeId===group.cuveeId)??null,[producer.cuveeCatalogLinks,group.cuveeId]);
  const choices=useMemo<CatalogTarget[]>(()=>catalogChoicesForPresentation(producer.catalog,[producer.canonicalName,...producer.aliases],producer.catalogCuvees),[producer]);
  const linkable=useMemo(()=>choices.filter((target):target is CatalogTarget&{id:string}=>Boolean(target.id)),[choices]);
  const suggested=useMemo(()=>{
    const ranked=[...linkable].sort((a,b)=>similarity(group,b)-similarity(group,a)),best=ranked[0];
    return best&&similarity(group,best)>=.45?best:null;
  },[linkable,group]);
  const choiceGroups=useMemo(()=>CATALOG_HIERARCHY_LABELS.flatMap(hierarchy=>{const items=choices.filter(target=>target.hierarchy===hierarchy);return items.length?[{hierarchy,items}]:[]}),[choices]);
  const catalogTargetId=group.catalogCuveeId??group.wines.find(wine=>wine.catalogCuveeId)?.catalogCuveeId??null;
  const directMatch=Boolean(catalogTargetId&&!link);

  function openLink(){
    const current=link?.catalogCuveeId&&linkable.some(target=>target.id===link.catalogCuveeId)?link.catalogCuveeId:'';
    setSelectedCatalogId(current||suggested?.id||linkable[0]?.id||'');setError('');setOpen(true);
  }
  function close(){if(busy)return;setOpen(false);setSelectedCatalogId('');setError('')}
  async function save(){
    if(!group.cuveeId||!selectedCatalogId||busy)return;
    const target=choices.find(item=>item.id===selectedCatalogId);if(!target?.id)return;
    const action=link?'Change catalog link':'Link tasted cuvée';
    if(!confirm(`${action}?\n\n${group.name}${group.wineStyle?` · ${group.wineStyle}`:''}\n→ ${targetLabel(target)}\n\nThis changes only the catalog mapping. Your tasting records, recognized name and cuvée research remain on their existing stable identity.`))return;
    setBusy(true);setError('');
    try{
      if(link)await changeTastedCuveeCatalogLink(producer.id,link.id,target.id);else await linkTastedCuveeToCatalog(producer.id,group.cuveeId,target.id);
      await onChanged();setOpen(false);
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function unlink(){
    if(!link||busy)return;
    if(!confirm(`Unlink “${link.sourceName}” from catalog wine “${link.catalogName}”?\n\nThe tasting records and cuvée identity are not deleted. The producer catalog will simply stop counting that tasted cuvée as the selected catalog wine.`))return;
    setBusy(true);setError('');
    try{await unlinkTastedCuveeFromCatalog(producer.id,link.id);await onChanged()}catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }

  if(!choices.length||!group.cuveeId)return null;
  if(directMatch)return <div className="cuvee-inline-admin" aria-label="Catalog mapping"><span>{group.releaseFamily?'Catalog matched · edition family':'Catalog matched'}</span></div>;
  const unresolved=choices.length-linkable.length;
  return <>
    <div className="cuvee-inline-admin" aria-label="Catalog mapping">
      {error&&<small className="cuvee-inline-error" role="alert">{error}</small>}
      {!link&&<button type="button" disabled={busy} onClick={openLink}>Link catalog</button>}
      {link&&<><button type="button" disabled={busy} onClick={openLink}>Change link</button><span aria-hidden="true">·</span><button type="button" className="secondary-danger" disabled={busy} onClick={()=>void unlink()}>Unlink</button></>}
    </div>
    {open&&<div className="cuvee-link-backdrop" onClick={close} role="presentation"><div className="cuvee-link-sheet" role="dialog" aria-modal="true" aria-labelledby="cuvee-link-title" onClick={e=>e.stopPropagation()}><div className="cuvee-link-sheet-head"><div><p className="eyebrow">CATALOG LINK</p><h3 id="cuvee-link-title">{group.name}</h3><small>{[group.wineStyle,group.grapes.length?group.grapes.join(' / '):null,group.appellation].filter(Boolean).join(' · ')}</small></div><button type="button" onClick={close} disabled={busy} aria-label="Close catalog link">×</button></div><label>Corresponding producer catalog wine<select value={selectedCatalogId} onChange={e=>setSelectedCatalogId(e.target.value)} disabled={busy||!linkable.length}>{choiceGroups.map(({hierarchy,items})=><optgroup key={hierarchy} label={hierarchy}>{items.map(target=><option key={target.key} value={target.id??`unresolved:${target.key}`} disabled={!target.id}>{target.id===suggested?.id?'Suggested · ':!target.id?'Needs identity repair · ':''}{targetLabel(target)}</option>)}</optgroup>)}</select></label><p>{choices.length} catalog wine{choices.length===1?'':'s'} · {linkable.length} linkable{unresolved?` · ${unresolved} shown but unavailable until identity repair`:''}. This is the same canonical catalog shown on the producer page, ordered by hierarchy then alphabetically.</p>{error&&<p className="producer-error" role="alert">{error}</p>}<div className="cuvee-link-actions"><button type="button" onClick={close} disabled={busy}>Cancel</button><button type="button" onClick={()=>void save()} disabled={busy||!selectedCatalogId}>{busy?'Saving…':link?'Change link':'Confirm link'}</button></div></div></div>}
  </>;
}
