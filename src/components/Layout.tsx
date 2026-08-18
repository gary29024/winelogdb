import { useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import '../scanSheet.css';

export function Layout(){
  const [scanSheetOpen,setScanSheetOpen]=useState(false);
  const scanInput=useRef<HTMLInputElement>(null);
  const navigate=useNavigate();

  function startScan(files:FileList|null){
    if(!files?.length)return;
    const scanFiles=Array.from(files);
    setScanSheetOpen(false);
    navigate('/upload',{state:{scanFiles}});
    if(scanInput.current)scanInput.current.value='';
  }

  function openScanSheet(){setScanSheetOpen(true)}
  function closeScanSheet(){setScanSheetOpen(false)}

  return <>
    <header className="topbar">
      <NavLink className="brand" to="/">WineLog</NavLink>
      <nav className="desktop-nav" aria-label="Main navigation"><NavLink to="/" end>Journal</NavLink><NavLink to="/producers">Producers</NavLink><button type="button" className="top-scan-trigger" onClick={openScanSheet}>Scan Wine</button></nav>
    </header>
    <main><Outlet/></main>
    <footer>Your private tasting notebook</footer>

    <nav className="mobile-nav" aria-label="Mobile navigation">
      <NavLink to="/" end><span className="nav-icon">▦</span><span>Journal</span></NavLink>
      <button type="button" className="scan-nav" onClick={openScanSheet} aria-haspopup="dialog"><span className="scan-plus">＋</span><span>Scan Wine</span></button>
      <NavLink to="/producers"><span className="nav-icon">◫</span><span>Producers</span></NavLink>
    </nav>

    {scanSheetOpen&&<div className="scan-sheet-backdrop" onClick={closeScanSheet}>
      <section className="scan-sheet" role="dialog" aria-modal="true" aria-labelledby="scan-sheet-title" onClick={e=>e.stopPropagation()}>
        <div className="scan-sheet-header"><div><p className="eyebrow">NEW TASTING</p><h2 id="scan-sheet-title">Add wine</h2></div><button type="button" className="sheet-close" onClick={closeScanSheet} aria-label="Close">×</button></div>
        <button type="button" className="scan-sheet-action" onClick={()=>scanInput.current?.click()}><span className="sheet-action-icon">⌁</span><span><strong>Scan one wine</strong><small>Fast interactive recognition</small></span></button>
        <button type="button" className="scan-sheet-action" onClick={()=>{closeScanSheet();navigate('/batch-scan')}}><span className="sheet-action-icon">▦</span><span><strong>Batch Scan</strong><small>Several wines · asynchronous lower-cost Gemini Batch API</small></span></button>
        <p className="scan-sheet-note">For one bottle, select its front, back and additional labels together. In Batch Scan, each bottle gets its own section and remains a separate recognition request.</p>
        <button type="button" className="sheet-manual" onClick={()=>{closeScanSheet();navigate('/wines/new')}}>Add manually instead</button>
      </section>
    </div>}
    <input ref={scanInput} className="visually-hidden" type="file" accept="image/*" multiple onChange={e=>startScan(e.target.files)}/>
  </>
}
