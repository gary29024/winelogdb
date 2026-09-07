import { useEffect,useMemo,useRef,useState } from 'react';
import { MAX_STORY_WINES,pickStoryWines } from './storyCollage';
import { drawStoryCard } from './renderStoryCollage';
import { loadStoryPhotos,renderStoryFile,shareStoryFile } from './shareStory';
import type { LoadedPhoto,StoryCard } from './renderStoryCollage';
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
  // Kept across redraws: the preview is redrawn on every tick and untick, and
  // refetching a bottle each time would make choosing feel like loading.
  const photoCache=useRef(new Map<string,LoadedPhoto>());
  const [state,setState]=useState<'drawing'|'ready'|'failed'>('drawing');
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const [chosen,setChosen]=useState(()=>new Set(pickStoryWines(card.wines)));
  const full=chosen.size>=MAX_STORY_WINES;
  // Indexes rather than ids: one wine poured twice in an evening is two rows.
  const shown=useMemo(()=>({...card,wines:card.wines.filter((_,index)=>chosen.has(index))}),[card,chosen]);

  useEffect(()=>{
    let active=true;
    setState('drawing');
    loadStoryPhotos(shown,photoCache.current)
      .then(photos=>{
        if(!active||!canvasRef.current)return;
        drawStoryCard(canvasRef.current,shown,photos);setState('ready');
      })
      .catch(()=>{if(active)setState('failed')});
    return()=>{active=false};
  },[shown]);

  function toggle(index:number){
    setChosen(current=>{
      const next=new Set(current);
      if(next.has(index))next.delete(index);
      else if(next.size<MAX_STORY_WINES)next.add(index);
      return next;
    });
  }

  async function share(){
    if(busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      const outcome=await shareStoryFile(await renderStoryFile(shown,'winelog-story.jpg',photoCache.current));
      if(outcome==='shared')setNotice('Shared. Instagram puts it straight into a story.');
      if(outcome==='downloaded')setNotice('Saved to your photos. Open Instagram and pick it as a story background.');
    }catch(e){setError((e as Error).message||'The card could not be shared')}
    finally{setBusy(false)}
  }

  return <div className="story-share-backdrop" role="presentation" onClick={onClose}>
    <div className="story-share-sheet" role="dialog" aria-modal="true" aria-label="Share to a story" onClick={event=>event.stopPropagation()}>
      <div className="story-share-head">
        <div><p className="eyebrow">SHARE</p><h2>{chosen.size} of {card.wines.length} wine{card.wines.length===1?'':'s'}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="story-share-stage">
        <canvas ref={canvasRef} aria-label={`${card.title}, ${chosen.size} wines`}/>
        {state==='drawing'&&<p className="story-share-state">Laying out the card…</p>}
        {state==='failed'&&<p className="story-share-state" role="alert">The card could not be drawn on this device.</p>}
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
