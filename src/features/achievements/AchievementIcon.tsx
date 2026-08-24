import type { AchievementIconKey } from './types';

const common={viewBox:'0 0 48 48',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true};

export function AchievementIcon({kind}:{kind:AchievementIconKey}){
  if(kind==='first-growth')return <svg {...common}><path d="M8 39h32M11 39V21l13-10 13 10v18M15 20h18M18 39V28h12v11M21 28v11M27 28v11"/><path d="M20 15h8l-1.5-5h-5L20 15Z"/></svg>;
  if(kind==='judgment-paris')return <svg {...common}><path d="M24 8v31M14 12h20M24 12l-8 12M24 12l8 12M10 24h12c0 5-3 8-6 8s-6-3-6-8ZM26 24h12c0 5-3 8-6 8s-6-3-6-8ZM17 39h14"/></svg>;
  if(kind==='beaujolais-crus')return <svg {...common}><circle cx="24" cy="17" r="4"/><circle cx="18" cy="23" r="4"/><circle cx="30" cy="23" r="4"/><circle cx="22" cy="29" r="4"/><circle cx="28" cy="29" r="4"/><circle cx="25" cy="35" r="4"/><path d="M24 13c0-4 2-7 6-8M29 8c4 0 6 2 8 5-4 1-7 0-9-3"/></svg>;
  if(kind==='bordeaux-classification')return <svg {...common}><path d="M9 17h30M12 17V39M36 17v22M8 39h32M15 17v-6h6v6M27 17v-6h6v6M18 39V28h12v11"/><path d="M14 8h20M17 8V5M31 8V5"/></svg>;
  if(kind==='sauternes')return <svg {...common}><path d="M24 7c6 9 11 15 11 22a11 11 0 0 1-22 0c0-7 5-13 11-22Z"/><path d="M19 30c1 3 3 5 6 6"/></svg>;
  if(kind==='graves')return <svg {...common}><path d="M8 39h32M12 39V20l12-10 12 10v19M18 39V27a6 6 0 0 1 12 0v12"/><path d="M16 18h16M22 10V6h4v4"/></svg>;
  if(kind==='saint-emilion')return <svg {...common}><path d="M11 39h26M14 39V18l6-5v5l4-5 4 5v-5l6 5v21M20 39V28h8v11"/><path d="M18 23h3M27 23h3M24 13V7M21 7h6"/></svg>;
  if(kind==='burgundy-grand-cru')return <svg {...common}><path d="M24 6 40 24 24 42 8 24 24 6Z"/><path d="M24 12 34 24 24 36 14 24 24 12Z"/><circle cx="24" cy="24" r="3"/></svg>;
  if(kind==='gevrey-grand-cru')return <svg {...common}><path d="M8 12h32v24H8zM8 20h32M8 28h32M16 12v24M24 12v24M32 12v24"/><path d="M19 8h10M24 8v4"/></svg>;
  if(kind==='rhone-crus')return <svg {...common}><path d="M11 8c8 6 4 12 11 17 6 4 4 9 15 15M18 7c7 5 4 10 10 14 7 5 5 9 11 12"/><path d="M9 39h30"/><circle cx="13" cy="15" r="3"/><circle cx="33" cy="10" r="3"/></svg>;
  return <svg {...common}><circle cx="20" cy="17" r="4"/><circle cx="28" cy="17" r="4"/><circle cx="16" cy="24" r="4"/><circle cx="24" cy="24" r="4"/><circle cx="32" cy="24" r="4"/><circle cx="20" cy="31" r="4"/><circle cx="28" cy="31" r="4"/><circle cx="24" cy="38" r="4"/><path d="M24 13c0-5 3-8 8-9M30 7c4 0 7 2 9 6-5 1-8 0-10-4"/></svg>;
}
