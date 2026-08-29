import { useEffect,useRef,useState } from 'react';
import { authHeaders } from '../../lib/auth/client';
import { ImageLightbox } from '../../components/ImageLightbox';
import { deleteTastingDocument,uploadTastingDocuments,type TastingDocument } from './api';
import '../../tastings.css';

/**
 * The printed wine list.
 *
 * Available on a closed tasting as much as an open one, because the sheet is
 * usually handed out at the end - or turns up the next day.
 */
function useDocumentUrl(documentId:string){
  const [src,setSrc]=useState<string>();
  useEffect(()=>{
    let active=true,created='';
    fetch(`/api/tastings/documents/${documentId}`,{headers:authHeaders()})
      .then(response=>{if(!response.ok)throw new Error('unavailable');return response.blob()})
      .then(blob=>{if(!active)return;created=URL.createObjectURL(blob);setSrc(created)})
      .catch(()=>undefined);
    return()=>{active=false;if(created)URL.revokeObjectURL(created)};
  },[documentId]);
  return src;
}

function DocumentThumb({document:doc,index,onOpen,onRemove,busy}:{document:TastingDocument;index:number;onOpen:(src:string,alt:string)=>void;onRemove:()=>void;busy:boolean}){
  const src=useDocumentUrl(doc.id),alt=`Wine list page ${index+1}`;
  return <li className="tasting-document">
    {src
      ?<button type="button" className="photo-lightbox-trigger" onClick={()=>onOpen(src,alt)} aria-label={`Enlarge ${alt}`}><img src={src} alt={alt}/></button>
      :<span className="tasting-document-loading" aria-label={`${alt} loading`}/>}
    <button type="button" className="tasting-document-remove" onClick={onRemove} disabled={busy} aria-label={`Remove ${alt}`}>×</button>
  </li>;
}

export function TastingDocuments({tastingId,documents,onChange}:{tastingId:string;documents:TastingDocument[];onChange:(next:TastingDocument[])=>void}){
  const input=useRef<HTMLInputElement>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [lightbox,setLightbox]=useState<{src:string;alt:string}|null>(null);

  async function add(files:File[]){
    if(!files.length)return;
    setBusy(true);setError('');
    try{
      const {documents:added}=await uploadTastingDocuments(tastingId,files);
      onChange([...documents,...added]);
    }catch(e){setError((e as Error).message)}finally{setBusy(false);if(input.current)input.current.value=''}
  }

  async function remove(documentId:string){
    if(!confirm('Remove this wine list page? The photo is deleted permanently.'))return;
    setBusy(true);setError('');
    try{await deleteTastingDocument(documentId);onChange(documents.filter(item=>item.id!==documentId))}
    catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }

  return <section className="tasting-documents">
    <div className="tasting-documents-head"><h2>Wine list</h2><button type="button" onClick={()=>input.current?.click()} disabled={busy}>{busy?'Working…':documents.length?'Add pages':'Add wine list'}</button></div>
    <p className="tasting-documents-note">Photograph the printed list handed out at the tasting. It keeps the prices, importer and flight order that the bottles themselves never carry, and it is kept for as long as the tasting is.</p>
    {error&&<p className="tasting-error" role="alert">{error}</p>}
    {documents.length>0&&<ul className="tasting-document-strip">{documents.map((document,index)=>
      <DocumentThumb key={document.id} document={document} index={index} busy={busy} onOpen={(src,alt)=>setLightbox({src,alt})} onRemove={()=>void remove(document.id)}/>)}</ul>}
    <input ref={input} className="visually-hidden" type="file" accept="image/*" multiple onChange={event=>void add(Array.from(event.target.files??[]))}/>
    {lightbox&&<ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={()=>setLightbox(null)}/>}
  </section>;
}
