import { useEffect,useId,useRef } from 'react';
import type { FriendTag } from './friendTags';
import '../../friendTags.css';

type Props={
  open:boolean;
  title?:string;
  description?:string;
  relationship?:string;
  readOnly?:boolean;
  confirmDisabled?:boolean;
  friends:FriendTag[];
  selected:string[];
  busy?:boolean;
  error?:string;
  confirmLabel?:string;
  onSelectedChange:(ids:string[])=>void;
  onConfirm:()=>void;
  onClose:()=>void;
};

export function FriendTagDialog({
  open,title='Tag friends',description='Choose who can see this wine in Shared with me.',
  friends,selected,busy=false,error='',confirmLabel='Confirm tags',relationship,readOnly=false,confirmDisabled=false,
  onSelectedChange,onConfirm,onClose
}:Props){
  const sheet=useRef<HTMLElement>(null),titleId=useId();
  const maxSelected=24;
  useEffect(()=>{
    if(!open)return;
    sheet.current?.focus();
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!busy){event.preventDefault();onClose();return}
      if(event.key!=='Tab'||!sheet.current)return;
      const focusable=[...sheet.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')];
      if(!focusable.length){event.preventDefault();sheet.current.focus();return}
      const first=focusable[0],last=focusable[focusable.length-1],active=document.activeElement;
      if(event.shiftKey&&(active===sheet.current||active===first||!sheet.current.contains(active))){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&(active===sheet.current||active===last||!sheet.current.contains(active))){event.preventDefault();first.focus()}
    };
    document.addEventListener('keydown',key);
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    return()=>{document.removeEventListener('keydown',key);document.body.style.overflow=overflow};
  },[open,busy,onClose]);
  if(!open)return null;
  const toggle=(id:string)=>{
    if(selected.includes(id)){onSelectedChange(selected.filter(value=>value!==id));return}
    if(selected.length>=maxSelected)return;
    onSelectedChange([...selected,id]);
  };
  return <div className="friend-tag-backdrop" role="presentation" onClick={()=>{if(!busy)onClose()}}>
    <section ref={sheet} tabIndex={-1} className="friend-tag-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={event=>event.stopPropagation()}>
      <header className="friend-tag-heading"><div><p className="eyebrow">FRIENDS</p><h2 id={titleId}>{title}</h2></div>{!readOnly&&<button type="button" className="friend-tag-close" aria-label="Close" disabled={busy} onClick={onClose}>×</button>}</header>
      {readOnly&&<>
        {relationship&&<p className="friend-tag-relationship">{relationship}</p>}
        <footer className="friend-tag-actions"><button type="button" className="primary" onClick={onClose}>Close</button></footer>
      </>}
      {!readOnly&&<>
      <p className="friend-tag-description">{description}</p>
      {friends.length?<div className="friend-tag-grid" role="group" aria-label="Friends">
        {friends.map(friend=>{const active=selected.includes(friend.id),atLimit=selected.length>=maxSelected&&!active;return <button type="button" key={friend.id} className={`friend-tag-chip${active?' selected':''}`} aria-pressed={active} disabled={busy||confirmDisabled||atLimit} onClick={()=>toggle(friend.id)}>
          <span className="friend-tag-check" aria-hidden="true">{active?'✓':''}</span>
          <span>{friend.display_name}</span>
          {friend.defaultShare&&<small>Default</small>}
        </button>})}
      </div>:!confirmDisabled&&<p className="friend-tag-empty">Add a friend from Account & friends first.</p>}
      {friends.length>0&&<small className="friend-tag-description" role="status">{selected.length} / {maxSelected} selected</small>}
      {error&&<p className="friend-tag-error" role="alert">{error}</p>}
      <footer className="friend-tag-actions"><button type="button" className="quiet" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="primary" disabled={busy||confirmDisabled} onClick={onConfirm}>{busy?'Saving…':confirmLabel}</button></footer>
      </>}
    </section>
  </div>;
}
