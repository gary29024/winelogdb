import { useEffect,useRef } from 'react';
import type { FriendTag } from './friendTags';
import '../../friendTags.css';

type Props={
  open:boolean;
  title?:string;
  description?:string;
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
  friends,selected,busy=false,error='',confirmLabel='Confirm tags',
  onSelectedChange,onConfirm,onClose
}:Props){
  const sheet=useRef<HTMLElement>(null);
  useEffect(()=>{
    if(!open)return;
    sheet.current?.focus();
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!busy){event.preventDefault();onClose()}};
    document.addEventListener('keydown',key);
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    return()=>{document.removeEventListener('keydown',key);document.body.style.overflow=overflow};
  },[open,busy,onClose]);
  if(!open)return null;
  const toggle=(id:string)=>onSelectedChange(selected.includes(id)?selected.filter(value=>value!==id):[...selected,id]);
  return <div className="friend-tag-backdrop" role="presentation" onClick={()=>{if(!busy)onClose()}}>
    <section ref={sheet} tabIndex={-1} className="friend-tag-dialog" role="dialog" aria-modal="true" aria-labelledby="friend-tag-title" onClick={event=>event.stopPropagation()}>
      <header className="friend-tag-heading"><div><p className="eyebrow">FRIENDS</p><h2 id="friend-tag-title">{title}</h2></div><button type="button" className="friend-tag-close" aria-label="Close" disabled={busy} onClick={onClose}>×</button></header>
      <p className="friend-tag-description">{description}</p>
      {friends.length?<div className="friend-tag-grid" role="group" aria-label="Friends">
        {friends.map(friend=>{const active=selected.includes(friend.id);return <button type="button" key={friend.id} className={`friend-tag-chip${active?' selected':''}`} aria-pressed={active} disabled={busy} onClick={()=>toggle(friend.id)}>
          <span className="friend-tag-check" aria-hidden="true">{active?'✓':''}</span>
          <span>{friend.display_name}</span>
          {friend.defaultShare&&<small>Default</small>}
        </button>})}
      </div>:<p className="friend-tag-empty">Add a friend from Account & friends first.</p>}
      {error&&<p className="friend-tag-error" role="alert">{error}</p>}
      <footer className="friend-tag-actions"><button type="button" className="quiet" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="primary" disabled={busy||!friends.length} onClick={onConfirm}>{busy?'Saving…':confirmLabel}</button></footer>
    </section>
  </div>;
}
