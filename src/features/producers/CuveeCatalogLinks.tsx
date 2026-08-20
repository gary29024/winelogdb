import { useMemo,useState } from 'react';
import { cuveeStyleFamily,normalizeCuveeAlias } from '../../lib/cuvees/entities';
import { changeTastedCuveeCatalogLink,linkTastedCuveeToCatalog,unlinkTastedCuveeFromCatalog,type ProducerDetail,type TastedWine } from './api';
import '../../cuveeCatalogLinks.css';

export type TastedCuveeGroup={cuveeId:string|null;name:string;appellation:string|null;wineStyle:string|null;grapes:string[];wines:TastedWine[]};

const tokens=(value:string)=>new Set(normalizeCuveeAlias(value).split(/\s+/).filter(Boolean).filter(x=>!['grand','premier','cru','village','wine','cuvee'].includes(x)));
function similarity(source:TastedCuveeGroup,target:ProducerDetail['catalogCuvees'][number]){
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

function targetLabel(target:ProducerDetail['catalogCuvees'][number]){
  return [target.canonicalName,target.wineStyle,target.appellation].filter(Boolean).join(' · ');
}

export function CuveeCatalogLinks({producer,group,onChanged}:{producer:ProducerDetail;group:TastedCuveeGroup;onChanged:()=>Promise<void>}){
  const [open,setOpen]=useState(false),[selectedCatalogId,setSelectedCatalogId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const link=useMemo(()=>producer.cuveeCatalogLinks.find(item=>item.sourceCuveeId===group.cuveeId)??null,[producer.cuveeCatalogLinks,group.cuveeId]);
  const ranked=useMemo(()=>[...producer.catalogCuvees].sort((a,b)=>similarity(group,b)-similarity(group,a)),[producer.catalogCuvees,group]);
  const catalogTargetId=group.wines.find(wine=>wine.catalogCuveeId)?.catalogCuveeId??null;
  const directMatch=Boolean(catalogTargetId&&!link);

  function openLink(){setSelectedCatalogId(link?.catalogCuveeId||ranked[0]?.id||'');setError('');setOpen(true)}
  function close(){if(busy)return;setOpen(false);setSelectedCatalogId('');setError('')}
  async function save(){
    if(!group.cuveeId||!selectedCatalogId||busy)return;
    const target=producer.catalogCuvees.find(item=>item.id===selectedCatalogId);if(!target)return;
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

  if(!producer.catalogCuvees.length||!group.cuveeId)return null;
  if(directMatch)return <div className="cuvee-inline-admin" aria-label="Catalog mapping"><span>Catalog matched</span></div>;
  return <>
    <div className="cuvee-inline-admin" aria-label="Catalog mapping">
      {error&&<small className="cuvee-inline-error" role="alert">{error}</small>}
      {!link&&<button type="button" disabled={busy} onClick={openLink}>Link catalog</button>}
      {link&&<><button type="button" disabled={busy} onClick={openLink}>Change link</button><span aria-hidden="true">·</span><button type="button" className="secondary-danger" disabled={busy} onClick={()=>void unlink()}>Unlink</button></>}
    </div>
    {open&&<div className="cuvee-link-backdrop" onClick={close} role="presentation"><div className="cuvee-link-sheet" role="dialog" aria-modal="true" aria-labelledby="cuvee-link-title" onClick={e=>e.stopPropagation()}><div className="cuvee-link-sheet-head"><div><p className="eyebrow">CATALOG LINK</p><h3 id="cuvee-link-title">{group.name}</h3><small>{[group.wineStyle,group.grapes.length?group.grapes.join(' / '):null,group.appellation].filter(Boolean).join(' · ')}</small></div><button type="button" onClick={close} disabled={busy} aria-label="Close catalog link">×</button></div><label>Corresponding producer catalog wine<select value={selectedCatalogId} onChange={e=>setSelectedCatalogId(e.target.value)} disabled={busy}>{ranked.map((target,index)=>{const score=similarity(group,target),suggested=index===0&&score>=.45;return <option key={target.id} value={target.id}>{suggested?'Suggested · ':''}{targetLabel(target)}</option>})}</select></label><p>Only an existing catalog wine can be selected. WineLog uses style as a strong discriminator, so same-name red and white wines remain separate identities.</p>{error&&<p className="producer-error" role="alert">{error}</p>}<div className="cuvee-link-actions"><button type="button" onClick={close} disabled={busy}>Cancel</button><button type="button" onClick={()=>void save()} disabled={busy||!selectedCatalogId}>{busy?'Saving…':link?'Change link':'Confirm link'}</button></div></div></div>}
  </>;
}
