// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import type {Map as MapLibreMap} from 'maplibre-gl';
import {GrandCruParcels,type Parcels} from '../../src/features/vineyards/GrandCruParcels';
import {ParcelProducerLinker} from '../../src/features/vineyards/ParcelProducerLinker';
import {listParcelProducerLinks,saveParcelProducerLink} from '../../src/features/vineyards/parcelProducerApi';
import {listProducers} from '../../src/features/producers/api';
import manifest from '../../src/lib/places/echezeauxParcelManifest.json';
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
  const panel=screen.getByLabelText('Your producer links');
  expect(within(panel).queryByRole('link',{name:'Domaine Nicole Lamarche'})).toBeNull();
  expect(map.fitBounds).not.toHaveBeenCalled();
  view.rerender(<GrandCruParcels map={map as unknown as MapLibreMap} parentId="inao-denom-565" producer="Nicole Lamarche" producerId="nicole"/>);
  expect(screen.getByRole('switch')).toHaveProperty('checked',false);
  fireEvent.click(screen.getByRole('switch'));
  expect(await screen.findByRole('link',{name:'Domaine Nicole Lamarche'})).toBeTruthy();
  await waitFor(()=>expect(map.match('212670000D0168')).toBe('owner'));
 });
 it('keeps the manual highlight and selected parcel while suggestions are switched on and off',async()=>{
  vi.mocked(listParcelProducerLinks).mockResolvedValue({items:[link]});
  const map=mapStub();
  render(<GrandCruParcels map={map as unknown as MapLibreMap} parentId="inao-denom-565" producer="Nicole Lamarche" producerId="nicole"/>);
  fireEvent.click(screen.getByRole('switch'));
  await screen.findByRole('link',{name:'Domaine Nicole Lamarche'});
  await waitFor(()=>expect(map.match('212670000D0168')).toBe('owner'));
  fireEvent.change(screen.getByLabelText('Cadastral parcel'),{target:{value:'212670000D0168'}});
  const toggle=screen.getByLabelText(/Show possible matches/);
  for(let i=0;i<4;i++){
   fireEvent.click(toggle);
   expect(map.match('212670000D0168')).toBe('owner');
   expect(screen.getByLabelText('Cadastral parcel')).toHaveProperty('value','212670000D0168');
  }
  expect(saveParcelProducerLink).not.toHaveBeenCalled();
 });
 it('immediately highlights a newly saved matching link and preserves it when the preview is unchecked',async()=>{
  vi.mocked(listProducers).mockResolvedValue({items:[{id:'nicole',canonicalName:'Domaine Nicole Lamarche',homeCountry:'France',homeRegion:'Burgundy',homeLocality:'Vosne-Romanée',tastedCount:1,catalogCount:1,researchedAt:null}]});
  vi.mocked(saveParcelProducerLink).mockResolvedValue(link);
  const map=mapStub();
  render(<GrandCruParcels map={map as unknown as MapLibreMap} parentId="inao-denom-565" producer="Nicole Lamarche" producerId="nicole"/>);
  fireEvent.click(screen.getByRole('switch'));
  fireEvent.click(await screen.findByLabelText(/Show possible matches/));
  expect(map.match('212670000D0168')).toBe('possible');
  fireEvent.click(screen.getByRole('button',{name:'Link Nicole Lamarche to an app producer'}));
  fireEvent.change(await screen.findByLabelText('App producer'),{target:{value:'nicole'}});
  fireEvent.click(screen.getByRole('button',{name:'Save producer link'}));
  await screen.findByText('Manual link · unverified');
  await waitFor(()=>expect(map.match('212670000D0168')).toBe('owner'));
  fireEvent.click(screen.getByLabelText(/Show possible matches/));
  expect(map.match('212670000D0168')).toBe('owner');
 });
 it('says where a saved link for a different producer went instead of silently hiding it',async()=>{
  vi.mocked(listProducers).mockResolvedValue({items:[{id:'nicole',canonicalName:'Domaine Nicole Lamarche',homeCountry:'France',homeRegion:'Burgundy',homeLocality:'Vosne-Romanée',tastedCount:1,catalogCount:1,researchedAt:null}]});
  vi.mocked(saveParcelProducerLink).mockResolvedValue(link);
  const onShow=vi.fn();
  render(<ParcelProducerLinker parentId="inao-denom-565" producer="Jean-Marc Millot" producerId="millot" holders={[holder]} editing={holder.id} onEdit={vi.fn()} onShow={onShow}/>);
  fireEvent.change(await screen.findByLabelText('App producer'),{target:{value:'nicole'}});
  fireEvent.click(screen.getByRole('button',{name:'Save producer link'}));
  expect(await screen.findByText('Link saved to Domaine Nicole Lamarche. It isn’t shown on this Jean-Marc Millot wine because it names a different producer.')).toBeTruthy();
  expect(screen.queryByRole('link',{name:'Domaine Nicole Lamarche'})).toBeNull();
  expect(onShow).not.toHaveBeenCalled();
 });
 it('heads a weak lead with its domaine name as its own row, and keeps tenancy-based research under the legal holder name',async()=>{
  render(<GrandCruParcels map={mapStub() as unknown as MapLibreMap} parentId="inao-denom-565" producer="Jean-Marc Millot"/>);
  fireEvent.click(screen.getByRole('switch'));
  fireEvent.click(await screen.findByRole('button',{name:/Show all \d+ entries/}));
  const list=screen.getByRole('list',{name:'Recorded right holders by mapped area'});
  const office=await within(list).findByRole('button',{name:/^Domaine Méo-Camuzet/});
  expect(office.textContent).toMatch(/GFV Grands Crus Investissement/);
  expect(office.textContent).toMatch(/0.45 ha · 3/);
  expect(office.textContent).toMatch(/Weak lead · office address only/);
  expect(within(list).getByRole('button',{name:/SCI les Climats|SCI Les Climats/i}).textContent).not.toMatch(/Marsannay/);
  expect(within(list).queryByRole('button',{name:/^Domaine du Château de Marsannay/})).toBeNull();
 });
 it('does not show a stale response from another cru and uses exact IDs after a producer rename',async()=>{
  let resolve!:(value:{items:typeof link[]})=>void;
  vi.mocked(listParcelProducerLinks).mockReturnValueOnce(new Promise(done=>{resolve=done})).mockResolvedValue({items:[]});
  const onLinks=vi.fn(),props={holders:[holder],editing:'',onEdit:vi.fn(),onShow:vi.fn(),onLinks};
  const view=render(<ParcelProducerLinker {...props} parentId="old" producer="Nicole Lamarche" producerId="nicole"/>);
  view.rerender(<ParcelProducerLinker {...props} parentId="new" producer="Jean-Marc Millot" producerId="millot"/>);
  await act(async()=>resolve({items:[link]}));
  expect(screen.queryByRole('link')).toBeNull();
  expect(onLinks).not.toHaveBeenCalledWith([link]);
  vi.mocked(listParcelProducerLinks).mockResolvedValue({items:[link]});
  view.rerender(<ParcelProducerLinker {...props} parentId="renamed" producer="A renamed catalogue producer" producerId="nicole"/>);
  expect(await screen.findByRole('link',{name:'Domaine Nicole Lamarche'})).toBeTruthy();
 });
 it('groups by sourced domaine names with legal identities underneath, and preserves highlighting when modes change',async()=>{
  const map=mapStub();
  render(<GrandCruParcels map={map as unknown as MapLibreMap} parentId="inao-denom-565" producer="Jean-Marc Millot"/>);
  fireEvent.click(screen.getByRole('switch'));
  await screen.findByLabelText('Group right holders by');
  fireEvent.click(screen.getByRole('button',{name:/Show all \d+ entries/}));
  const list=screen.getByRole('list',{name:'Recorded right holders by mapped area'});
  const faiveley=await within(list).findByRole('button',{name:/Domaine Faiveley/});
  expect(faiveley.textContent).toMatch(/Consortium Viticole/);
  expect(faiveley.textContent).toMatch(/Brand identity confirmed/);
  expect(screen.getByRole('region',{name:'Parcel rights'}).textContent).not.toMatch(/farming unverified|Current farming|tenant/i);
  fireEvent.change(screen.getByPlaceholderText('Search right holders'),{target:{value:'Consortium'}});
  expect(within(list).getByRole('button',{name:/Faiveley/})).toBeTruthy();
  fireEvent.click(faiveley);
  expect(map.match('212670000D0331')).toBe('owner');
  expect(within(list).getAllByRole('link').length).toBeGreaterThan(0);
  fireEvent.change(screen.getByLabelText('Group right holders by'),{target:{value:'holder'}});
  expect(map.match('212670000D0331')).toBe('owner');
  expect(within(list).getByRole('button',{name:/Consortium Viticole/})).toHaveProperty('ariaPressed','true');
  expect(screen.queryByText('Verified parcel links')).toBeNull();
 });
});
