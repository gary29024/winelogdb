import { useEffect,useState } from 'react';
import { Link,useParams } from 'react-router-dom';
import { AchievementIcon } from './AchievementIcon';
import { achievementChecklistHeading } from './collectionSections';
import { getAchievementProgress,setAchievementMatchMode } from './api';
import type { AchievementMatchMode,AchievementProgress } from './types';
import '../../achievements.css';
import { linkFrom } from '../wines/backTarget';

function statusCopy(status:AchievementProgress['items'][number]['status']){if(status==='tasted')return 'Tasted';if(status==='possible')return 'Needs linking';return 'Not tasted'}
function collectionEyebrow(collection:AchievementProgress){const definition=collection.definition;if(definition.series)return `${definition.series.authority} · ${definition.series.region} · ${definition.series.edition}`;if(definition.origin==='catalogue')return 'SMART CATALOGUE COLLECTION';if(definition.origin==='custom')return 'MY COLLECTION';return 'COLLECTION'}
function smartRuleCopy(collection:AchievementProgress){const rule=collection.definition.catalogueRule;if(!rule)return '';if(rule.type==='producer_cuvees')return `Every current catalogue-backed cuvée from ${rule.producerName}.`;if(rule.type==='appellation_producers')return `Every producer with a current catalogue-backed wine in ${rule.appellation}.`;return `Every current catalogued producer in ${[rule.region,rule.country].filter(Boolean).join(', ')}.`}
function matchModeCopy(mode:AchievementMatchMode){if(mode==='producer')return 'Any wine from the participating producer counts.';if(mode==='cuvee')return 'The same named wine counts regardless of vintage.';return 'Only the exact historic wine and vintage counts.'}

export function AchievementDetailPage(){
  const {id}=useParams(),[collection,setCollection]=useState<AchievementProgress|null|undefined>(undefined),[error,setError]=useState(''),[actionError,setActionError]=useState(''),[changingMode,setChangingMode]=useState(false);
  useEffect(()=>{let active=true;getAchievementProgress().then(result=>{if(active)setCollection(result.find(item=>item.definition.id===id)??null)}).catch(e=>{if(active)setError((e as Error).message)});return()=>{active=false}},[id]);
  if(error)return <section className="achievements-page"><p role="alert">{error}</p></section>;
  if(collection===undefined)return <section className="achievements-page"><p aria-live="polite">Opening collection…</p></section>;
  if(!collection)return <section className="achievements-page"><Link className="achievement-back" to="/achievements">‹ Wine Collections</Link><h1>Collection not found</h1></section>;
  const {definition}=collection;
  const groups=collection.items.reduce<Array<{key:string;section:string|null;subsection:string|null;items:Array<{item:AchievementProgress['items'][number];index:number}>}>>((result,item,index)=>{
    const heading=achievementChecklistHeading(definition.id,index),key=`${heading.section??''}|${heading.subsection??''}`,last=result[result.length-1];
    if(last?.key===key)last.items.push({item,index});else result.push({key,section:heading.section,subsection:heading.subsection,items:[{item,index}]});
    return result;
  },[]);
  async function changeMode(matchMode:AchievementMatchMode){
    setActionError('');setChangingMode(true);
    try{await setAchievementMatchMode(definition.id,matchMode);const result=await getAchievementProgress();setCollection(result.find(item=>item.definition.id===definition.id)??null)}
    catch(e){setActionError((e as Error).message)}finally{setChangingMode(false)}
  }
  return <section className="achievements-page achievement-detail-page">
    <div className="achievement-detail-nav"><Link className="achievement-back" to="/achievements">‹ Wine Collections</Link>{definition.editable&&<Link className="achievement-edit-link" to={`/achievements/${definition.id}/edit`}>Edit collection</Link>}</div>
    <header className="achievement-detail-hero">
      <span className={`collection-icon achievement-detail-icon collection-icon-${definition.icon}`}><AchievementIcon kind={definition.icon}/></span>
      <div className="achievement-detail-title"><p className="achievements-eyebrow">{collectionEyebrow(collection)}</p><h1>{definition.title}</h1><p>{definition.subtitle}</p></div>
      <div className="achievement-detail-score"><strong>{collection.completed}<span>/{collection.total}</span></strong><small>{collection.complete?'Stamp earned':'tasted'}</small></div>
    </header>

    <section className="achievement-detail-progress"><div className="collection-progress-bar"><span style={{width:`${collection.percent}%`}}/></div><div><span>{collection.percent}% complete</span>{collection.possible>0&&<span>{collection.possible} possible {collection.possible===1?'match':'matches'} need linking</span>}</div></section>
    {collection.supportsRelaxedMatching&&<aside className="achievement-match-mode"><div><strong>Counting mode</strong><span>{matchModeCopy(collection.matchMode)}</span></div><select aria-label="Achievement counting mode" disabled={changingMode} value={collection.matchMode} onChange={event=>changeMode(event.target.value as AchievementMatchMode)}><option value="exact">Exact historic wine + vintage</option><option value="cuvee">Same wine · any vintage</option><option value="producer">Producer tasted · any wine</option></select>{actionError&&<p role="alert">{actionError}</p>}</aside>}
    {definition.origin==='catalogue'&&<aside className="achievement-live-rule"><strong>Live catalogue rule</strong><span>{smartRuleCopy(collection)} The target list is regenerated from canonical WineLog catalogue identities when its saved cache is invalidated by a journal or catalogue change.</span></aside>}

    <section className="achievement-checklist-card">
      <div className="achievement-checklist-heading"><div><p className="achievements-eyebrow">CHECKLIST</p><h2>{collection.total} targets</h2></div><span>{collection.pending} remaining</span></div>
      {collection.items.length?<div className="achievement-checklist">{groups.map(group=><div className="achievement-check-group" key={group.key||'all'}>{(group.section||group.subsection)&&<div className="achievement-check-section">{group.section&&<strong>{group.section}</strong>}{group.subsection&&<span>{group.subsection}</span>}</div>}{group.items.map(({item})=>{
          const back=linkFrom({to:`/achievements/${id}`,label:definition.title});
          const links=item.tastedVintageLinks??[],firstWine=item.tastedWineIds[0];
          return <article className={`achievement-check-row achievement-check-${item.status}`} key={item.id}>
            <span className="achievement-check-mark" aria-hidden="true">{item.status==='tasted'?'✓':item.status==='possible'?'?':'○'}</span>
            <div className="achievement-check-copy">
              <strong>{item.label}</strong>{item.note&&<small>{item.note}</small>}
              {/* A row that matched several vintages links to each of them, so
                  nothing has to pick one on the reader's behalf. */}
              {links.length>0&&<small className="achievement-check-vintages">Tasted vintages: {links.map((link,index)=><span key={link.vintage}>
                {index>0&&', '}<Link to={`/wines/${link.wineId}`} state={back}>{link.vintage}</Link>
              </span>)}</small>}
            </div>
            <div className="achievement-check-status"><span>{statusCopy(item.status)}</span>
              {/* Only worth a link of its own when the vintages above are not
                  already offering one: an undated or non-vintage tasting. */}
              {firstWine&&links.length!==1&&<Link to={`/wines/${firstWine}`} state={back}>{item.status==='possible'?'Review':links.length?'Latest tasting':'View tasting'}</Link>}
            </div>
          </article>})}</div>)}</div>:<p className="achievement-empty-checklist">No catalogue targets currently match this live rule. Edit the collection or refresh the relevant producer catalogue.</p>}
    </section>

    {definition.references.length>0&&<section className="achievement-reference-card"><p className="achievements-eyebrow">COLLECTION SOURCES</p><h2>Definition references</h2><p>These sources define the membership of this collection; they do not determine whether your tasting matches.</p><div>{definition.references.map(reference=><a key={reference.url} href={reference.url} target="_blank" rel="noreferrer">{reference.title}<span aria-hidden="true">↗</span></a>)}</div></section>}
  </section>;
}
