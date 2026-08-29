import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { AppIcon } from './AppIcons';
import { LiveTastingStrip } from '../features/tastings/LiveTastingStrip';
import { StartTastingSheet } from '../features/tastings/StartTastingSheet';
import { useActiveTasting } from '../features/tastings/useActiveTasting';
import '../scanSheet.css';
import '../mobileViewport.css';

const MOBILE_BROWSER_BOTTOM_VAR='--mobile-browser-bottom';
const preloadUpload=()=>void import('../features/uploads/UploadPage');
const preloadGroupScan=()=>void import('../features/uploads/GroupScanPage');
const preloadBatchScan=()=>void import('../features/uploads/BatchScanPage');
const preloadWineForm=()=>void import('../features/wines/WineForm');
const preloadJournal=()=>void import('../features/wines/LibraryPage');
const preloadProducers=()=>void import('../features/producers/ProducersPage');
const preloadPassport=()=>void import('../features/journey/PassportPage');
const preloadInsights=()=>void import('../features/journey/InsightsPage');
const preloadTastings=()=>void import('../features/tastings/TastingDetailPage');
const preloadTastingList=()=>void import('../features/tastings/TastingsPage');

export function Layout(){
  const [scanSheetOpen,setScanSheetOpen]=useState(false);
  const [startTastingOpen,setStartTastingOpen]=useState(false);
  // Destructured under another name so the class template below cannot emit a
  // bare `tasting` token: the button-tier and selector guards read those
  // templates as the set of classes a <button> can carry.
  const {tasting:liveTasting}=useActiveTasting();
  const sheet=useRef<HTMLElement>(null);
  const scanTrigger=useRef<HTMLButtonElement>(null);
  const usedKeyboard=useRef(false);
  const navigate=useNavigate();

  useEffect(()=>{
    const viewport=window.visualViewport;
    if(!viewport)return;
    let frame=0,maxVisualHeight=viewport.height;
    const update=()=>{
      window.cancelAnimationFrame(frame);
      frame=window.requestAnimationFrame(()=>{
        maxVisualHeight=Math.max(maxVisualHeight,viewport.height);
        const keyboardLikely=viewport.height<maxVisualHeight*.72;
        const covered=keyboardLikely?0:Math.max(0,Math.min(160,maxVisualHeight-viewport.height-viewport.offsetTop));
        document.documentElement.style.setProperty(MOBILE_BROWSER_BOTTOM_VAR,`${Math.round(covered)}px`);
      });
    };
    const resetForOrientation=()=>{maxVisualHeight=viewport.height;update()};
    update();
    viewport.addEventListener('resize',update);
    viewport.addEventListener('scroll',update);
    window.addEventListener('orientationchange',resetForOrientation);
    return()=>{
      window.cancelAnimationFrame(frame);
      viewport.removeEventListener('resize',update);
      viewport.removeEventListener('scroll',update);
      window.removeEventListener('orientationchange',resetForOrientation);
      document.documentElement.style.removeProperty(MOBILE_BROWSER_BOTTOM_VAR);
    };
  },[]);

  const closeScanSheet=useCallback(()=>setScanSheetOpen(false),[]);

  // While the sheet is up: lock the page behind it, close on Escape, and hand focus to the sheet.
  useEffect(()=>{
    if(!scanSheetOpen)return;
    const opener=scanTrigger.current;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    sheet.current?.focus();
    // Escape means they are on the keyboard now, whatever opened the sheet.
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();usedKeyboard.current=true;closeScanSheet()}};
    document.addEventListener('keydown',onKeyDown);
    return()=>{
      document.removeEventListener('keydown',onKeyDown);
      document.body.style.overflow=previousOverflow;
      if(usedKeyboard.current)opener?.focus();
    };
  },[scanSheetOpen,closeScanSheet]);


  function openScanSheet(event:MouseEvent<HTMLButtonElement>){
    // A click synthesised from Enter or Space reports detail 0; a real tap or
    // mouse press reports 1 or more. Returning focus to the trigger on close is
    // the dialog pattern, but for someone who tapped it only produces a focus
    // ring around the nav item they just used, so it is kept for the people it
    // is actually for.
    usedKeyboard.current=event.detail===0;
    preloadUpload();preloadGroupScan();setScanSheetOpen(true)
  }
  function goFromSheet(path:string){closeScanSheet();navigate(path)}
  // With an evening already running this button opens it rather than starting a
  // second one - the server allows only one open tasting at a time anyway.
  function tastingFromSheet(){
    closeScanSheet();
    if(liveTasting)navigate(`/tastings/${liveTasting.id}`);else setStartTastingOpen(true);
  }

  return <>
    <header className="topbar">
      <NavLink className="brand" to="/">WineLog</NavLink>
      <nav className="desktop-nav" aria-label="Main navigation"><NavLink to="/" end onPointerEnter={preloadPassport} onFocus={preloadPassport}>Passport</NavLink><NavLink to="/journal" onPointerEnter={preloadJournal} onFocus={preloadJournal}>Journal</NavLink><NavLink to="/tastings" onPointerEnter={preloadTastingList} onFocus={preloadTastingList}>Tastings</NavLink><NavLink to="/producers" onPointerEnter={preloadProducers} onFocus={preloadProducers}>Producers</NavLink><NavLink to="/insights" onPointerEnter={preloadInsights} onFocus={preloadInsights}>Insights</NavLink><button type="button" className="top-scan-trigger" onClick={openScanSheet}>Scan Wine</button></nav>
    </header>
    <main><LiveTastingStrip/><Outlet/></main>
    <footer>Your private tasting notebook</footer>

    <nav className="mobile-nav" aria-label="Mobile navigation">
      <NavLink to="/" end onPointerDown={preloadPassport} onFocus={preloadPassport}><span className="nav-icon"><AppIcon kind="passport"/></span><span className="nav-label">Passport</span></NavLink>
      <NavLink to="/journal" onPointerDown={preloadJournal} onFocus={preloadJournal}><span className="nav-icon"><AppIcon kind="journal"/></span><span className="nav-label">Journal</span></NavLink>
      <button ref={scanTrigger} type="button" className="scan-nav" onClick={openScanSheet} aria-haspopup="dialog" aria-expanded={scanSheetOpen}><span className="scan-plus"><AppIcon kind="scan"/></span><span className="nav-label">Scan Wine</span></button>
      <NavLink to="/producers" onPointerDown={preloadProducers} onFocus={preloadProducers}><span className="nav-icon"><AppIcon kind="producers"/></span><span className="nav-label">Producers</span></NavLink>
      <NavLink to="/insights" onPointerDown={preloadInsights} onFocus={preloadInsights}><span className="nav-icon"><AppIcon kind="insights"/></span><span className="nav-label">Insights</span></NavLink>
    </nav>

    {scanSheetOpen&&<div className="scan-sheet-backdrop" onClick={closeScanSheet}>
      <section ref={sheet} tabIndex={-1} className="scan-sheet" role="dialog" aria-modal="true" aria-labelledby="scan-sheet-title" onClick={e=>e.stopPropagation()}>
        <span className="sheet-grabber" aria-hidden="true"/>
        <div className="scan-sheet-header"><div>{/* "NEW TASTING" until the sheet grew a Start Tasting action, which meant
            something else entirely and made the heading read as its label. */}
        <p className="eyebrow">ADD TO WINELOG</p><h2 id="scan-sheet-title">Add wine</h2></div><button type="button" className="sheet-close" onClick={closeScanSheet} aria-label="Close"><AppIcon kind="close"/></button></div>
        <div className="scan-sheet-grid">
          <button type="button" className="scan-sheet-action" onPointerDown={preloadUpload} onClick={()=>goFromSheet('/upload')}><span className="sheet-action-icon"><AppIcon kind="single-wine"/></span><span><strong>Single Wine</strong><small>One bottle</small></span></button>
          <button type="button" className="scan-sheet-action" onPointerDown={preloadGroupScan} onClick={()=>goFromSheet('/group-scan')}><span className="sheet-action-icon"><AppIcon kind="group-photo"/></span><span><strong>Group Photo</strong><small>One lineup shot</small></span></button>
          <button type="button" className="scan-sheet-action" onPointerDown={preloadBatchScan} onClick={()=>goFromSheet('/batch-scan')}><span className="sheet-action-icon"><AppIcon kind="batch-scan"/></span><span><strong>Batch Scan</strong><small>Many wines, in the background</small></span></button>
          <button type="button" className={`scan-sheet-action${liveTasting?' is-live':''}`} onPointerDown={preloadTastings} onClick={tastingFromSheet}><span className="sheet-action-icon"><AppIcon kind="tasting"/></span><span><strong>{liveTasting?'Tasting in progress':'Start Tasting'}</strong><small>{liveTasting?liveTasting.name:'Log an evening together'}</small></span></button>
        </div>
        <p className="scan-sheet-note"><strong>Single Wine</strong> combines several views of one bottle. <strong>Group Photo</strong> splits one lineup photo into distinct wines. <strong>Batch Scan</strong> processes many separately photographed wines in the background. <strong>Start Tasting</strong> opens an evening that every wine you log then joins.</p>
        <button type="button" className="sheet-manual" onPointerDown={preloadWineForm} onClick={()=>goFromSheet('/wines/new')}><span className="sheet-manual-icon"><AppIcon kind="pen"/></span>Add manually instead</button>
      </section>
    </div>}

    {startTastingOpen&&<StartTastingSheet onClose={()=>setStartTastingOpen(false)} onStarted={started=>{setStartTastingOpen(false);navigate(`/tastings/${started.id}`)}}/>}
  </>
}
