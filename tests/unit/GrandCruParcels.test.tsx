// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import type {Map as MapLibreMap} from 'maplibre-gl';
import {GrandCruParcels,type Parcels} from '../../src/features/vineyards/GrandCruParcels';
import manifest from '../../src/lib/places/echezeauxParcelManifest.json';

const data=JSON.parse(readFileSync('public'+manifest.dataUrl,'utf8')) as Parcels;
function mapStub(){
 const layers=new Set<string>(),sources=new Set<string>();
 return {getStyle:vi.fn(()=>({})),getLayer:vi.fn(id=>layers.has(id)),getSource:vi.fn(id=>sources.has(id)),
  addLayer:vi.fn(l=>layers.add(l.id)),addSource:vi.fn(id=>sources.add(id)),setFilter:vi.fn(),on:vi.fn(),off:vi.fn(),
  removeLayer:vi.fn(id=>layers.delete(id)),removeSource:vi.fn(id=>sources.delete(id)),fitBounds:vi.fn()};
}
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
describe('Cadastral parcel controls',()=>{
 it('downloads only on request, preserves both rights on a parcel, and cleans up the overlay',async()=>{
  const sample=structuredClone(data),feature=sample.features.find(f=>f.properties.recordedRights.length&&f.properties.overlaps.some(o=>o.parentFeatureId==='inao-denom-565'))!;
  feature.properties.recordedRights.push({...feature.properties.recordedRights[0],rightCode:'N',rightLabel:'Nu-propriétaire'});
  const fetcher=vi.fn(async()=>Response.json(sample));vi.stubGlobal('fetch',fetcher);
  const map=mapStub();const view=render(<GrandCruParcels map={map as unknown as MapLibreMap} parentId="inao-denom-565"/>);
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox'));
  await screen.findByLabelText('Recorded right holder');
  fireEvent.change(screen.getByLabelText('Explore a cadastral parcel'),{target:{value:feature.properties.id}});
  expect(screen.getAllByText(/SIREN|DGFiP identifier/)).toHaveLength(2);
  expect(screen.getByText('Farming domaine: not verified for this parcel.')).toBeTruthy();
  expect(map.fitBounds).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.queryByLabelText('Recorded right holder')).toBeNull();
  expect(map.removeSource).toHaveBeenCalledWith('cadastral-parcels');
  fireEvent.click(screen.getByRole('checkbox'));
  expect(fetcher).toHaveBeenCalledTimes(1);
  view.unmount();expect(map.off).toHaveBeenCalled();
 });
 it('retries a failed download independently and retains parcels without published rights',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(null,{status:503})).mockResolvedValueOnce(Response.json(data));
  vi.stubGlobal('fetch',fetcher);
  render(<GrandCruParcels map={mapStub() as unknown as MapLibreMap} parentId="inao-denom-565"/>);
  fireEvent.click(screen.getByRole('checkbox'));
  expect((await screen.findByRole('alert')).textContent).toContain('The cru map remains available');
  fireEvent.click(screen.getByRole('button',{name:'Retry parcels'}));
  const holder=await screen.findByLabelText('Recorded right holder');
  fireEvent.change(holder,{target:{value:'unknown'}});
  const parcel=screen.getByLabelText('Explore a cadastral parcel') as unknown as HTMLSelectElement;
  expect(parcel.options.length).toBeGreaterThan(1);
  fireEvent.change(parcel,{target:{value:parcel.options[1].value}});
  expect(screen.getByText(/This does not establish that the parcel has no owner/)).toBeTruthy();
  expect(screen.queryByLabelText('Verified farming domaine')).toBeNull();
 });
 it('aborts an in-flight request when the layer is hidden',async()=>{
  let signal:AbortSignal|undefined;
  vi.stubGlobal('fetch',vi.fn((_url,options)=>{signal=options.signal;return new Promise(()=>{})}));
  render(<GrandCruParcels map={mapStub() as unknown as MapLibreMap} parentId="inao-denom-565"/>);
  fireEvent.click(screen.getByRole('checkbox'));
  await waitFor(()=>expect(signal).toBeDefined());
  fireEvent.click(screen.getByRole('checkbox'));
  expect(signal?.aborted).toBe(true);
 });
});
