import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { ToastHost } from './ToastHost';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppIcon } from './AppIcons';
import { AccountChip } from './AccountChip';
import { LiveTastingStrip } from '../features/tastings/LiveTastingStrip';
import { TourOverlay } from '../features/onboarding/TourOverlay';
import { StartTastingSheet } from '../features/tastings/StartTastingSheet';
import { useActiveTasting } from '../features/tastings/useActiveTasting';
import '../scanSheet.css';
import '../moreSheet.css';
import '../mobileViewport.css';
import { CreditConfirmation } from '../features/auth/CreditConfirmation';
import '../multiUser.css';

const MOBILE_BROWSER_BOTTOM_VAR='--mobile-browser-bottom';
const preloadUpload=()=>void import('../features/uploads/UploadPage');
const preloadGroupScan=()=>void import('../features/uploads/GroupScanPage');
const preloadBatchScan=()=>void import('../features/uploads/BatchScanPage');
const preloadWineForm=()=>void import('../features/wines/WineForm');
const preloadJournal=()=>void import('../features/wines/LibraryPage');
const preloadProducers=()=>void import('../features/producers/ProducersPage');
const preloadPassport=()=>void import('../features/journey/PassportPage');
const preloadVintages=()=>void import('../features/vintages/VintagesPage');
const preloadTastings=()=>void import('../features/tastings/TastingDetailPage');
const preloadTastingList=()=>void import('../features/tastings/TastingsPage');
const preloadAchievements=()=>void import('../features/achievements/AchievementsPage');

// The places a phone reaches through More rather than a tab of their own.
const MORE_PATHS=['/tastings','/vintages','/achievements'];

export function Layout(){
  // One sheet at a time: the ways to add a wine, or the places that have no tab on a phone.
  const [openSheet,setOpenSheet]=useState<'scan'|'more'|null>(null);
  const scanSheetOpen=openSheet==='scan',moreSheetOpen=openSheet==='more';
  const [startTastingOpen,setStartTastingOpen]=useState(false);
  // Destructured under another name so the class template below cannot emit a
  // bare `tasting` token: the button-tier and selector guards read those
  // templates as the set of classes a <button> can carry.
  const {tasting:liveTasting}=useActiveTasting();
  const sheet=useRef<HTMLElement>(null);
  const scanTrigger=useRef<HTMLButtonElement>(null);
  const moreTrigger=useRef<HTMLButtonElement>(null);
  const location=useLocation();
  const inMore=MORE_PATHS.some(path=>location.pathname.startsWith(path))||(location.pathname==='/journal'&&new URLSearchParams(location.search).get('scope')==='cellar');
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

  const closeScanSheet=useCallback(()=>setOpenSheet(null),[]);

  // While the sheet is up: lock the page behind it, close on Escape, and hand focus to the sheet.
  useEffect(()=>{
    if(!openSheet)return;
    const opener=openSheet==='more'?moreTrigger.current:scanTrigger.current;
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
  },[openSheet,closeScanSheet]);


  function openScanSheet(event:MouseEvent<HTMLButtonElement>){
    // A click synthesised from Enter or Space reports detail 0; a real tap or
    // mouse press reports 1 or more. Returning focus to the trigger on close is
    // the dialog pattern, but for someone who tapped it only produces a focus
    // ring around the nav item they just used, so it is kept for the people it
    // is actually for.
    usedKeyboard.current=event.detail===0;
    preloadUpload();preloadGroupScan();setOpenSheet('scan')
  }
  function openMoreSheet(event:MouseEvent<HTMLButtonElement>){
    usedKeyboard.current=event.detail===0;
    preloadTastingList();setOpenSheet('more')
  }
  function goFromSheet(path:string){closeScanSheet();navigate(path)}
  // With an evening already running this button opens it rather than starting a
  // second one - the server allows only one open tasting at a time anyway.
  function tastingFromSheet(){
    closeScanSheet();
    if(liveTasting)navigate(`/tastings/${liveTasting.id}`);else setStartTastingOpen(true);
  }

  return <>
    {/* Brand, then navigation, then the account and the one action. The account
        link used to sit between the brand and the nav, which put a destination
        nobody visits daily in the middle of the ones they do. */}
    <header className="topbar">
      <NavLink className="brand" to="/">WineLog</NavLink>
      <nav className="desktop-nav" aria-label="Main navigation"><NavLink to="/" end data-tour="nav-passport" onPointerEnter={preloadPassport} onFocus={preloadPassport}>Passport</NavLink><NavLink to="/journal" data-tour="nav-journal" onPointerEnter={preloadJournal} onFocus={preloadJournal}>Journal</NavLink><NavLink to="/tastings" data-tour="nav-tastings" onPointerEnter={preloadTastingList} onFocus={preloadTastingList}>Tastings</NavLink><NavLink to="/producers" data-tour="nav-producers" onPointerEnter={preloadProducers} onFocus={preloadProducers}>Producers</NavLink><NavLink to="/vintages" onPointerEnter={preloadVintages} onFocus={preloadVintages}>Vintages</NavLink></nav>
      {/* nav-account rides on the chip itself, which renders the link now. */}
      <div className="topbar-end"><AccountChip/><button type="button" className="top-scan-trigger" data-tour="scan-trigger" onClick={openScanSheet}>Scan Wine</button></div>
    </header>
    <main><LiveTastingStrip/><Outlet/></main><CreditConfirmation/><TourOverlay/><ToastHost/>
    <footer>Your private tasting notebook</footer>

    <nav className="mobile-nav" aria-label="Mobile navigation">
      <NavLink to="/" end data-tour="nav-passport" onPointerDown={preloadPassport} onFocus={preloadPassport}><span className="nav-icon"><AppIcon kind="passport"/></span><span className="nav-label">Passport</span></NavLink>
      <NavLink to="/journal" data-tour="nav-journal" onPointerDown={preloadJournal} onFocus={preloadJournal}><span className="nav-icon"><AppIcon kind="journal"/></span><span className="nav-label">Journal</span></NavLink>
      <button ref={scanTrigger} type="button" className="scan-nav" data-tour="scan-trigger" onClick={openScanSheet} aria-haspopup="dialog" aria-expanded={scanSheetOpen}><span className="scan-plus"><AppIcon kind="scan"/></span><span className="nav-label">Scan Wine</span></button>
      <NavLink to="/producers" data-tour="nav-producers" onPointerDown={preloadProducers} onFocus={preloadProducers}><span className="nav-icon"><AppIcon kind="producers"/></span><span className="nav-label">Producers</span></NavLink>
      {/* Tastings, Vintages, the cellar and Achievements share one tab: five slots
          are all a phone has. The tour's Tastings step rings this tab on a phone. */}
      <button ref={moreTrigger} type="button" className={`more-nav${inMore?' is-current':''}`} data-tour="nav-tastings" onClick={openMoreSheet} aria-haspopup="dialog" aria-expanded={moreSheetOpen}><span className="nav-icon"><AppIcon kind="more"/></span><span className="nav-label">More</span></button>
    </nav>

    {scanSheetOpen&&<div className="scan-sheet-backdrop" onClick={closeScanSheet}>
      <section ref={sheet} tabIndex={-1} className="scan-sheet" role="dialog" aria-modal="true" aria-labelledby="scan-sheet-title" onClick={e=>e.stopPropagation()}>
        <span className="sheet-grabber" aria-hidden="true"/>
        <div className="scan-sheet-header"><div>{/* "NEW TASTING" until the sheet grew a Start Tasting action, which meant
            something else entirely and made the heading read as its label. */}
        <p className="eyebrow">ADD TO WINELOG</p><h2 id="scan-sheet-title">Add wine</h2></div><button type="button" className="sheet-close" onClick={closeScanSheet} aria-label="Close"><AppIcon kind="close"/></button></div>
        {/* One obvious way in, for the thing people do most. The rest are choices beneath it,
            each explained on its own row rather than in a paragraph underneath. */}
        <button type="button" className="scan-sheet-action scan-sheet-primary" onPointerDown={preloadUpload} onClick={()=>goFromSheet('/upload')}><span className="sheet-action-icon"><AppIcon kind="single-wine"/></span><span><strong>Single Wine</strong><small>Photograph one bottle. Add more views of it if you like.</small></span><span className="sheet-action-go" aria-hidden="true"><AppIcon kind="chevron-right"/></span></button>
        <p className="scan-sheet-divider">Other ways to add</p>
        <div className="scan-sheet-options">
          <button type="button" className="scan-sheet-option" onPointerDown={preloadGroupScan} onClick={()=>goFromSheet('/group-scan')}><span className="sheet-option-icon"><AppIcon kind="group-photo"/></span><span><strong>Group Photo</strong><small>One photo of a lineup, split into separate wines</small></span></button>
          <button type="button" className="scan-sheet-option" onPointerDown={preloadBatchScan} onClick={()=>goFromSheet('/batch-scan')}><span className="sheet-option-icon"><AppIcon kind="batch-scan"/></span><span><strong>Batch Scan</strong><small>Many bottles photographed one by one, read in the background</small></span></button>
          <button type="button" className={`scan-sheet-option${liveTasting?' is-live':''}`} onPointerDown={preloadTastings} onClick={tastingFromSheet}><span className="sheet-option-icon"><AppIcon kind="tasting"/></span><span><strong>{liveTasting?'Tasting in progress':'Start Tasting'}</strong><small>{liveTasting?liveTasting.name:'Open an evening that every wine you log then joins'}</small></span></button>
          <button type="button" className="scan-sheet-option" onPointerDown={preloadWineForm} onClick={()=>goFromSheet('/wines/new')}><span className="sheet-option-icon"><AppIcon kind="pen"/></span><span><strong>Add manually instead</strong><small>Type the wine in yourself, no photo needed</small></span></button>
        </div>
      </section>
    </div>}

    {moreSheetOpen&&<div className="scan-sheet-backdrop" onClick={closeScanSheet}>
      <section ref={sheet} tabIndex={-1} className="scan-sheet more-sheet" role="dialog" aria-modal="true" aria-labelledby="more-sheet-title" onClick={e=>e.stopPropagation()}>
        <span className="sheet-grabber" aria-hidden="true"/>
        <div className="scan-sheet-header"><div><p className="eyebrow">ALSO IN WINELOG</p><h2 id="more-sheet-title">More</h2></div><button type="button" className="sheet-close" onClick={closeScanSheet} aria-label="Close"><AppIcon kind="close"/></button></div>
        <nav className="more-sheet-links" aria-label="More places">
          <NavLink to="/tastings" onClick={closeScanSheet} onPointerDown={preloadTastingList}><span className="sheet-option-icon"><AppIcon kind="tasting"/></span><span><strong>Tastings</strong><small>Evenings you have logged, newest first</small></span></NavLink>
          <NavLink to="/vintages" onClick={closeScanSheet} onPointerDown={preloadVintages}><span className="sheet-option-icon"><AppIcon kind="vintages"/></span><span><strong>Vintages</strong><small>Each season, village by village</small></span></NavLink>
          <NavLink to="/journal?scope=cellar" onClick={closeScanSheet} onPointerDown={preloadJournal} className={()=>location.pathname==='/journal'&&inMore?'active':''}><span className="sheet-option-icon"><AppIcon kind="cellar"/></span><span><strong>Cellar</strong><small>Bottles you own and have not opened</small></span></NavLink>
          <NavLink to="/achievements" onClick={closeScanSheet} onPointerDown={preloadAchievements}><span className="sheet-option-icon"><AppIcon kind="achievements"/></span><span><strong>Achievements</strong><small>Stamps and collections you have earned</small></span></NavLink>
        </nav>
      </section>
    </div>}

    {startTastingOpen&&<StartTastingSheet onClose={()=>setStartTastingOpen(false)} onStarted={started=>{setStartTastingOpen(false);navigate(`/tastings/${started.id}`)}}/>}
  </>
}
