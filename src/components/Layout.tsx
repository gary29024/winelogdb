import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import '../scanSheet.css';
import '../mobileViewport.css';

const MOBILE_BROWSER_BOTTOM_VAR='--mobile-browser-bottom';
const preloadUpload=()=>void import('../features/uploads/UploadPage');
const preloadBatchScan=()=>void import('../features/uploads/BatchScanPage');
const preloadWineForm=()=>void import('../features/wines/WineForm');
const preloadProducers=()=>void import('../features/producers/ProducersPage');
const preloadPassport=()=>void import('../features/journey/PassportPage');
const preloadInsights=()=>void import('../features/journey/InsightsPage');

export function Layout(){
  const [scanSheetOpen,setScanSheetOpen]=useState(false);
  const scanInput=useRef<HTMLInputElement>(null);
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

  function startScan(files:FileList|null){
    if(!files?.length)return;
    const scanFiles=Array.from(files);
    setScanSheetOpen(false);
    navigate('/upload',{state:{scanFiles}});
    if(scanInput.current)scanInput.current.value='';
  }

  function openScanSheet(){preloadUpload();setScanSheetOpen(true)}
  function closeScanSheet(){setScanSheetOpen(false)}

  return <>
    <header className="topbar">
      <NavLink className="brand" to="/">WineLog</NavLink>
      <nav className="desktop-nav" aria-label="Main navigation"><NavLink to="/" end>Journal</NavLink><NavLink to="/producers" onPointerEnter={preloadProducers} onFocus={preloadProducers}>Producers</NavLink><NavLink to="/passport" onPointerEnter={preloadPassport} onFocus={preloadPassport}>Passport</NavLink><NavLink to="/insights" onPointerEnter={preloadInsights} onFocus={preloadInsights}>Insights</NavLink><button type="button" className="top-scan-trigger" onClick={openScanSheet}>Scan Wine</button></nav>
    </header>
    <main><Outlet/></main>
    <footer>Your private tasting notebook</footer>

    <nav className="mobile-nav" aria-label="Mobile navigation">
      <NavLink to="/" end><span className="nav-icon">▦</span><span>Journal</span></NavLink>
      <NavLink to="/passport" onPointerDown={preloadPassport} onFocus={preloadPassport}><span className="nav-icon">◇</span><span>Passport</span></NavLink>
      <button type="button" className="scan-nav" onClick={openScanSheet} aria-haspopup="dialog"><span className="scan-plus">＋</span><span>Scan Wine</span></button>
      <NavLink to="/insights" onPointerDown={preloadInsights} onFocus={preloadInsights}><span className="nav-icon">⌁</span><span>Insights</span></NavLink>
      <NavLink to="/producers" onPointerDown={preloadProducers} onFocus={preloadProducers}><span className="nav-icon">◫</span><span>Producers</span></NavLink>
    </nav>

    {scanSheetOpen&&<div className="scan-sheet-backdrop" onClick={closeScanSheet}>
      <section className="scan-sheet" role="dialog" aria-modal="true" aria-labelledby="scan-sheet-title" onClick={e=>e.stopPropagation()}>
        <div className="scan-sheet-header"><div><p className="eyebrow">NEW TASTING</p><h2 id="scan-sheet-title">Add wine</h2></div><button type="button" className="sheet-close" onClick={closeScanSheet} aria-label="Close">×</button></div>
        <button type="button" className="scan-sheet-action" onPointerDown={preloadUpload} onClick={()=>scanInput.current?.click()}><span className="sheet-action-icon">⌁</span><span><strong>Scan one wine</strong><small>Fast interactive recognition</small></span></button>
        <button type="button" className="scan-sheet-action" onPointerDown={preloadBatchScan} onClick={()=>{closeScanSheet();navigate('/batch-scan')}}><span className="sheet-action-icon">▦</span><span><strong>Batch Scan</strong><small>Several wines · asynchronous lower-cost Gemini Batch API</small></span></button>
        <p className="scan-sheet-note">For one bottle, select its front, back and additional labels together. In Batch Scan, each bottle gets its own section and remains a separate recognition request.</p>
        <button type="button" className="sheet-manual" onPointerDown={preloadWineForm} onClick={()=>{closeScanSheet();navigate('/wines/new')}}>Add manually instead</button>
      </section>
    </div>}
    <input ref={scanInput} className="visually-hidden" type="file" accept="image/*" multiple onChange={e=>startScan(e.target.files)}/>
  </>
}
