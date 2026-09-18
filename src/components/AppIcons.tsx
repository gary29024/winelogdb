export type AppIconKey=
  |'passport'|'journal'|'producers'|'insights'
  |'scan'|'single-wine'|'group-photo'|'batch-scan'
  |'tasting'|'pen'|'close'|'search'|'heart'|'heart-filled';

const frame={viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,focusable:'false' as const,'aria-hidden':true};

/** Line-art icon set for the app shell, drawn on the same 24px grid so weights stay even across the nav. */
export function AppIcon({kind}:{kind:AppIconKey}){
  if(kind==='passport')return <svg {...frame} className="app-icon"><path d="M5 4.25A1.75 1.75 0 0 1 6.75 2.5h11.5a1.25 1.25 0 0 1 1.25 1.25v15.5a1.25 1.25 0 0 1-1.25 1.25H6.75A1.75 1.75 0 0 1 5 18.75Z"/><path d="M5 18.75A1.75 1.75 0 0 1 6.75 17h12.75"/><circle cx="12.3" cy="8.6" r="2.6"/><path d="M9.8 13.4h5"/></svg>;
  if(kind==='journal')return <svg {...frame} className="app-icon"><path d="M4 5.25A2.25 2.25 0 0 1 6.25 3H19a1 1 0 0 1 1 1v14.5a1 1 0 0 1-1 1H6.25A2.25 2.25 0 0 0 4 21.75Z"/><path d="M4 5.25v16.5"/><path d="M8.5 7.75h7.5M8.5 11h7.5M8.5 14.25h4.5"/></svg>;
  if(kind==='producers')return <svg {...frame} className="app-icon"><path d="M2.75 20.75h18.5"/><path d="M5 20.75V9.9L12 4.5l7 5.4v10.85"/><path d="M9.6 20.75V15.4h4.8v5.35"/><path d="M8.4 11.6h7.2"/></svg>;
  if(kind==='insights')return <svg {...frame} className="app-icon"><path d="M3.5 3.5v16a1 1 0 0 0 1 1h16"/><path d="M8 17v-4M12.4 17v-7.5M16.8 17v-3"/><path d="M7 8.6 11.4 5l3.4 2.6L20 3.4"/></svg>;
  // Scan: viewfinder corners around the app's own wine-glass mark.
  if(kind==='scan')return <svg {...frame} className="app-icon"><path d="M3 8.4V5.9A2.9 2.9 0 0 1 5.9 3h2.5M15.6 3h2.5A2.9 2.9 0 0 1 21 5.9v2.5M21 15.6v2.5a2.9 2.9 0 0 1-2.9 2.9h-2.5M8.4 21H5.9A2.9 2.9 0 0 1 3 18.1v-2.5"/><path d="M9.15 8.5h5.7l-.5 2.85a2.6 2.6 0 0 1-5.13 0Z"/><path d="M12 14.1v2.35M10.15 16.45h3.7"/></svg>;
  if(kind==='single-wine')return <svg {...frame} className="app-icon"><path d="M9.6 2.75h4.8v4.16c0 1.1.34 1.72 1.2 2.62 1.06 1.12 1.5 2.1 1.5 3.55v7.42a.75.75 0 0 1-.75.75H7.65a.75.75 0 0 1-.75-.75v-7.42c0-1.45.44-2.43 1.5-3.55.86-.9 1.2-1.52 1.2-2.62Z"/><path d="M6.9 13.4h10.2M6.9 17.5h10.2"/></svg>;
  // Group photo: a frame around a line-up. Bottles are drawn as weighted strokes rather than
  // outlines, which stay legible where a 2px-wide outlined shape would fill in.
  if(kind==='group-photo')return <svg {...frame} className="app-icon"><rect x="2.5" y="4.5" width="19" height="15" rx="2.6"/><path strokeWidth={2.4} d="M7.5 16.3v-4.4M12 16.3v-5.5M16.5 16.3v-3.6"/><path strokeWidth={1} d="M7.5 11v-1.9M12 9.9V8M16.5 12.7v-1.9"/></svg>;
  if(kind==='batch-scan')return <svg {...frame} className="app-icon"><rect x="3" y="3" width="7.4" height="7.4" rx="2"/><rect x="13.6" y="3" width="7.4" height="7.4" rx="2"/><rect x="3" y="13.6" width="7.4" height="7.4" rx="2"/><circle cx="17.3" cy="17.3" r="3.7"/><path d="M17.3 15.4v2l1.4.9"/></svg>;
  if(kind==='search')return <svg {...frame} className="app-icon"><circle cx="10.6" cy="10.6" r="6.35"/><path d="m15.4 15.4 5 5"/></svg>;
  if(kind==='heart'||kind==='heart-filled')return <svg {...frame} className="app-icon" fill={kind==='heart-filled'?'currentColor':'none'}><path d="M12 20.3c-.33 0-.65-.11-.92-.32C7.5 17.1 3.4 13.6 3.4 9.6A4.6 4.6 0 0 1 12 7.1a4.6 4.6 0 0 1 8.6 2.5c0 4-4.1 7.5-7.68 10.38-.27.21-.59.32-.92.32Z"/></svg>;
  // Tasting: two glasses tilted towards each other - an evening rather than a bottle.
  if(kind==='tasting')return <svg {...frame} className="app-icon"><path d="M4.1 3.4h6.2l-.9 4.65a2.35 2.35 0 0 1-4.6 0Z"/><path d="M7.2 11.15v6.9M5.35 18.05h3.7"/><path d="M13.7 6.15h6.2l-.9 4.65a2.35 2.35 0 0 1-4.6 0Z"/><path d="M16.8 13.9v6.7M14.95 20.6h3.7"/></svg>;
  if(kind==='pen')return <svg {...frame} className="app-icon"><path d="M4 20h4.2l9.6-9.6a2.4 2.4 0 0 0-3.4-3.4L4.8 16.6Z"/><path d="M13.8 8.2l3.4 3.4"/><path d="M4 20l1-4"/></svg>;
  return <svg {...frame} className="app-icon"><path d="M6.6 6.6l10.8 10.8M17.4 6.6 6.6 17.4"/></svg>;
}
