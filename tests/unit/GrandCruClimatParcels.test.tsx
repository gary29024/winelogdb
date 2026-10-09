// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import type {Map as MapLibreMap} from 'maplibre-gl';
import {GrandCruParcels,type Parcels} from '../../src/features/vineyards/GrandCruParcels';
import {listParcelProducerLinks} from '../../src/features/vineyards/parcelProducerApi';
import {loadVillageMapCatalogue} from '../../src/lib/places/loadVillageMapCatalogue';
import {grandCrus,parcelBundles} from '../../src/lib/places/grandCruParcels/registry';
import {climatParents,loadClimatParcels} from '../../src/lib/places/grandCruParcels/climats';
vi.mock('../../src/features/vineyards/parcelProducerApi',()=>({listParcelProducerLinks:vi.fn(async()=>({items:[]}))}));

const corton=JSON.parse(readFileSync('public'+parcelBundles.corton.dataUrl,'utf8')) as Parcels;
const chablis=JSON.parse(readFileSync('public'+parcelBundles.chablis.dataUrl,'utf8')) as Parcels;
const bressandes={id:'inao-denom-2357',name:'Corton Les Bressandes'};
const cortonClimats=Object.keys(climatParents).filter(id=>climatParents[id]==='inao-denom-549');
type Styled={features:{properties:{id:string;match:string}}[]};
// The map's own tier fill layers are present, so the panel's fades can be read back.
function mapStub(){
 const layers=new Set(['vineyard-fill','selected-fill']),sources=new Map<string,{setData:(data:Styled)=>void}>();
 const drawn:{data?:Styled}={};
 return {drawn,getStyle:vi.fn(()=>({})),getLayer:vi.fn(id=>layers.has(id)),getSource:vi.fn(id=>sources.get(id)),
  addLayer:vi.fn(l=>layers.add(l.id)),addSource:vi.fn((id,source)=>{drawn.data=source.data;sources.set(id,{setData:data=>{drawn.data=data}})}),
  setFilter:vi.fn(),on:vi.fn(),off:vi.fn(),getPaintProperty:vi.fn(()=>0.62),setPaintProperty:vi.fn(),
  removeLayer:vi.fn(id=>layers.delete(id)),removeSource:vi.fn(id=>sources.delete(id)),fitBounds:vi.fn()};
}
const share=()=>document.querySelector('.village-map-parcel-share')?.textContent;
const fadedIds=(map:ReturnType<typeof mapStub>)=>(map.setPaintProperty.mock.calls.filter(([layer])=>layer==='vineyard-fill').at(-1)?.[2] as unknown[])[1] as [string,unknown,[string,string[]]];
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.mocked(listParcelProducerLinks).mockResolvedValue({items:[]})});

describe('Grand Cru climat parcels',()=>{
 it('covers every official climat of a mapped cru, against the current parcel snapshot',async()=>{
  for(const cru of grandCrus)for(const map of cru.villageMaps){
   const catalogue=await loadVillageMapCatalogue(map);
   for(const feature of catalogue.features.filter(f=>f.kind==='vineyard'&&f.parentAppellation===cru.name)){
    expect(climatParents[feature.id]).toBe(cru.parentFeatureId);
   }
  }
  expect(cortonClimats).toHaveLength(24);
  for(const parent of new Set(Object.values(climatParents))){
   const cru=grandCrus.find(c=>c.parentFeatureId===parent)!;
   const file=(await loadClimatParcels(parent))!;
   expect(file.inputs.parcelSnapshotSha256).toBe(parcelBundles[cru.bundle].sha256);
   for(const [id,owner] of Object.entries(climatParents))if(owner===parent)expect(Object.keys(file.climats[id].parcels).length).toBeGreaterThan(0);
  }
 });
 it('opens a Corton climat wine on its own parcels, with the linked holder highlighted, and widens to all of Corton',async()=>{
  vi.mocked(listParcelProducerLinks).mockResolvedValue({items:[{holderId:'440712529',producerId:'tollot',producerName:'Tollot Beaut',updatedAt:'2026-10-01',status:'manual'}]});
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json(corton)));
  const map=mapStub(),onLegend=vi.fn();
  render(<GrandCruParcels map={map as unknown as MapLibreMap} parentId="inao-denom-549" climat={bressandes} producer="Tollot Beaut" producerId="tollot" onLegend={onLegend}/>);
  expect(screen.getByText('· Corton Les Bressandes')).toBeTruthy();
  fireEvent.click(screen.getByRole('switch'));
  await waitFor(()=>expect(share()).toContain('65 parcels in Corton Les Bressandes'));
  // The link saved on Corton applies here: 2 of GFA Tollot Beaut's 4 Corton parcels lie in Les Bressandes.
  expect((await screen.findByText('Domaine Tollot-Beaut',{selector:'.village-map-linked-producer strong'}))).toBeTruthy();
  await waitFor(()=>expect(map.drawn.data?.features.filter(f=>f.properties.match==='owner').map(f=>f.properties.id).sort()).toEqual(['210100000D0042','210100000D0064']));
  expect(map.drawn.data?.features).toHaveLength(65);
  await waitFor(()=>expect(onLegend).toHaveBeenLastCalledWith(['recorded','unrecorded','owner']));
  expect(map.fitBounds).toHaveBeenCalled();
  // The cru fades with all its climats and the merged Grand Cru fill the Aloxe-Corton map paints instead.
  const faded=['inao-denom-549',...cortonClimats,'overview-grand_cru'].sort();
  expect(fadedIds(map)[2][1].sort()).toEqual(faded);
  const owner=map.addLayer.mock.calls.map(([layer])=>layer).find(layer=>layer.id==='cadastral-parcel-owner');
  expect(owner.paint).toEqual({'fill-color':'#f5b800','fill-opacity':0.85});

  const scope=screen.getByRole('group',{name:'Parcels shown'});
  expect(within(scope).getByRole('button',{name:'Corton Les Bressandes'}).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(within(scope).getByRole('button',{name:'All of Corton'}));
  await waitFor(()=>expect(share()).toContain('728 parcels in Corton'));
  expect(screen.getByText('· Corton')).toBeTruthy();
  await waitFor(()=>expect(map.drawn.data?.features).toHaveLength(728));
  expect(map.drawn.data?.features.some(f=>f.properties.match==='owner')).toBe(false);
  expect(fadedIds(map)[2][1].sort()).toEqual(faded);
 });
 it('starts again on a newly tapped climat without reloading the parcels',async()=>{
  const fetcher=vi.fn(async()=>Response.json(corton));vi.stubGlobal('fetch',fetcher);
  const map=mapStub();
  const view=render(<GrandCruParcels map={map as unknown as MapLibreMap} parentId="inao-denom-549" climat={bressandes}/>);
  fireEvent.click(screen.getByRole('switch'));
  await waitFor(()=>expect(share()).toContain('65 parcels'));
  fireEvent.click(screen.getByRole('button',{name:'All of Corton'}));
  view.rerender(<GrandCruParcels map={map as unknown as MapLibreMap} parentId="inao-denom-549" climat={{id:'inao-denom-2370',name:'Corton Les Renardes'}}/>);
  await waitFor(()=>expect(share()).toContain('66 parcels in Corton Les Renardes'));
  expect(screen.getByRole('button',{name:'Corton Les Renardes'}).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('switch')).toHaveProperty('checked',true);
  expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('counts a parcel split between two Chablis climats in both, by its area in each',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json(chablis)));
  render(<GrandCruParcels map={mapStub() as unknown as MapLibreMap} parentId="inao-denom-439" climat={{id:'inao-denom-443',name:'Les Clos'}}/>);
  fireEvent.click(screen.getByRole('switch'));
  await waitFor(()=>expect(share()).toContain('109 parcels in Les Clos'));
  fireEvent.change(screen.getByLabelText('Cadastral parcel'),{target:{value:'890680000A0652'}});
  const details=screen.getByRole('heading',{name:/^Parcel A/}).closest('.village-map-parcel-details')! as HTMLElement;
  expect(details.textContent).toMatch(/\b2\d% inside Les Clos/);
 });
});
