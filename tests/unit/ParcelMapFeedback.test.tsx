// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import type {Map as MapLibreMap} from 'maplibre-gl';
import {GrandCruParcels,type Parcels} from '../../src/features/vineyards/GrandCruParcels';
import {listParcelProducerLinks,removeParcelProducerLink,saveParcelProducerLink} from '../../src/features/vineyards/parcelProducerApi';
import {listProducers} from '../../src/features/producers/api';
import manifest from '../../src/lib/places/grandCruParcels/flagey-echezeaux.manifest.json';
vi.mock('../../src/features/vineyards/parcelProducerApi',()=>({listParcelProducerLinks:vi.fn(),saveParcelProducerLink:vi.fn(),removeParcelProducerLink:vi.fn()}));
vi.mock('../../src/features/producers/api',()=>({listProducers:vi.fn()}));
const data=JSON.parse(readFileSync('public'+manifest.dataUrl,'utf8')) as Parcels;
const holder={id:'397738634',name:'NICOLE LAMARCHE'};
const link={holderId:holder.id,producerId:'nicole',producerName:'Domaine Nicole Lamarche',status:'manual' as const,updatedAt:'2026-09-30'};
function mapStub(){
 const layers=new Set<string>(),sources=new Map<string,{setData:(data:unknown)=>void}>();
 let styled:{features:{properties:{id:string;match:string}}[]}={features:[]};
 const setData=(value:unknown)=>{styled=value as typeof styled};
 return {getStyle:vi.fn(()=>({})),getLayer:vi.fn(id=>layers.has(id)),getSource:vi.fn(id=>sources.get(id)),
  addLayer:vi.fn(layer=>layers.add(layer.id)),addSource:vi.fn((id,value)=>{setData(value.data);sources.set(id,{setData})}),
  setFilter:vi.fn(),on:vi.fn(),off:vi.fn(),removeLayer:vi.fn(id=>layers.delete(id)),removeSource:vi.fn(id=>sources.delete(id)),fitBounds:vi.fn(),
  match:(id:string)=>styled.features.find(f=>f.properties.id===id)?.properties.match};
}
beforeEach(()=>{vi.mocked(listParcelProducerLinks).mockResolvedValue({items:[]});vi.stubGlobal('fetch',vi.fn(async()=>Response.json(data)))});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.resetAllMocks()});
describe('PR416 map feedback',()=>{
 it('hides Nicole account links and prevents autofocus on a Millot wine, but preserves the saved link',async()=>{
  vi.mocked(listParcelProducerLinks).mockResolvedValue({items:[link]});
  const map=mapStub();
  const view=render(<GrandCruParcels map={map as unknown as MapLibreMap} parentId="inao-denom-565" producer="Jean-Marc Millot" producerId="millot"/>);
  fireEvent.click(screen.getByRole('switch'));
  await waitFor(()=>expect(listParcelProducerLinks).toHaveBeenCalled());
  const card=await screen.findByRole('region',{name:'This wine’s producer'});
  expect(await within(card).findByText('Not linked to any parcels yet.')).toBeTruthy();
  expect(within(card).queryByText(/Linked to/)).toBeNull();
  expect(map.fitBounds).not.toHaveBeenCalled();
  view.rerender(<GrandCruParcels map={map as unknown as MapLibreMap} parentId="inao-denom-565" producer="Nicole Lamarche" producerId="nicole"/>);
  expect(screen.getByRole('switch')).toHaveProperty('checked',false);
  fireEvent.click(screen.getByRole('switch'));
  expect(await within(await screen.findByRole('region',{name:'This wine’s producer'})).findByText(/Linked to/)).toBeTruthy();
  await waitFor(()=>expect(map.match('212670000D0168')).toBe('owner'));
 });
 it('keeps the saved link’s highlight while a parcel is chosen, with no possible-match switch',async()=>{
  vi.mocked(listParcelProducerLinks).mockResolvedValue({items:[link]});
  const map=mapStub();
  render(<GrandCruParcels map={map as unknown as MapLibreMap} parentId="inao-denom-565" producer="Nicole Lamarche" producerId="nicole"/>);
  fireEvent.click(screen.getByRole('switch'));
  await screen.findByText(/Linked to/);
  await waitFor(()=>expect(map.match('212670000D0168')).toBe('owner'));
  fireEvent.change(screen.getByLabelText('Cadastral parcel'),{target:{value:'212670000D0168'}});
  expect(map.match('212670000D0168')).toBe('owner');
  expect(screen.getByLabelText('Cadastral parcel')).toHaveProperty('value','212670000D0168');
  expect(screen.queryByLabelText(/Show possible matches/)).toBeNull();
  expect(saveParcelProducerLink).not.toHaveBeenCalled();
 });
 it('links any chosen row to the wine’s producer in one tap, and unlinks it from the same place',async()=>{
  vi.mocked(saveParcelProducerLink).mockImplementation(async(_parent,holderId,producerId)=>({...link,holderId,producerId}));
  vi.mocked(removeParcelProducerLink).mockResolvedValue({deleted:true});
  const map=mapStub();
  render(<GrandCruParcels map={map as unknown as MapLibreMap} parentId="inao-denom-565" producer="Nicole Lamarche" producerId="nicole"/>);
  fireEvent.click(screen.getByRole('switch'));
  const list=await screen.findByRole('list',{name:'Recorded right holders by mapped area'});
  const row=await within(list).findByRole('button',{name:/^Domaine Nicole Lamarche/});
  // Nothing to link until a row is chosen; the catalogue is never asked for.
  expect(screen.queryByRole('button',{name:'Link to Nicole Lamarche'})).toBeNull();
  fireEvent.click(row);
  fireEvent.click(within(list).getByRole('button',{name:'Link to Nicole Lamarche'}));
  expect(await within(list).findByText('Linked to Nicole Lamarche')).toBeTruthy();
  expect(saveParcelProducerLink).toHaveBeenCalledWith('inao-denom-565','397738634','nicole');
  expect(listProducers).not.toHaveBeenCalled();
  expect(map.match('212670000D0168')).toBe('owner');
  expect(within(screen.getByRole('region',{name:'This wine’s producer'})).getByText(/Linked to/).textContent).toBe('Linked to Domaine Nicole Lamarche · 1.10 ha');
  fireEvent.click(within(list).getByRole('button',{name:'Unlink'}));
  expect(await within(list).findByRole('button',{name:'Link to Nicole Lamarche'})).toBeTruthy();
  expect(removeParcelProducerLink).toHaveBeenCalledWith('inao-denom-565','397738634');
 });
 it('heads a weak lead with its domaine name as its own row, and keeps tenancy-based research under the legal holder name',async()=>{
  render(<GrandCruParcels map={mapStub() as unknown as MapLibreMap} parentId="inao-denom-565" producer="Jean-Marc Millot"/>);
  fireEvent.click(screen.getByRole('switch'));
  fireEvent.click(await screen.findByRole('button',{name:/Show all \d+ entries/}));
  const list=screen.getByRole('list',{name:'Recorded right holders by mapped area'});
  const office=await within(list).findByRole('button',{name:/^Domaine Méo-Camuzet/});
  // The row stays one name tall: the recorded company name is searchable, not shown.
  expect(office.textContent).not.toMatch(/GFV Grands Crus Investissement/);
  expect(office.textContent).toMatch(/0.45 ha · 3/);
  expect(within(office).getByRole('img',{name:/Weak lead · office address only/})).toBeTruthy();
  expect(office.textContent).not.toMatch(/Weak lead/);
  expect(office.querySelector('.village-map-seal.is-weak')).toBeTruthy();
  fireEvent.change(screen.getByRole('searchbox',{name:'Search right holders'}),{target:{value:'Grands Crus Investissement'}});
  expect(within(list).getAllByRole('button').map(b=>b.textContent)).toEqual([expect.stringMatching(/^Domaine Méo-Camuzet/)]);
  fireEvent.change(screen.getByRole('searchbox',{name:'Search right holders'}),{target:{value:''}});
  expect(within(list).getByRole('button',{name:/SCI les Climats|SCI Les Climats/i}).textContent).not.toMatch(/Marsannay/);
  expect(within(list).queryByRole('button',{name:/^Domaine du Château de Marsannay/})).toBeNull();
 });
 it('groups by sourced domaine names with legal identities searchable, not shown, and keeps highlighting when a parcel opens',async()=>{
  const map=mapStub();
  render(<GrandCruParcels map={map as unknown as MapLibreMap} parentId="inao-denom-565" producer="Jean-Marc Millot"/>);
  fireEvent.click(screen.getByRole('switch'));
  fireEvent.click(await screen.findByRole('button',{name:/Show all \d+ entries/}));
  expect(screen.queryByLabelText('Group right holders by')).toBeNull();
  const list=screen.getByRole('list',{name:'Recorded right holders by mapped area'});
  const faiveley=await within(list).findByRole('button',{name:/Domaine Faiveley/});
  expect(faiveley.textContent).not.toMatch(/Consortium Viticole/);
  expect(within(faiveley).getByRole('img',{name:/^Estate or registry source: Brand identity confirmed/})).toBeTruthy();
  expect(faiveley.querySelector('.village-map-seal.is-medium')).toBeTruthy();
  expect(screen.getByRole('region',{name:'Parcel rights'}).textContent).not.toMatch(/farming unverified|Current farming|tenant/i);
  fireEvent.change(screen.getByPlaceholderText('Search right holders'),{target:{value:'Consortium'}});
  expect(within(list).getByRole('button',{name:/Faiveley/})).toBeTruthy();
  fireEvent.click(faiveley);
  expect(map.match('212670000D0331')).toBe('owner');
  // Sources are described once under About this data, not listed per row.
  expect(within(list).queryAllByRole('link')).toHaveLength(0);
  // The company name behind the heading shows in the parcel's details.
  fireEvent.change(screen.getByLabelText('Cadastral parcel'),{target:{value:'212670000D0331'}});
  expect(map.match('212670000D0331')).toBe('owner');
  const details=document.querySelector('.village-map-parcel-details') as HTMLElement;
  expect(within(details).getByText(/^Consortium Viticole/)).toBeTruthy();
  expect(screen.queryByText('Verified parcel links')).toBeNull();
 });
});
