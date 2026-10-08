// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import type {Map as MapLibreMap} from 'maplibre-gl';
import {GrandCruParcels,type Parcels} from '../../src/features/vineyards/GrandCruParcels';
import {saveParcelProducerLink} from '../../src/features/vineyards/parcelProducerApi';
import {ownerName,possibleOwnerMatch} from '../../src/lib/places/parcelOwners';
import manifest from '../../src/lib/places/grandCruParcels/flagey-echezeaux.manifest.json';
import vougeotManifest from '../../src/lib/places/grandCruParcels/vougeot.manifest.json';
import gevreyManifest from '../../src/lib/places/grandCruParcels/gevrey-chambertin.manifest.json';
import vosneManifest from '../../src/lib/places/grandCruParcels/vosne-romanee.manifest.json';
import evidence from '../../src/lib/places/grandCruParcels/echezeaux.evidence.json';
vi.mock('../../src/features/vineyards/parcelProducerApi',()=>({listParcelProducerLinks:vi.fn(async()=>({items:[]})),saveParcelProducerLink:vi.fn(),removeParcelProducerLink:vi.fn()}));
const evidenceLoad=vi.hoisted(()=>({fail:false,calls:0}));
vi.mock('../../src/lib/places/grandCruParcels/evidence',async importOriginal=>{
 const real=await importOriginal<typeof import('../../src/lib/places/grandCruParcels/evidence')>();
 return {...real,loadParcelEvidence:(id:string)=>{evidenceLoad.calls++;return evidenceLoad.fail?Promise.reject(new Error('offline')):real.loadParcelEvidence(id)}};
});

const data=JSON.parse(readFileSync('public'+manifest.dataUrl,'utf8')) as Parcels;
function mapStub(){
 const layers=new Set<string>(),sources=new Set<string>();
 return {getStyle:vi.fn(()=>({})),getLayer:vi.fn(id=>layers.has(id)),getSource:vi.fn(id=>sources.has(id)),
  addLayer:vi.fn(l=>layers.add(l.id)),addSource:vi.fn(id=>sources.add(id)),setFilter:vi.fn(),on:vi.fn(),off:vi.fn(),
  removeLayer:vi.fn(id=>layers.delete(id)),removeSource:vi.fn(id=>sources.delete(id)),fitBounds:vi.fn()};
}
const inEchezeaux=(f:Parcels['features'][number])=>f.properties.overlaps.some(o=>o.parentFeatureId==='inao-denom-565');
const holds=(f:Parcels['features'][number],name:string)=>f.properties.recordedRights.some(r=>r.name===name);
afterEach(()=>{cleanup();vi.unstubAllGlobals();evidenceLoad.fail=false;evidenceLoad.calls=0});
describe('Cadastral parcel controls',()=>{
 it('keeps Richebourg’s ten holders and unknown parcels visible when domaine grouping is enabled',async()=>{
  const vosne=JSON.parse(readFileSync('public'+vosneManifest.dataUrl,'utf8')) as Parcels;
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json(vosne)));
  render(<GrandCruParcels map={mapStub() as unknown as MapLibreMap} parentId="inao-denom-1083"/>);
  fireEvent.click(screen.getByRole('switch'));
  const holders=await screen.findByRole('list',{name:'Recorded right holders by mapped area'});
  // Always grouped by domaine: there is no legal-holder switch.
  expect(screen.queryByLabelText('Group right holders by')).toBeNull();
  const expand=screen.queryByRole('button',{name:/Show all .* entries/});
  if(expand)fireEvent.click(expand);
  // Domaine research loads after the parcels; wait for its headings.
  expect(await within(holders).findByRole('button',{name:/Domaine de la Romanée-Conti.*Company record/})).toBeTruthy();
  expect(within(holders).getByRole('button',{name:/GFA Heritiers AF-Gros/i})).toBeTruthy();
  expect(within(holders).queryByRole('button',{name:/^Domaine A\.-F\. Gros/})).toBeNull();
  expect(within(holders).getByRole('button',{name:/identity by name and seat only/})).toBeTruthy();
  // One line per name: no company names or per-row source links; strength shows as a seal check, with a key.
  const drc=within(holders).getByRole('button',{name:/^Domaine de la Romanée-Conti/});
  expect(drc.textContent).not.toMatch(/DOMAINE DE LA ROMANEE CONTI|Domaine de la Romanee Conti/);
  expect(drc.querySelector('.village-map-seal.is-strong')).toBeTruthy();
  // The reason is only in the seal’s tooltip and accessible name, not printed in the row.
  const seal=within(drc).getByRole('img');
  expect(seal.getAttribute('aria-label')).toMatch(/^Company record/);
  expect(seal.getAttribute('title')).toBe(seal.getAttribute('aria-label'));
  expect(drc.textContent).not.toMatch(/Company record/);
  fireEvent.click(drc);
  expect(drc.getAttribute('aria-pressed')).toBe('true');
  expect(within(holders).queryAllByRole('link')).toHaveLength(0);
  const key=screen.getByText('Link strength').parentElement!;
  expect([...key.querySelectorAll('.village-map-seal-key-item')].map(b=>b.textContent)).toEqual(['Company record','Weak lead']);
  expect(key.querySelector('.village-map-seal.is-weak')).toBeTruthy();
  // The longer explanation lives under About this data; the list keeps one line and the key.
  expect(screen.getByText('Areas show parcel coverage, not ownership shares.')).toBeTruthy();
  expect(screen.queryByText(/Not farming verification/)).toBeNull();
  expect(screen.getByText(/Domaine headings are research links, not proof of ownership/).textContent).toMatch(/groups 10 recorded legal holders into 10 rows.*cited sources for Richebourg.*none is recorded yet/);
  // All ten legal holders keep a row, and a company name found only behind a heading is still searchable.
  expect(screen.getByText('10',{selector:'.village-map-count'})).toBeTruthy();
  expect(within(holders).getAllByRole('button')).toHaveLength(10);
  fireEvent.change(screen.getByRole('searchbox',{name:'Search right holders'}),{target:{value:'Frere et Soeurs'}});
  const [lead]=within(holders).getAllByRole('button');
  expect(within(holders).getAllByRole('button')).toHaveLength(1);
  expect(lead.textContent).toMatch(/^Domaine Méo-Camuzet/);
  expect(lead.querySelector('.village-map-seal.is-weak')).toBeTruthy();
  const parcel=screen.getByLabelText('Cadastral parcel');
  expect((parcel as unknown as HTMLSelectElement).options).toHaveLength(59);
  fireEvent.change(parcel,{target:{value:'21714000AN0292'}});
  expect(screen.getByText('No matched rights record')).toBeTruthy();
  const panel=await screen.findByRole('region',{name:'History and evidence'});
  expect(await within(panel).findByText(/leaves the new owner unnamed/)).toBeTruthy();
  expect(screen.queryByText('Verified parcel links')).toBeNull();
 });
 it('keeps all 69 Vougeot legal holders searchable and groups only company-record links under a domaine',async()=>{
  const vougeot=JSON.parse(readFileSync('public'+vougeotManifest.dataUrl,'utf8')) as Parcels;
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json(vougeot)));
  render(<GrandCruParcels map={mapStub() as unknown as MapLibreMap} parentId="inao-denom-546"/>);
  fireEvent.click(screen.getByRole('switch'));
  const holders=await screen.findByRole('list',{name:'Recorded right holders by mapped area'});
  // Domaine view: a company-record link groups; a lease mandate and a name-only match stay legal-holder rows.
  fireEvent.click(await screen.findByRole('button',{name:/Show all .* entries/}));
  expect(await within(holders).findByRole('button',{name:/Château de la Tour.*Company record/})).toBeTruthy();
  expect(within(holders).getByRole('button',{name:/GFA Misset Cheron/i})).toBeTruthy();
  expect(within(holders).queryByRole('button',{name:/^Domaine du Couvent/})).toBeNull();
  expect(within(holders).getAllByRole('button',{name:/identity by name and seat only/})).toHaveLength(2);
  const rows=Number(screen.getByText(/^\d+$/,{selector:'.village-map-count'}).textContent);
  expect(rows).toBeLessThan(69);
  expect(screen.getByText(/Domaine headings are research links/).textContent).toContain(`groups 69 recorded legal holders into ${rows} rows`);
  // Every legal holder's recorded name still finds its row, whether or not it sits under a domaine heading.
  const search=screen.getByRole('searchbox',{name:'Search right holders'});
  const legal=new Set(vougeot.features.filter(f=>f.properties.overlaps.some(o=>o.parentFeatureId==='inao-denom-546')).flatMap(f=>f.properties.recordedRights.map(r=>r.name)));
  expect(legal.size).toBe(69);
  for(const name of legal){
   fireEvent.change(search,{target:{value:name}});
   expect(within(holders).queryAllByRole('button').length,name).toBeGreaterThan(0);
  }
  const parcel=screen.getByLabelText('Cadastral parcel');
  fireEvent.change(parcel,{target:{value:'217160000A0001'}});
  expect(await within(await screen.findByRole('region',{name:'History and evidence'})).findByText('Application suspended')).toBeTruthy();
  fireEvent.change(parcel,{target:{value:'217160000A0025'}});
  const details=screen.getByRole('heading',{name:'Parcel A 0025'}).closest('.village-map-parcel-details')! as HTMLElement;
  for(const right of vougeot.features.find(f=>f.properties.id==='217160000A0025')!.properties.recordedRights){
   expect(within(details).getByText(`${ownerName(right.name)} · ${right.rightLabel}`)).toBeTruthy();
  }
  const unknown=vougeot.features.find(f=>!f.properties.recordedRights.length)!;
  fireEvent.change(parcel,{target:{value:unknown.properties.id}});
  expect(screen.getByText('No matched rights record')).toBeTruthy();
  expect((parcel as unknown as HTMLSelectElement).options).toHaveLength(165);
  expect(screen.queryByText('Verified parcel links')).toBeNull();
 });
 it('does not download a cru’s research for the holder list when it has no domaine research',async()=>{
  const gevrey=JSON.parse(readFileSync('public'+gevreyManifest.dataUrl,'utf8')) as Parcels;
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json(gevrey)));
  render(<GrandCruParcels map={mapStub() as unknown as MapLibreMap} parentId="inao-denom-447"/>);
  fireEvent.click(screen.getByRole('switch'));
  expect(await screen.findByRole('button',{name:'Show all 33 right holders'})).toBeTruthy();
  expect(evidenceLoad.calls).toBe(0);
 });
 it('never mentions domaine research for a cru that has none, even when its evidence fails to load',async()=>{
  evidenceLoad.fail=true;
  const gevrey=JSON.parse(readFileSync('public'+gevreyManifest.dataUrl,'utf8')) as Parcels;
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json(gevrey)));
  render(<GrandCruParcels map={mapStub() as unknown as MapLibreMap} parentId="inao-denom-447"/>);
  fireEvent.click(screen.getByRole('switch'));
  expect(await screen.findByRole('button',{name:'Show all 33 right holders'})).toBeTruthy();
  await new Promise(resolve=>setTimeout(resolve,0));  // let the rejected evidence load settle
  expect(screen.queryByText(/domaine research/i)).toBeNull();
  expect(screen.queryByRole('button',{name:'Retry domaine research'})).toBeNull();
  expect(screen.queryByLabelText('Group right holders by')).toBeNull();
 });
 it('shows dated evidence only on its exact parcels without promoting it to a farming link',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json(data)));
  const onLegend=vi.fn();
  render(<GrandCruParcels map={mapStub() as unknown as MapLibreMap} parentId="inao-denom-565" producer="Anne Gros" onLegend={onLegend}/>);
  fireEvent.click(screen.getByRole('switch'));
  fireEvent.change(await screen.findByLabelText('Cadastral parcel'),{target:{value:'212670000D0177'}});
  const panel=await screen.findByRole('region',{name:'History and evidence'});
  expect(within(panel).getByText('Application received')).toBeTruthy();
  expect(within(panel).getByText('Previous operator named in notice: Domaine Gros Frère et Sœur')).toBeTruthy();
  expect(screen.getByText('No matched rights record')).toBeTruthy();
  expect(within(panel).getByRole('link',{name:/Official notice/}).getAttribute('href')).toContain('#page=74');
  expect(screen.queryByText('Current farming domaine')).toBeNull();
  expect(screen.queryByText('Verified parcel links')).toBeNull();
  expect(onLegend).toHaveBeenLastCalledWith(['recorded','unrecorded','selected']);
  fireEvent.change(screen.getByLabelText('Cadastral parcel'),{target:{value:'212670000D0168'}});
  await waitFor(()=>expect(screen.queryByText('Application received')).toBeNull());
  expect(within(await screen.findByRole('region',{name:'History and evidence'})).queryByText('Anne Gros')).toBeNull();
  // Every evidenced parcel exists in the mapped snapshot; the unresolved printed D01776 is never attached to one.
  for(const id of Object.keys(evidence.parcels))expect(data.features.some(f=>f.properties.id===id)).toBe(true);
  expect(JSON.stringify(evidence)).not.toMatch(/currentFarmer|D01776/);
 });
 it('gives Grands-Échezeaux the evidence panel and domaine grouping through the cru registry',async()=>{
  const fetcher=vi.fn(async()=>Response.json(data));vi.stubGlobal('fetch',fetcher);
  render(<GrandCruParcels map={mapStub() as unknown as MapLibreMap} parentId="inao-denom-645" producer="Anne Gros"/>);
  expect(screen.getByText('· Grands-Échezeaux')).toBeTruthy();
  fireEvent.click(screen.getByRole('switch'));
  // The same Flagey bundle file serves both crus: one download, filtered to this cru's parcels.
  expect(await screen.findByText(/parcels in Grands-Échezeaux/)).toBeTruthy();
  expect(fetcher).toHaveBeenCalledWith(manifest.dataUrl,expect.anything());
  expect(screen.getByText('32',{selector:'strong'})).toBeTruthy();
  const holders=within(screen.getByRole('list',{name:'Recorded right holders by mapped area'}));
  expect(await holders.findByText('Domaine Anne Gros')).toBeTruthy();
  expect(screen.getByText(/Domaine headings are research links, not proof of ownership/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Cadastral parcel'),{target:{value:'212670000D0093'}});
  const panel=await screen.findByRole('region',{name:'History and evidence'});
  expect(within(panel).getByText('Application received')).toBeTruthy();
  expect(within(panel).getByText('Anne Gros')).toBeTruthy();
  expect(screen.queryByText('Verified parcel links')).toBeNull();
  fireEvent.click(screen.getByText('About this data'));
  expect(screen.getByRole('link',{name:manifest.cadastreLicence}).getAttribute('href')).toBe(manifest.cadastreLicenceUrl);
  expect(screen.getByRole('link',{name:manifest.rightsLicence}).getAttribute('href')).toBe(manifest.rightsLicenceUrl);
 });
 it('renders nothing for a cru without parcel data',()=>{
  const view=render(<GrandCruParcels map={mapStub() as unknown as MapLibreMap} parentId="inao-denom-unknown"/>);
  expect(view.container.innerHTML).toBe('');
 });
 it('downloads only on request, keeps record details folded, preserves both rights and cleans up the overlay',async()=>{
  // A holder without domaine research keeps its own legal-name row.
  const sample=structuredClone(data),feature=sample.features.find(f=>f.properties.recordedRights.length&&inEchezeaux(f)&&!(f.properties.recordedRights[0].holderId in evidence.holderDomains))!;
  const holder=feature.properties.recordedRights[0];
  const holdings=sample.features.filter(f=>inEchezeaux(f)&&f.properties.recordedRights.some(r=>r.holderId===holder.holderId));
  const expectedArea=holdings.reduce((sum,f)=>sum+f.properties.overlaps.find(o=>o.parentFeatureId==='inao-denom-565')!.areaM2,0);
  feature.properties.recordedRights.push({...feature.properties.recordedRights[0],rightCode:'N',rightLabel:'Nu-propriétaire'});
  const fetcher=vi.fn(async()=>Response.json(sample));vi.stubGlobal('fetch',fetcher);
  const map=mapStub();const view=render(<GrandCruParcels map={map as unknown as MapLibreMap} parentId="inao-denom-565"/>);
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('switch',{name:/Parcel rights/}));
  await screen.findByText('Recorded right holders by mapped area');
  expect(screen.getByText(/parcels in Échezeaux · \d+ with recorded rights$/)).toBeTruthy();
  expect(await screen.findByRole('button',{name:/^Domaine de la Romanée-Conti/})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:/Show all .* entries/}));
  const holderRow=within(screen.getByRole('list',{name:'Recorded right holders by mapped area'})).getByRole('button',{name:new RegExp(ownerName(holder.name))});
  expect(holderRow.textContent).toContain(`${(expectedArea/10000).toFixed(2)} ha · ${holdings.length}`);
  expect(screen.getByText(/Legal-entity rights recorded on 1 January 2025/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Cadastral parcel'),{target:{value:feature.properties.id}});
  expect(screen.getByText('Record details')).toBeTruthy();
  expect(screen.getAllByText(/SIREN|DGFiP identifier/)).toHaveLength(2);
  expect(screen.getByText(`${ownerName(holder.name)} · Nu-propriétaire`)).toBeTruthy();
  expect(map.fitBounds).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({maxZoom:17}));
  fireEvent.click(screen.getByRole('switch'));
  expect(screen.queryByText('Recorded right holders by mapped area')).toBeNull();
  expect(map.removeSource).toHaveBeenCalledWith('cadastral-parcels');
  fireEvent.click(screen.getByRole('switch'));
  expect(fetcher).toHaveBeenCalledTimes(1);
  view.unmount();expect(map.off).toHaveBeenCalled();
 });
 it('retries a failed download independently and retains parcels without published rights',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(null,{status:503})).mockResolvedValueOnce(Response.json(data));
  vi.stubGlobal('fetch',fetcher);
  render(<GrandCruParcels map={mapStub() as unknown as MapLibreMap} parentId="inao-denom-565" producer="Domaine Leroy"/>);
  fireEvent.click(screen.getByRole('switch'));
  expect((await screen.findByRole('alert')).textContent).toContain('The cru map remains available');
  fireEvent.click(screen.getByRole('button',{name:'Retry parcels'}));
  const finder=await screen.findByLabelText('Cadastral parcel') as unknown as HTMLSelectElement;
  const unknown=[...finder.options].find(o=>o.textContent?.includes('no matched rights record'))!;
  fireEvent.change(finder,{target:{value:unknown.value}});
  expect(screen.getByText(/doesn’t mean the parcel has no owner/)).toBeTruthy();
  expect(screen.queryByText('THIS WINE’S PRODUCER')).toBeNull();
  expect(screen.queryByLabelText(/Show possible matches/)).toBeNull();
 });
 it('aborts an in-flight request when the layer is hidden',async()=>{
  let signal:AbortSignal|undefined;
  vi.stubGlobal('fetch',vi.fn((_url,options)=>{signal=options.signal;return new Promise(()=>{})}));
  render(<GrandCruParcels map={mapStub() as unknown as MapLibreMap} parentId="inao-denom-565"/>);
  fireEvent.click(screen.getByRole('switch'));
  await waitFor(()=>expect(signal).toBeDefined());
  fireEvent.click(screen.getByRole('switch'));
  expect(signal?.aborted).toBe(true);
 });
 it('shows a verified producer link without a name-only guess',async()=>{
  const sample=structuredClone(data);
  const linked=sample.features.filter(f=>inEchezeaux(f)&&holds(f,'DOMAINE MONGEARD MUGNERET'));
  expect(linked.length).toBeGreaterThan(0);
  for(const f of linked)f.properties.domaineLinks.push({status:'verified',name:'Domaine Mongeard-Mugneret',producerId:'mongeard-mugneret',
   producerNames:['Domaine Mongeard-Mugneret','Mongeard-Mugneret'],role:'operator',effectiveDate:'2025-01-01',evidence:[{url:'https://example.test/evidence',note:'Test evidence'}]});
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json(sample)));
  const onLegend=vi.fn();
  render(<GrandCruParcels map={mapStub() as unknown as MapLibreMap} parentId="inao-denom-565" producer="Mongeard-Mugneret" onLegend={onLegend}/>);
  fireEvent.click(screen.getByRole('switch'));
  await screen.findByText('THIS WINE’S PRODUCER');
  expect(screen.getByText(`${linked.length} parcel${linked.length===1?'':'s'}`,{exact:false})).toBeTruthy();
  // The legend is reported by an effect that can trail the panel text under load.
  await waitFor(()=>expect(onLegend).toHaveBeenLastCalledWith(['recorded','unrecorded','verified']));
  expect(screen.queryByLabelText(/Show possible matches/)).toBeNull();
  expect(screen.queryByText(/Looks like/)).toBeNull();
 });
 it('suggests the producer’s row and links it in one tap, with no blue guess on the map',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json(data)));
  vi.mocked(saveParcelProducerLink).mockImplementation(async(_parent,holderId,producerId)=>({holderId,producerId,producerName:'Domaine Nicole Lamarche',status:'manual',updatedAt:'2026-10-08'}));
  const map=mapStub();
  render(<GrandCruParcels map={map as unknown as MapLibreMap} parentId="inao-denom-565" producer="Domaine Nicole Lamarche" producerId="nicole"/>);
  fireEvent.click(screen.getByRole('switch'));
  const card=await screen.findByRole('region',{name:'This wine’s producer'});
  expect((await within(card).findByText(/Looks like/)).textContent).toBe('Looks like Domaine Nicole Lamarche · 1.10 ha');
  expect(screen.queryByLabelText(/Show possible matches/)).toBeNull();
  expect(map.addLayer.mock.calls.map(([layer])=>layer.id).filter(id=>id.includes('possible'))).toEqual([]);
  fireEvent.click(within(card).getByRole('button',{name:'Link Domaine Nicole Lamarche to Domaine Nicole Lamarche'}));
  expect(await within(card).findByText('Manual link · unverified')).toBeTruthy();
  expect(saveParcelProducerLink).toHaveBeenCalledWith('inao-denom-565','397738634','nicole');
  expect(map.fitBounds).toHaveBeenCalled();
  expect(screen.queryByText('Verified parcel links')).toBeNull();
  fireEvent.change(screen.getByLabelText('Cadastral parcel'),{target:{value:'212670000D0168'}});
  expect(screen.queryByText(/Possible match/)).toBeNull();
 });
 it('keeps each parcel’s dated operator evidence when a right holder is selected',async()=>{
  const sample=structuredClone(data);
  const linked=sample.features.filter(f=>inEchezeaux(f)&&holds(f,'DOMAINE DE LA ROMANEE CONTI'));
  expect(linked.length).toBeGreaterThan(2);
  for(const [i,f] of linked.slice(0,2).entries())f.properties.domaineLinks.push({status:'verified',name:'Domaine de la Romanée Conti',producerId:'drc',
   producerNames:['Domaine de la Romanée Conti'],role:'operator',effectiveDate:`202${i+4}-01-01`,evidence:[{url:`https://example.test/parcel-${i}`,note:`Evidence for parcel ${i}`} ]});
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json(sample)));
  render(<GrandCruParcels map={mapStub() as unknown as MapLibreMap} parentId="inao-denom-565" producer="Domaine de la Romanée Conti"/>);
  fireEvent.click(screen.getByRole('switch'));
  await screen.findByText('THIS WINE’S PRODUCER');
  expect(screen.queryByRole('link',{name:/Evidence for parcel/})).toBeNull();
  fireEvent.click(await screen.findByRole('button',{name:/^Domaine de la Romanée-Conti/}));
  fireEvent.change(screen.getByLabelText('Cadastral parcel'),{target:{value:linked[1].properties.id}});
  expect(screen.getByRole('link',{name:'Evidence for parcel 1'}).getAttribute('href')).toBe('https://example.test/parcel-1');
  expect(screen.queryByRole('link',{name:'Evidence for parcel 0'})).toBeNull();
  expect(screen.getByText(/Verified operator · effective 2025-01-01/)).toBeTruthy();
  // Verified links stand alone: no name-only suggestion for the rest of the holder's parcels.
  expect(screen.queryByText(/Looks like/)).toBeNull();
 });
});
describe('Parcel owner names',()=>{
 it('reads DGFiP names as names without losing legal forms',()=>{
  expect(ownerName('GFA MONGEARD MUGNERET ET FILS')).toBe('GFA Mongeard Mugneret et Fils');
  expect(ownerName('DOMAINE DE LA ROMANEE CONTI')).toBe('Domaine de la Romanee Conti');
  expect(ownerName("DOMAINE D'EUGENIE")).toBe("Domaine d'Eugenie");
 });
 it('suggests an owner only when every distinctive producer word matches',()=>{
  expect(possibleOwnerMatch('Domaine Mongeard-Mugneret','GFA MONGEARD MUGNERET ET FILS')).toBe(true);
  expect(possibleOwnerMatch('Domaine Georges Mugneret-Gibourg','GFA MONGEARD MUGNERET ET FILS')).toBe(false);
  expect(possibleOwnerMatch('Domaine d’Eugénie',"DOMAINE D'EUGENIE")).toBe(true);
  expect(possibleOwnerMatch('Anne Gros','ANNE GROS')).toBe(true);
  expect(possibleOwnerMatch('Domaine Gros','ANNE GROS')).toBe(false);
  expect(possibleOwnerMatch('Domaine','DOMAINE DE LA ROMANEE CONTI')).toBe(false);
 });
});
