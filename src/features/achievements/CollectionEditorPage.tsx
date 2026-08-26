import { useEffect,useMemo,useState,type FormEvent } from 'react';
import { Link,useNavigate,useParams } from 'react-router-dom';
import { AchievementIcon } from './AchievementIcon';
import { catalogueRuleTargetCount } from './customCollections';
import { deleteCustomAchievement,getAchievementCatalogueOptions,getAchievementProgress,saveCustomAchievement } from './api';
import type { AchievementCatalogueOptions,AchievementCatalogueRule,AchievementIconKey,AchievementProgress,CustomAchievementInput,CustomAchievementManualItem } from './types';
import '../../achievements.css';

const icons:AchievementIconKey[]=['first-growth','judgment-paris','beaujolais-crus','bordeaux-classification','sauternes','graves','saint-emilion','burgundy-grand-cru','gevrey-grand-cru','rhone-crus','michelin-grapes'];
type SmartKind=AchievementCatalogueRule['type'];
type ManualKind=CustomAchievementManualItem['type'];
const emptyOptions:AchievementCatalogueOptions={producers:[],cuvees:[],appellations:[],regions:[]};
const regionKey=(country:string|null|undefined,region:string)=>`${country??''}\u001f${region}`;

function manualItemsFromProgress(collection:AchievementProgress|null):CustomAchievementManualItem[]{
  if(!collection||collection.definition.origin!=='custom')return [];
  const result:CustomAchievementManualItem[]=[];
  for(const item of collection.definition.items){
    const selector=item.selector;
    if(selector.type==='producer'&&selector.producerId)result.push({type:'producer',producerId:selector.producerId});
    else if(selector.type==='cuvee'&&selector.cuveeId)result.push({type:'cuvee',cuveeId:selector.cuveeId});
    else if(selector.type==='appellation'&&selector.appellationNames[0])result.push({type:'appellation',appellation:selector.appellationNames[0]});
  }
  return result;
}
function itemKey(item:CustomAchievementManualItem){return item.type==='producer'?`p:${item.producerId}`:item.type==='cuvee'?`c:${item.cuveeId}`:`a:${item.appellation.toLowerCase()}`}

export function CollectionEditorPage(){
  const {id}=useParams(),navigate=useNavigate(),editing=Boolean(id);
  const [options,setOptions]=useState<AchievementCatalogueOptions>(emptyOptions),[loading,setLoading]=useState(true),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  const [title,setTitle]=useState(''),[subtitle,setSubtitle]=useState(''),[icon,setIcon]=useState<AchievementIconKey>('burgundy-grand-cru'),[mode,setMode]=useState<'catalogue'|'manual'>('catalogue');
  const [smartKind,setSmartKind]=useState<SmartKind>('producer_cuvees'),[smartValue,setSmartValue]=useState('');
  const [manualKind,setManualKind]=useState<ManualKind>('producer'),[manualValue,setManualValue]=useState(''),[manualQuery,setManualQuery]=useState(''),[manualItems,setManualItems]=useState<CustomAchievementManualItem[]>([]);

  useEffect(()=>{let active=true;(async()=>{
    try{
      const [catalogue,collections]=await Promise.all([getAchievementCatalogueOptions(),editing?getAchievementProgress():Promise.resolve([] as AchievementProgress[])]);if(!active)return;
      setOptions(catalogue);
      if(editing){
        const found=collections.find(item=>item.definition.id===id)??null;if(!found?.definition.editable){setError(found?'Curated collections cannot be edited.':'Collection not found.');setLoading(false);return}
        setTitle(found.definition.title);setSubtitle(found.definition.subtitle);setIcon(found.definition.icon);
        if(found.definition.origin==='catalogue'&&found.definition.catalogueRule){const rule=found.definition.catalogueRule;setMode('catalogue');setSmartKind(rule.type);setSmartValue(rule.type==='producer_cuvees'?rule.producerId:rule.type==='appellation_producers'?rule.appellation:regionKey(rule.country,rule.region))}
        else{setMode('manual');setManualItems(manualItemsFromProgress(found))}
      }
      setLoading(false);
    }catch(e){if(active){setError((e as Error).message);setLoading(false)}}
  })();return()=>{active=false}},[editing,id]);

  const manualChoices=useMemo(()=>{
    const query=manualQuery.trim().toLowerCase();
    if(manualKind==='producer')return options.producers.filter(item=>!query||`${item.name} ${item.region??''} ${item.country??''}`.toLowerCase().includes(query)).slice(0,200).map(item=>({value:item.id,label:item.name,meta:[item.region,item.country].filter(Boolean).join(' · ')}));
    if(manualKind==='cuvee')return options.cuvees.filter(item=>!query||`${item.producerName} ${item.name} ${item.appellation??''}`.toLowerCase().includes(query)).slice(0,200).map(item=>({value:item.id,label:`${item.producerName} · ${item.name}`,meta:[item.appellation,item.catalogBacked?'Catalogue':'Journal identity'].filter(Boolean).join(' · ')}));
    return options.appellations.filter(item=>!query||item.name.toLowerCase().includes(query)).slice(0,200).map(item=>({value:item.name,label:item.name,meta:`${item.producerCount} producers · ${item.cuveeCount} cuvées`}));
  },[manualKind,manualQuery,options]);
  const smartRule=useMemo<AchievementCatalogueRule|null>(()=>{
    if(!smartValue)return null;
    if(smartKind==='producer_cuvees'){const producer=options.producers.find(item=>item.id===smartValue);return producer?{type:'producer_cuvees',producerId:producer.id,producerName:producer.name}:null}
    if(smartKind==='appellation_producers')return {type:'appellation_producers',appellation:smartValue};
    const region=options.regions.find(item=>regionKey(item.country,item.name)===smartValue);return region?{type:'region_producers',region:region.name,country:region.country}:null;
  },[options,smartKind,smartValue]);
  const smartCount=smartRule?catalogueRuleTargetCount(smartRule,options):0;
  const manualLabels=useMemo(()=>manualItems.map(item=>{
    if(item.type==='producer'){const match=options.producers.find(option=>option.id===item.producerId);return {key:itemKey(item),label:match?.name??'Unavailable producer',meta:'Producer'}}
    if(item.type==='cuvee'){const match=options.cuvees.find(option=>option.id===item.cuveeId);return {key:itemKey(item),label:match?`${match.producerName} · ${match.name}`:'Unavailable cuvée',meta:match?.appellation??'Cuvée'}}
    return {key:itemKey(item),label:item.appellation,meta:'Appellation'};
  }),[manualItems,options]);

  function addManual(){if(!manualValue)return;const item:CustomAchievementManualItem=manualKind==='producer'?{type:'producer',producerId:manualValue}:manualKind==='cuvee'?{type:'cuvee',cuveeId:manualValue}:{type:'appellation',appellation:manualValue};setManualItems(current=>current.some(existing=>itemKey(existing)===itemKey(item))?current:[...current,item]);setManualValue('')}
  async function save(event:FormEvent){
    event.preventDefault();setError('');
    const input:CustomAchievementInput={title,subtitle,icon,mode,...(mode==='manual'?{items:manualItems}:{rule:smartRule??undefined})};
    try{setSaving(true);const result=await saveCustomAchievement(input,id);navigate(`/achievements/${result.id}`,{replace:true})}catch(e){setError((e as Error).message);setSaving(false)}
  }
  async function remove(){if(!id||!window.confirm(`Delete “${title}”? This removes only the collection, never your wine records.`))return;try{setSaving(true);await deleteCustomAchievement(id);navigate('/achievements',{replace:true})}catch(e){setError((e as Error).message);setSaving(false)}}

  if(loading)return <section className="achievements-page"><p aria-live="polite">Opening collection builder…</p></section>;
  if(error&&!options.producers.length)return <section className="achievements-page"><Link className="achievement-back" to="/achievements">‹ Wine Collections</Link><p role="alert">{error}</p></section>;
  return <section className="achievements-page collection-editor-page">
    <Link className="achievement-back" to={id?`/achievements/${id}`:'/achievements'}>‹ {id?'Collection':'Wine Collections'}</Link>
    <header className="collection-editor-hero"><div><p className="achievements-eyebrow">{editing?'EDIT COLLECTION':'NEW COLLECTION'}</p><h1>{editing?'Edit your collection':'Build a Wine Collection'}</h1><p>Use canonical WineLog catalogue identities. Smart collections can grow automatically as the catalogue is researched.</p></div>{editing&&<button type="button" className="collection-danger-button" disabled={saving} onClick={remove}>Delete</button>}</header>
    <form className="collection-editor-form" onSubmit={save}>
      {error&&<p className="collection-editor-error" role="alert">{error}</p>}
      <section className="collection-editor-card"><div className="collection-editor-heading"><span>1</span><div><h2>Collection details</h2><p>Name the challenge and choose its visual stamp.</p></div></div>
        <label className="collection-field"><span>Title</span><input required maxLength={80} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. My Chambolle-Musigny producers"/></label>
        <label className="collection-field"><span>Description</span><textarea maxLength={180} rows={2} value={subtitle} onChange={e=>setSubtitle(e.target.value)} placeholder="What are you trying to complete?"/></label>
        <div className="collection-field"><span>Icon</span><div className="collection-icon-picker">{icons.map(value=><button type="button" aria-label={`Use ${value} icon`} aria-pressed={icon===value} className={icon===value?'active':''} onClick={()=>setIcon(value)} key={value}><AchievementIcon kind={value}/></button>)}</div></div>
      </section>
      <section className="collection-editor-card"><div className="collection-editor-heading"><span>2</span><div><h2>Checklist source</h2><p>Choose a live catalogue rule or pin specific targets yourself.</p></div></div>
        <div className="collection-mode-toggle"><button type="button" className={mode==='catalogue'?'active':''} onClick={()=>setMode('catalogue')}><strong>Smart catalogue</strong><small>Updates as WineLog's catalogue changes</small></button><button type="button" className={mode==='manual'?'active':''} onClick={()=>setMode('manual')}><strong>Manual picks</strong><small>Fixed canonical targets you choose</small></button></div>
        {mode==='catalogue'?<div className="collection-smart-builder">
          <label className="collection-field"><span>Smart rule</span><select value={smartKind} onChange={e=>{setSmartKind(e.target.value as SmartKind);setSmartValue('')}}><option value="producer_cuvees">Every catalogue wine from a producer</option><option value="appellation_producers">Every catalogued producer in an appellation</option><option value="region_producers">Every catalogued producer in a region</option></select></label>
          <label className="collection-field"><span>{smartKind==='producer_cuvees'?'Producer':smartKind==='appellation_producers'?'Appellation':'Region'}</span><select required value={smartValue} onChange={e=>setSmartValue(e.target.value)}><option value="">Choose…</option>{smartKind==='producer_cuvees'?options.producers.filter(item=>item.catalogCount>0).map(item=><option key={item.id} value={item.id}>{item.name} · {item.catalogCount} catalogue wines</option>):smartKind==='appellation_producers'?options.appellations.map(item=><option key={item.name} value={item.name}>{item.name} · {item.producerCount} producers</option>):options.regions.map(item=><option key={regionKey(item.country,item.name)} value={regionKey(item.country,item.name)}>{[item.name,item.country].filter(Boolean).join(' · ')} · {item.producerCount} producers</option>)}</select></label>
          <aside className="collection-live-rule"><strong>{smartCount} current {smartCount===1?'target':'targets'}</strong><span>The total is recalculated from canonical catalogue identities whenever you open Wine Collections. New qualifying catalogue entries join automatically; removed or merged identities reconcile on the next load.</span></aside>
        </div>:<div className="collection-manual-builder">
          <div className="collection-manual-picker"><label className="collection-field"><span>Target type</span><select value={manualKind} onChange={e=>{setManualKind(e.target.value as ManualKind);setManualValue('');setManualQuery('')}}><option value="producer">Producer</option><option value="cuvee">Cuvée</option><option value="appellation">Appellation</option></select></label><label className="collection-field collection-search-field"><span>Find target</span><input value={manualQuery} onChange={e=>setManualQuery(e.target.value)} placeholder="Filter available names…"/></label><label className="collection-field collection-choice-field"><span>Available canonical targets</span><select value={manualValue} onChange={e=>setManualValue(e.target.value)}><option value="">Choose…</option>{manualChoices.map(choice=><option value={choice.value} key={choice.value}>{choice.label}{choice.meta?` · ${choice.meta}`:''}</option>)}</select></label><button className="collection-add-target" type="button" disabled={!manualValue} onClick={addManual}>Add target</button></div>
          <div className="collection-selected-targets">{manualLabels.length?manualLabels.map(item=><div key={item.key}><span><strong>{item.label}</strong><small>{item.meta}</small></span><button type="button" aria-label={`Remove ${item.label}`} onClick={()=>setManualItems(current=>current.filter(entry=>itemKey(entry)!==item.key))}>×</button></div>):<p>No targets selected yet. Choose only canonical names already available in WineLog.</p>}</div>
        </div>}
      </section>
      <div className="collection-editor-actions"><Link to={id?`/achievements/${id}`:'/achievements'}>Cancel</Link><button type="submit" className="primary" disabled={saving||!title.trim()||(mode==='catalogue'&&!smartRule)||(mode==='manual'&&!manualItems.length)}>{saving?'Saving…':editing?'Save changes':'Create collection'}</button></div>
    </form>
  </section>;
}
