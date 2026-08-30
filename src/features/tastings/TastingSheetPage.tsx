import { useEffect,useMemo,useRef,useState } from 'react';
import { Link,useParams } from 'react-router-dom';
import { prepareRecognitionImageWithinBytes } from '../uploads/prepareImage';
import { useDocumentUrl } from './useDocumentUrl';
import { createTastingSheetWines,fillTastingSheetPrices,getTasting,parseTastingSheetPage,readTastingDocumentFile,
  uploadTastingDocuments,type SheetMatch,type Tasting,type TastingDocument } from './api';
import '../../tastingSheet.css';

/**
 * Reading the printed wine list.
 *
 * The whole screen is shaped by one fact: a trade tasting list runs to a
 * hundred wines or more. So pages are parsed one at a time with the count
 * showing, the review groups by the sheet's own flight headings, and nothing
 * touches the network per row - two actions at the end write the lot.
 */
const SHEET_TARGET_BYTES=Math.floor(2.5*1024*1024);
const MAX_CONTINUATIONS=2;

type Row=SheetMatch&{key:string;chosenPrice:number|null;selected:boolean};

const rowPrice=(match:SheetMatch)=>match.wine.priceOptions[0]?.amount??null;
/** Ticked by default only where the write is the obvious one. */
const defaultSelected=(match:SheetMatch)=>match.status==='new'?true:!match.hasPrice&&match.wine.priceOptions.length>0;

/** One saved page, shown large enough to tell which page it is before paying to read it. */
function StoredPage({documentId,index,checked,disabled,onToggle}:{documentId:string;index:number;checked:boolean;disabled:boolean;onToggle:()=>void}){
  const src=useDocumentUrl(documentId),alt=`Wine list page ${index+1}`;
  return <li className={`tasting-sheet-stored-page${checked?' is-picked':''}`}>
    <label>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle}/>
      {src?<img src={src} alt={alt}/>:<span className="tasting-document-loading" aria-label={`${alt} loading`}/>}
      <small>Page {index+1}</small>
    </label>
  </li>;
}

export function TastingSheetPage(){
  const {id=''}=useParams();
  const input=useRef<HTMLInputElement>(null);
  const [tasting,setTasting]=useState<Tasting|null>(null),[documents,setDocuments]=useState<TastingDocument[]>([]);
  const [rows,setRows]=useState<Row[]>([]),[currency,setCurrency]=useState('');
  const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [unresolved,setUnresolved]=useState(0),[partial,setPartial]=useState(false);
  /** Photographed and saved, not yet read. Reading is a separate, paid step. */
  const [staged,setStaged]=useState<File[]>([]);
  /** Which saved pages the next read should cover. */
  const [picked,setPicked]=useState<Set<string>>(()=>new Set());
  const [collapsed,setCollapsed]=useState<Set<string>>(()=>new Set());

  useEffect(()=>{
    if(!id)return;
    let active=true;
    getTasting(id).then(detail=>{if(active){
      setTasting(detail.tasting);setDocuments(detail.documents);
      // Arriving at this screen with pages already saved almost always means
      // reading them, so they start ticked and reading is one press.
      setPicked(new Set(detail.documents.map(document=>document.id)));
    }})
      .catch(e=>{if(active)setError((e as Error).message)});
    return()=>{active=false};
  },[id]);

  const matched=rows.filter(row=>row.status==='matched');
  const priceable=rows.filter(row=>row.status==='matched'&&!row.hasPrice&&row.chosenPrice!=null);
  const creatable=rows.filter(row=>row.status==='new');
  const selectedPrices=priceable.filter(row=>row.selected);
  const selectedNew=creatable.filter(row=>row.selected);
  const alreadyPriced=matched.filter(row=>row.status==='matched'&&row.hasPrice).length;

  const sections=useMemo(()=>{
    const groups=new Map<string,Row[]>();
    for(const row of rows){
      const name=row.wine.section?.trim()||'Wines';
      groups.set(name,[...(groups.get(name)??[]),row]);
    }
    return [...groups.entries()];
  },[rows]);

  /** One page in, however many calls its length needs. */
  async function parseOnePage(file:File,label:string){
    const prepared=await prepareRecognitionImageWithinBytes(file,SHEET_TARGET_BYTES);
    const collected:SheetMatch[]=[];
    let afterLine:number|null=null,sheetCurrency='',wasPartial=false,unresolvedHere=0;
    for(let pass=0;pass<=MAX_CONTINUATIONS;pass++){
      const result=await parseTastingSheetPage(id,prepared.file,afterLine);
      collected.push(...result.matches);
      unresolvedHere+=result.unresolvedCount;
      if(result.currency&&!sheetCurrency)sheetCurrency=result.currency;
      setNotice(`${label}: ${collected.length} wine${collected.length===1?'':'s'} read so far…`);
      // A page that says it was cut short is asked again for what came after,
      // rather than being quietly accepted as the whole page.
      if(!result.truncated||!result.resumeAfterLine){wasPartial=false;break}
      afterLine=result.resumeAfterLine;
      wasPartial=pass===MAX_CONTINUATIONS;
    }
    return {matches:collected,currency:sheetCurrency,partial:wasPartial,unresolved:unresolvedHere};
  }

  async function readPages(files:File[]){
    if(!files.length)return;
    setBusy('parse');setError('');setNotice('');
    const collected:SheetMatch[]=[];let sheetCurrency='',anyPartial=false,unresolvedTotal=0;
    try{
      for(const [index,file] of files.entries()){
        const label=`Page ${index+1} of ${files.length}`;
        const page=await parseOnePage(file,label);
        collected.push(...page.matches);
        unresolvedTotal+=page.unresolved;
        if(page.partial)anyPartial=true;
        if(page.currency&&!sheetCurrency)sheetCurrency=page.currency;
        setNotice(`${label} read · ${collected.length} wine${collected.length===1?'':'s'} so far`);
      }
      // Rows the sheet repeats across a page break are one wine, not two.
      const seen=new Set<string>();
      const deduped=collected.filter(match=>{
        const key=`${match.wine.producer.toLowerCase()}::${match.wine.wineName.toLowerCase()}::${match.wine.vintage??'nv'}`;
        if(seen.has(key))return false;
        seen.add(key);return true;
      });
      setRows(deduped.map((match,index)=>({...match,key:`${index}`,chosenPrice:rowPrice(match),selected:defaultSelected(match)})));
      if(sheetCurrency)setCurrency(sheetCurrency);
      setUnresolved(unresolvedTotal);setPartial(anyPartial);
      setNotice(`${deduped.length} wine${deduped.length===1?'':'s'} read from ${files.length} page${files.length===1?'':'s'}.`);
    }catch(e){setError((e as Error).message||'Could not read the wine list')}finally{setBusy('')}
  }

  /**
   * Photographing the sheet saves it. It does not read it.
   *
   * Reported as: the scan fired the moment the photos were chosen. Reading a
   * list is the most expensive single action in the app - one AI call per page,
   * on a sheet that can run to seven of them - and firing it on a file picker
   * means a mis-shot page or a wrong tasting costs money before anyone has
   * looked at the screen. So this stores the paper, which is the half worth
   * having unconditionally, and waits to be told to read it. Same shape as
   * scanning a bottle: choose, then press.
   */
  async function choosePages(files:File[]){
    if(!files.length)return;
    setBusy('save');setError('');setNotice('');
    try{
      const {documents:added}=await uploadTastingDocuments(id,files);
      setDocuments(current=>[...current,...added]);
      setNotice(`${files.length} page${files.length===1?'':'s'} saved to this tasting. Nothing has been read yet.`);
    }catch(e){
      // The photos are still worth reading even if storing them failed, so they
      // are staged either way and the failure is said plainly.
      setError(`Could not store the wine list: ${(e as Error).message}`);
    }finally{setBusy('')}
    setStaged(current=>[...current,...files]);
    if(input.current)input.current.value='';
  }

  async function readStaged(){
    const files=staged;
    if(!files.length)return;
    await readPages(files);
    setStaged([]);setPicked(new Set());
  }

  /** Kept as paper and left unread - no AI call, and the photos stay attached. */
  function keepWithoutReading(){
    const kept=staged.length;
    setStaged([]);setError('');
    setNotice(`${kept} page${kept===1?'':'s'} kept with this tasting. Nothing was read, so nothing was charged.`);
  }

  /**
   * Reading a list that was photographed earlier, off the copy already in R2.
   *
   * Reported as: "in case the list was just saved in the first place but I want
   * to read the prices later on". Storing the paper and reading it are separate
   * steps now, so the second one has to be reachable on its own - and without
   * the paper, which by then is in a bin somewhere. This is what keeping the
   * original in R2 bought.
   *
   * Per page rather than all of them, because each one is an AI call: a sheet
   * read last week and added to this week should cost the new pages only.
   */
  async function readStored(){
    const chosen=documents.filter(document=>picked.has(document.id));
    if(!chosen.length)return;
    setBusy('parse');setError('');
    try{
      const files=await Promise.all(chosen.map((document,index)=>readTastingDocumentFile(document.id,`page-${index+1}.jpg`)));
      await readPages(files);
      // Unticked once read, so a second press cannot quietly pay for the same
      // pages twice. A fresh visit starts them ticked again.
      setPicked(new Set());
    }catch(e){setError((e as Error).message||'Could not read the stored wine list');setBusy('')}
  }

  const toggleStored=(documentId:string)=>setPicked(current=>{
    const next=new Set(current);next.has(documentId)?next.delete(documentId):next.add(documentId);return next;
  });

  // The patch is deliberately narrow rather than Partial<Row>: spreading a
  // partial of a discriminated union widens `status` and loses the narrowing
  // every read of these rows depends on.
  type RowPatch={selected?:boolean;chosenPrice?:number|null};
  function setRow(key:string,patch:RowPatch){setRows(current=>current.map(row=>row.key===key?{...row,...patch}:row))}
  function toggleSection(name:string,rowsIn:Row[],next:boolean){
    const keys=new Set(rowsIn.map(row=>row.key));
    setRows(current=>current.map(row=>keys.has(row.key)?{...row,selected:next}:row));
  }

  async function fillPrices(){
    if(!selectedPrices.length)return;
    if(!/^[A-Za-z]{3}$/.test(currency.trim())){setError('Confirm the sheet’s currency as a three-letter code first, such as HKD.');return}
    if(!confirm(`Fill ${selectedPrices.length} price${selectedPrices.length===1?'':'s'} in ${currency.toUpperCase()}?`))return;
    setBusy('prices');setError('');
    try{
      const result=await fillTastingSheetPrices(id,currency.trim().toUpperCase(),
        selectedPrices.map(row=>({wineId:(row as Extract<Row,{status:'matched'}>).wineId,price:row.chosenPrice as number})));
      setNotice(`${result.filled} price${result.filled===1?'':'s'} filled in.`);
      // Narrowed rather than spread over the union: only a matched row has a
      // price to have been filled, and TypeScript is right to insist.
      setRows(current=>current.map(row=>{
        if(!selectedPrices.some(picked=>picked.key===row.key))return row;
        return row.status==='matched'
          ?{...row,selected:false,hasPrice:true,currentPrice:row.chosenPrice,currentCurrency:currency.trim().toUpperCase()}
          :{...row,selected:false};
      }));
    }catch(e){setError((e as Error).message)}finally{setBusy('')}
  }

  async function addWines(){
    if(!selectedNew.length)return;
    if(!confirm(`Add ${selectedNew.length} wine${selectedNew.length===1?'':'s'} to this tasting?`))return;
    setBusy('wines');setError('');
    try{
      const result=await createTastingSheetWines(id,{
        currency:/^[A-Za-z]{3}$/.test(currency.trim())?currency.trim().toUpperCase():null,
        tastingDate:tasting?.tastingDate??null,venue:tasting?.venue??null,
        wines:selectedNew.map(row=>({
          producer:row.wine.producer,wineName:row.wine.wineName,vintage:row.wine.vintage,
          country:row.wine.country,region:row.wine.region,appellation:row.wine.appellation,
          wineStyle:row.wine.style,grapes:row.wine.grapes,price:row.chosenPrice
        }))
      });
      setNotice(`${result.created} wine${result.created===1?'':'s'} added to this tasting.`);
      setRows(current=>current.filter(row=>!selectedNew.some(picked=>picked.key===row.key)));
    }catch(e){setError((e as Error).message)}finally{setBusy('')}
  }

  const working=Boolean(busy);
  return <article className="tasting-sheet-page">
    <Link className="back-pill" to={`/tastings/${id}`}>← {tasting?.name??'Tasting'}</Link>
    <div className="hero compact"><p className="eyebrow">WINE LIST</p><h1>Read the printed list.</h1>
      <p>Photograph each page of the handout and it is saved to this tasting straight away. Reading it is a separate press: WineLog then reads the wines and their prices, matches them against this tasting, and lets you fill the prices in and add anything missing. Each page read is one AI call, so a long list costs more than a short one — and a list you only wanted to keep costs nothing.</p></div>

    <div className="tasting-sheet-actions">
      <button type="button" className={staged.length?'':'primary'} disabled={working} onClick={()=>input.current?.click()}>{busy==='save'?'Saving…':'Photograph the list'}</button>
      {staged.length>0&&<>
        <button type="button" className="primary" disabled={working} onClick={()=>void readStaged()}>{busy==='parse'?'Reading…':`Read ${staged.length} page${staged.length===1?'':'s'}`}</button>
        <button type="button" disabled={working} onClick={keepWithoutReading}>Just keep them</button>
      </>}
      <input ref={input} className="visually-hidden" type="file" accept="image/*" multiple onChange={event=>void choosePages(Array.from(event.target.files??[]))}/>
    </div>

    {documents.length>0&&staged.length===0&&<section className="tasting-sheet-stored">
      <div className="tasting-sheet-stored-head">
        <h2>Pages already saved</h2>
        <button type="button" className="tasting-sheet-select-all"
          onClick={()=>setPicked(picked.size===documents.length?new Set():new Set(documents.map(document=>document.id)))}>
          {picked.size===documents.length?'None':'All'}
        </button>
      </div>
      <p className="tasting-sheet-stored-note">Read the prices off a list photographed earlier, without the paper. Each page you tick is one AI call.</p>
      <ul className="tasting-sheet-stored-pages">
        {documents.map((document,index)=>
          <StoredPage key={document.id} documentId={document.id} index={index} checked={picked.has(document.id)} disabled={working} onToggle={()=>toggleStored(document.id)}/>)}
      </ul>
      <button type="button" className="primary" disabled={working||!picked.size} onClick={()=>void readStored()}>
        {busy==='parse'?'Reading…':`Read ${picked.size} saved page${picked.size===1?'':'s'}`}
      </button>
    </section>}

    {notice&&<p className="tasting-sheet-notice" role="status">{notice}</p>}
    {error&&<p className="tasting-error" role="alert">{error}</p>}
    {partial&&<p className="tasting-sheet-warning" role="alert">A page listed more wines than could be read in one go, even after continuing. Photograph that page in two halves to catch the rest.</p>}
    {unresolved>0&&<p className="tasting-sheet-warning">{unresolved} line{unresolved===1?'':'s'} could not be read as a wine. Add those by hand rather than guessing.</p>}

    {rows.length>0&&<>
      <div className="tasting-sheet-summary">
        <p className="tasting-sheet-counts"><strong>{matched.length}</strong> already logged · <strong>{creatable.length}</strong> new · <strong>{alreadyPriced}</strong> already priced</p>
        <label className="tasting-sheet-currency">Currency<input type="text" maxLength={3} value={currency} onChange={event=>setCurrency(event.target.value)} placeholder="HKD"/></label>
        <div className="tasting-sheet-buttons">
          <button type="button" className="primary" disabled={working||!selectedPrices.length} onClick={()=>void fillPrices()}>{busy==='prices'?'Filling…':`Fill ${selectedPrices.length} price${selectedPrices.length===1?'':'s'}`}</button>
          <button type="button" disabled={working||!selectedNew.length} onClick={()=>void addWines()}>{busy==='wines'?'Adding…':`Add ${selectedNew.length} wine${selectedNew.length===1?'':'s'}`}</button>
        </div>
      </div>

      {sections.map(([name,sectionRows])=>{
        const open=!collapsed.has(name),allOn=sectionRows.every(row=>row.selected);
        return <section className="tasting-sheet-section" key={name}>
          <div className="tasting-sheet-section-head">
            <button type="button" className="tasting-sheet-toggle" aria-expanded={open} onClick={()=>setCollapsed(current=>{const next=new Set(current);next.has(name)?next.delete(name):next.add(name);return next})}>
              <span aria-hidden="true">{open?'▾':'▸'}</span> {name} <small>{sectionRows.length}</small>
            </button>
            <button type="button" className="tasting-sheet-select-all" onClick={()=>toggleSection(name,sectionRows,!allOn)}>{allOn?'None':'All'}</button>
          </div>
          {open&&<ul className="tasting-sheet-rows">{sectionRows.map(row=>{
            const usable=row.status==='new'||!row.hasPrice;
            return <li key={row.key} className={`tasting-sheet-row${row.status==='new'?' is-new':''}`}>
              <label className="tasting-sheet-pick">
                <input type="checkbox" checked={row.selected} disabled={!usable} onChange={event=>setRow(row.key,{selected:event.target.checked})}/>
                <span className="tasting-sheet-wine">
                  <strong>{row.wine.wineName}</strong>
                  <span>{row.wine.producer}{row.wine.vintage?` · ${row.wine.vintage}`:' · NV'}</span>
                  <small>{row.status==='new'?'Not in this tasting yet':row.hasPrice?`Already logged · already priced${row.currentPrice!=null?` at ${row.currentCurrency??''} ${row.currentPrice}`:''}`:'Already logged'}</small>
                </span>
              </label>
              <div className="tasting-sheet-price">
                {row.wine.priceOptions.length>1
                  ?<select value={String(row.chosenPrice??'')} onChange={event=>setRow(row.key,{chosenPrice:event.target.value?Number(event.target.value):null})} aria-label={`Price for ${row.wine.wineName}`}>
                    {row.wine.priceOptions.map(option=><option key={`${option.amount}-${option.label??''}`} value={option.amount}>{option.label?`${option.label}: `:''}{option.amount}</option>)}
                  </select>
                  :<span>{row.chosenPrice??'—'}</span>}
              </div>
            </li>;
          })}</ul>}
        </section>;
      })}
    </>}
  </article>;
}
