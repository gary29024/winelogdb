import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { MAX_STORY_WINES,pickStoryWines } from './storyCollage';
import { drawStoryCard } from './renderStoryCollage';
import { loadStoryPhotos,renderStoryFile,shareStoryFile } from './shareStory';
import { fetchBottleFrames,measureBottleFrame,thumbnailOf } from './bottleFrameApi';
import type { LoadedPhoto,StoryCard,StoryFrames } from './renderStoryCollage';
import '../../shareStory.css';

/**
 * The card, shown before it is shared, and the wines it is made of.
 *
 * Nobody posts a picture they have not seen, and a collage assembled from a
 * dozen photographs is exactly the thing that can come out wrong - a bottle
 * cropped through its label, a name too long for its cell. So the preview is
 * the feature, and the button under it only hands over what is already on
 * screen.
 *
 * The list beside it is the other half of that: an evening is rarely worth
 * posting whole. Sixteen is what fits, but four is often what you mean, and
 * choosing them here beats going back to the journal to select differently.
 */
export function ShareStorySheet({card,onClose}:{card:StoryCard;onClose:()=>void}){
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  // Kept across redraws: the preview is redrawn on every tick, untick and
  // measurement, and refetching a bottle each time would make it feel like
  // loading rather than choosing.
  const photoCache=useRef(new Map<string,LoadedPhoto>());
  const [state,setState]=useState<'drawing'|'ready'|'failed'>('drawing');
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const [chosen,setChosen]=useState(()=>new Set(pickStoryWines(card.wines)));
  const [frames,setFrames]=useState<StoryFrames>(()=>new Map());
  const [align,setAlign]=useState(true);
  const [showDate,setShowDate]=useState(true),[showTastingName,setShowTastingName]=useState(true);
  const [measuring,setMeasuring]=useState(0);
  const full=chosen.size>=MAX_STORY_WINES;
  // Indexes rather than ids: one wine poured twice in an evening is two rows.
  const shown=useMemo(()=>({...card,title:showTastingName?card.title:'',subtitle:showDate?card.subtitle:'',wines:card.wines.filter((_,index)=>chosen.has(index))}),[card,chosen,showDate,showTastingName]);
  const imageIds=useMemo(()=>[...new Set(shown.wines.map(wine=>wine.imageId).filter((id):id is string=>Boolean(id)))],[shown]);
  const unmeasured=useMemo(()=>imageIds.filter(id=>!frames.has(id)),[imageIds,frames]);
  const drawnFrames=align?frames:undefined;

  // What is already known, which is free. Measuring the rest is a vision call
  // and never happens without being asked for. Asked ids are remembered so
  // that a photograph which has never been measured is not asked after on
  // every redraw - the answer would be the same nothing.
  const asked=useRef(new Set<string>());
  const mounted=useRef(false);
  useEffect(()=>{
    mounted.current=true;
    return()=>{mounted.current=false};
  },[]);
  useEffect(()=>{
    const missing=imageIds.filter(id=>!asked.current.has(id));
    if(!missing.length)return;
    for(const id of missing)asked.current.add(id);
    fetchBottleFrames(missing)
      // Results belong to image IDs, not to the selection that started the
      // lookup. Keep them through selection changes and Strict Mode replay.
      .then(found=>{if(mounted.current&&found.size)setFrames(current=>new Map([...found,...current]))})
      .catch(()=>{for(const id of missing)asked.current.delete(id)});
  },[imageIds]);

  useEffect(()=>{
    let active=true;
    setState('drawing');
    loadStoryPhotos(shown,photoCache.current)
      .then(photos=>{
        if(!active||!canvasRef.current)return;
        drawStoryCard(canvasRef.current,shown,photos,drawnFrames);setState('ready');
      })
      .catch(()=>{if(active)setState('failed')});
    return()=>{active=false};
  },[shown,drawnFrames]);

  function toggle(index:number){
    setChosen(current=>{
      const next=new Set(current);
      if(next.has(index))next.delete(index);
      else if(next.size<MAX_STORY_WINES)next.add(index);
      return next;
    });
  }

  /**
   * Measures the photographs on the card that have never been measured.
   *
   * One small call each, three at a time so a card of sixteen does not open
   * sixteen connections on venue wifi, and each answer is stored server-side -
   * so this is the only time these photographs ever cost anything.
   */
  const measure=useCallback(async()=>{
    if(measuring||!unmeasured.length)return;
    setError('');setMeasuring(unmeasured.length);
    const queue=[...unmeasured];
    let failed=0;
    const worker=async()=>{
      for(let id=queue.shift();id;id=queue.shift()){
        const photo=photoCache.current.get(id);
        if(!photo){failed++;setMeasuring(count=>Math.max(0,count-1));continue}
        try{
          const frame=await measureBottleFrame(id,await thumbnailOf(photo,`${id}.jpg`));
          setFrames(current=>new Map(current).set(id,frame));
        }catch{failed++}
        setMeasuring(count=>Math.max(0,count-1));
      }
    };
    await Promise.all([worker(),worker(),worker()]);
    setMeasuring(0);
    if(failed)setError(failed===1?'One photograph could not be measured. It is on the card as it was framed.':`${failed} photographs could not be measured. They are on the card as they were framed.`);
  },[measuring,unmeasured]);

  async function share(){
    if(busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      const outcome=await shareStoryFile(await renderStoryFile(shown,'winelog-story.jpg',photoCache.current,drawnFrames));
      if(outcome==='shared')setNotice('Shared. Instagram puts it straight into a story.');
      if(outcome==='downloaded')setNotice('Saved to your photos. Open Instagram and pick it as a story background.');
    }catch(e){setError((e as Error).message||'The card could not be shared')}
    finally{setBusy(false)}
  }

  const measured=imageIds.length-unmeasured.length;
  return <div className="story-share-backdrop" role="presentation" onClick={onClose}>
    <div className="story-share-sheet" role="dialog" aria-modal="true" aria-label="Share to a story" onClick={event=>event.stopPropagation()}>
      <div className="story-share-head">
        <div><p className="eyebrow">SHARE</p><h2>{chosen.size} of {card.wines.length} wine{card.wines.length===1?'':'s'}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="story-share-stage">
        <canvas ref={canvasRef} aria-label={[shown.title,shown.subtitle,`${chosen.size} wines`].filter(Boolean).join(', ')}/>
        {state==='drawing'&&<p className="story-share-state">Laying out the card…</p>}
        {state==='failed'&&<p className="story-share-state" role="alert">The card could not be drawn on this device.</p>}
      </div>
      <div className="story-share-align" role="group" aria-label="Story details">
        <label>
          <input type="checkbox" checked={showDate} onChange={event=>setShowDate(event.target.checked)}/>
          <span>Show date</span>
        </label>
        <label>
          <input type="checkbox" checked={showTastingName} onChange={event=>setShowTastingName(event.target.checked)}/>
          <span>Show tasting name</span>
        </label>
      </div>
      <div className="story-share-align">
        <label>
          <input type="checkbox" checked={align} onChange={event=>setAlign(event.target.checked)}/>
          <span>Line the bottles up</span>
        </label>
        {measuring>0
          ?<p className="story-share-note" role="status">Measuring {measuring} photograph{measuring===1?'':'s'}…</p>
          :unmeasured.length
            ?<><p className="story-share-note">{measured?`${measured} of ${imageIds.length} photographs have been measured. `:''}Measuring reads where the bottle sits in each photograph, and which way it leans. It is one small scan per photograph, kept for good, so a card made from these wines again is free.</p>
              <button type="button" onClick={()=>void measure()} disabled={!align}>Measure {unmeasured.length} photograph{unmeasured.length===1?'':'s'}</button></>
            :imageIds.length?<p className="story-share-note">Every bottle on this card has been measured.</p>:null}
      </div>
      {card.wines.length>MAX_STORY_WINES
        ?<p className="story-share-note">Sixteen is what fits before a bottle stops being recognisable, so favourites were kept first. Change the card below.</p>
        :<p className="story-share-note">Every wine is on the card. Untick any that should not be.</p>}
      <ul className="story-share-picks">
        {card.wines.map((wine,index)=><li key={`${wine.id}-${index}`}>
          <label className={chosen.has(index)?'picked':undefined}>
            <input type="checkbox" checked={chosen.has(index)} disabled={full&&!chosen.has(index)} onChange={()=>toggle(index)}/>
            <span>
              <strong>{wine.wineName}</strong>
              <small>{[wine.producer,wine.vintage?String(wine.vintage):'NV'].filter(Boolean).join(' · ')}</small>
            </span>
            {wine.favorite&&<em aria-label="Favourite">★</em>}
          </label>
        </li>)}
      </ul>
      {full&&card.wines.length>MAX_STORY_WINES&&<p className="story-share-note">The card is full. Take one off to add another.</p>}
      {notice&&<p className="story-share-notice" role="status">{notice}</p>}
      {error&&<p className="story-share-error" role="alert">{error}</p>}
      <button type="button" className="primary wide-action" disabled={busy||state!=='ready'||!chosen.size} onClick={()=>void share()}>
        {busy?'Preparing…':'Share'}
      </button>
    </div>
  </div>;
}
