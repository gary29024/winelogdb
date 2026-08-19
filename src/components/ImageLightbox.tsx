import { useEffect,useRef } from 'react';
import { createPortal } from 'react-dom';
import '../imageLightbox.css';

type ImageLightboxProps={src:string;alt:string;onClose:()=>void};

export function ImageLightbox({src,alt,onClose}:ImageLightboxProps){
  const closeRef=useRef<HTMLButtonElement>(null),onCloseRef=useRef(onClose);
  onCloseRef.current=onClose;
  useEffect(()=>{
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')onCloseRef.current()};
    window.addEventListener('keydown',onKeyDown);
    closeRef.current?.focus();
    return()=>{window.removeEventListener('keydown',onKeyDown);document.body.style.overflow=previousOverflow};
  },[]);

  return createPortal(
    <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label={`Enlarged ${alt}`} onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
      <button ref={closeRef} type="button" className="photo-lightbox-close" onClick={onClose} aria-label="Close enlarged photo">×</button>
      <div className="photo-lightbox-content">
        <img src={src} alt={alt}/>
        <small>Tap outside the photo or press Esc to close.</small>
      </div>
    </div>,
    document.body
  );
}
