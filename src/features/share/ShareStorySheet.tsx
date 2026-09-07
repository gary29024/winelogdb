import { useEffect,useRef,useState } from 'react';
import { MAX_STORY_WINES } from './storyCollage';
import { drawStoryCard } from './renderStoryCollage';
import { loadStoryPhotos,renderStoryFile,shareStoryFile } from './shareStory';
import type { StoryCard } from './renderStoryCollage';
import '../../shareStory.css';

/**
 * The card, shown before it is shared.
 *
 * Nobody posts a picture they have not seen, and a collage assembled from a
 * dozen photographs is exactly the thing that can come out wrong - a bottle
 * cropped through its label, a name too long for its cell. So the preview is
 * the feature, and the button under it only hands over what is already on
 * screen.
 */
export function ShareStorySheet({card,onClose}:{card:StoryCard;onClose:()=>void}){
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const [state,setState]=useState<'drawing'|'ready'|'failed'>('drawing');
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const shown=card.wines.slice(0,MAX_STORY_WINES);

  useEffect(()=>{
    let active=true;
    setState('drawing');
    loadStoryPhotos(card)
      .then(photos=>{
        if(!active||!canvasRef.current)return;
        drawStoryCard(canvasRef.current,card,photos);setState('ready');
      })
      .catch(()=>{if(active)setState('failed')});
    return()=>{active=false};
  },[card]);

  async function share(){
    if(busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      const outcome=await shareStoryFile(await renderStoryFile(card));
      if(outcome==='shared')setNotice('Shared. Instagram puts it straight into a story.');
      if(outcome==='downloaded')setNotice('Saved to your photos. Open Instagram and pick it as a story background.');
    }catch(e){setError((e as Error).message||'The card could not be shared')}
    finally{setBusy(false)}
  }

  return <div className="story-share-backdrop" role="presentation" onClick={onClose}>
    <div className="story-share-sheet" role="dialog" aria-modal="true" aria-label="Share to a story" onClick={event=>event.stopPropagation()}>
      <div className="story-share-head">
        <div><p className="eyebrow">SHARE</p><h2>{shown.length} wine{shown.length===1?'':'s'}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="story-share-stage">
        <canvas ref={canvasRef} aria-label={`${card.title}, ${shown.length} wines`}/>
        {state==='drawing'&&<p className="story-share-state">Laying out the card…</p>}
        {state==='failed'&&<p className="story-share-state" role="alert">The card could not be drawn on this device.</p>}
      </div>
      {card.wines.length>MAX_STORY_WINES&&<p className="story-share-note">The first {MAX_STORY_WINES} are on the card. Past that a bottle is too small to recognise.</p>}
      {notice&&<p className="story-share-notice" role="status">{notice}</p>}
      {error&&<p className="story-share-error" role="alert">{error}</p>}
      <button type="button" className="primary wide-action" disabled={busy||state!=='ready'} onClick={()=>void share()}>
        {busy?'Preparing…':'Share'}
      </button>
    </div>
  </div>;
}
