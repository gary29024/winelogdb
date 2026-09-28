// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import type {Map as MapLibreMap} from 'maplibre-gl';
import {GrandCruParcels,type Parcels} from '../../src/features/vineyards/GrandCruParcels';
import {ownerName,possibleOwnerMatch} from '../../src/lib/places/echezeauxParcelOwners';
import manifest from '../../src/lib/places/echezeauxParcelManifest.json';

const data=JSON.parse(readFileSync('public'+manifest.dataUrl,'utf8')) as Parcels;
function mapStub(){
 const layers=new Set<string>(),sources=new Set<string>();
 return {getStyle:vi.fn(()=>({})),getLayer:vi.fn(id=>layers.has(id)),getSource:vi.fn(id=>sources.has(id)),
  addLayer:vi.fn(l=>layers.add(l.id)),addSource:vi.fn(id=>sources.add(id)),setFilter:vi.fn(),on:vi.fn(),off:vi.fn(),
  removeLayer:vi.fn(id=>layers.delete(id)),removeSource:vi.fn(id=>sources.delete(id)),fitBounds:vi.fn()};
}
const inEchezeaux=(f:Parcels['features'][number])=>f.properties.overlaps.some(o=>o.parentFeatureId==='inao-denom-565');
const holds=(f:Parcels['features'][number],name:string)=>f.properties.recordedRights.some(r=>r.name===name);
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
describe('Cadastral parcel controls',()=>{
 it('downloads only on request, keeps record details folded, preserves both rights and cleans up the overlay',async()=>{
  const sample=structuredClone(data),feature=sample.features.find(f=>f.properties.recordedRights.length&&inEchezeaux(f))!;
  const holder=feature.properties.recordedRights[0];
  const holdings=sample.features.filter(f=>inEchezeaux(f)&&f.properties.recordedRights.some(r=>r.holderId===holder.holderId));
  const expectedArea=holdings.reduce((sum,f)=>sum+f.properties.overlaps.find(o=>o.parentFeatureId==='inao-denom-565')!.areaM2,0);
  feature.properties.recordedRights.push({...feature.properties.recordedRights[0],rightCode:'N',rightLabel:'Nu-propriétaire'});
  const fetcher=vi.fn(async()=>Response.json(sample));vi.stubGlobal('fetch',fetcher);
  const map=mapStub();const view=render(<GrandCruParcels map={map as unknown as MapLibreMap} parentId="inao-denom-565"/>);
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('switch',{name:/Parcel rights/}));
  await screen.findByText('Recorded right holders by mapped area');
  expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/% of the parcel area has recorded rights/);
  expect(screen.getByRole('button',{name:/Domaine de la Romanee Conti/})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:/Show all .* right holders/}));
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
 it('shows a verified producer link, and name-only matches only on request',async()=>{
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
  expect(onLegend).toHaveBeenLastCalledWith(['recorded','unrecorded','verified']);
  const toggle=screen.getByLabelText(/Show possible matches for Mongeard-Mugneret/) as unknown as HTMLInputElement;
  expect(toggle.checked).toBe(false);
  expect(screen.queryByText('Possible match · name only')).toBeNull();
  fireEvent.click(toggle);
  expect(screen.getByText('Possible match · name only')).toBeTruthy();
  const possibleCard=document.querySelector('.village-map-producer.is-possible')! as HTMLElement;
  expect(within(possibleCard).getByText('GFA Mongeard Mugneret et Fils')).toBeTruthy();
  // The verified right holder is never repeated as a mere possibility.
  expect(within(possibleCard).queryByText('Domaine Mongeard Mugneret')).toBeNull();
  expect(onLegend).toHaveBeenLastCalledWith(['recorded','unrecorded','verified','possible']);
 });
 it('keeps each parcel’s dated operator evidence when a right holder is selected, with unverified parcels still distinct',async()=>{
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
  fireEvent.click(screen.getByRole('button',{name:/Domaine de la Romanee Conti/}));
  fireEvent.change(screen.getByLabelText('Cadastral parcel'),{target:{value:linked[1].properties.id}});
  expect(screen.getByRole('link',{name:'Evidence for parcel 1'}).getAttribute('href')).toBe('https://example.test/parcel-1');
  expect(screen.queryByRole('link',{name:'Evidence for parcel 0'})).toBeNull();
  expect(screen.getByText(/Verified operator · effective 2025-01-01/)).toBeTruthy();
  fireEvent.click(screen.getByLabelText(/Show possible matches/));
  const card=within(document.querySelector('.village-map-producer.is-possible')! as HTMLElement);
  expect(card.getByText('Domaine de la Romanee Conti')).toBeTruthy();
  expect(card.getByText(new RegExp(`^${linked.length-2} parcels? ·`))).toBeTruthy();
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
