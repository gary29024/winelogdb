import type { ConditionIcon } from './model';

/** Small line icons for the Vintages screens, on the app's 24px grid. They inherit colour. */
export function VintageIcon({kind,size=16}:{kind:ConditionIcon|'calendar'|'info'|'glass';size?:number}){
  const props={width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2.1,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true,focusable:'false' as const};
  switch(kind){
    case 'sun':return <svg {...props}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>;
    case 'drop':return <svg {...props}><path d="M12 3c-4 5-6 8-6 11a6 6 0 0 0 12 0c0-3-2-6-6-11z"/></svg>;
    case 'moon':return <svg {...props}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>;
    case 'clock':return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'flame':return <svg {...props}><path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1 1 2 2 3 3 0-2 0-4 0-6z"/></svg>;
    case 'scale':return <svg {...props}><path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/></svg>;
    case 'therm':return <svg {...props}><path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z"/></svg>;
    case 'spark':return <svg {...props}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/></svg>;
    case 'calendar':return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>;
    case 'glass':return <svg {...props}><path d="M8 3h8l-1 7a3 3 0 0 1-6 0z"/><path d="M12 13v7M9 21h6"/></svg>;
    case 'info':return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>;
  }
}
