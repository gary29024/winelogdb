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
      <nav className="desktop-nav" aria-label="Main navigation"><NavLink to="/">Journal</NavLink><button type="button" className="top-scan-trigger" onClick={openScanSheet}>Scan Wine</button></nav>
    </header>
    <main><Outlet/></main>
    <footer>Your private tasting notebook</footer>

    <nav className="mobile-nav" aria-label="Mobile navigation">
      <NavLink to="/" end><span className="nav-icon">▦</span><span>Journal</span></NavLink>
      <button type="button" className="scan-nav" onClick={openScanSheet} aria-haspopup="dialog"><span className="scan-plus">＋</span><span>Scan Wine</span></button>
    </nav>

    {scanSheetOpen&&<div className="scan-sheet-backdrop" onClick={closeScanSheet}>
      <section className="scan-sheet" role="dialog" aria-modal="true" aria-labelledby="scan-sheet-title" onClick={e=>e.stopPropagation()}>
        <div className="scan-sheet-header"><div><p className="eyebrow">NEW TASTING</p><h2 id="scan-sheet-title">Add a wine</h2></div><button type="button" className="sheet-close" onClick={closeScanSheet} aria-label="Close">×</button></div>
        <button type="button" className="scan-sheet-action" onClick={()=>scanInput.current?.click()}><span className="sheet-action-icon">⌁</span><span><strong>Scan Wine</strong><small>Camera, photo library or files</small></span></button>
        <p className="scan-sheet-note">For one bottle, select the front label, back label and any additional labels together. WineLog combines them into one identification.</p>
        <button type="button" className="sheet-manual" onClick={()=>{closeScanSheet();navigate('/wines/new')}}>Add manually instead</button>
      </section>
    </div>}
    <input ref={scanInput} className="visually-hidden" type="file" accept="image/*" multiple onChange={e=>startScan(e.target.files)}/>
  </>
}
