// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,expect,it,vi } from 'vitest';
import { ChampagnePhotoBackfill } from '../../src/features/wines/ChampagnePhotoBackfill';
import { getChampagneExtraction,startChampagneExtraction } from '../../src/features/wines/champagneExtractionApi';
import type { ChampagneExtractionStatus } from '../../src/lib/wine/champagneExtraction';
import type { SparklingDetails } from '../../src/lib/wine/sparklingDetails';

vi.mock('../../src/features/wines/champagneExtractionApi',()=>({getChampagneExtraction:vi.fn(),startChampagneExtraction:vi.fn()}));
vi.mock('../../src/features/wines/WineImage',()=>({WineImage:({alt}:{alt:string})=><span>{alt}</span>}));
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let root:Root|undefined,host:HTMLDivElement;
afterEach(()=>{act(()=>root?.unmount());host?.remove();vi.clearAllMocks()});
const completed:ChampagneExtractionStatus={requestId:'r',status:'complete',details:{dosageGPerL:4,disgorgement:'Spring 2024'},error:null,imageIds:['p1']};
async function render(run:ChampagneExtractionStatus|null,details:SparklingDetails={dosageGPerL:0},imageIds=['p1']){
  vi.mocked(getChampagneExtraction).mockResolvedValue({run});
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  const onApply=vi.fn();
  await act(async()=>root!.render(<MemoryRouter><ChampagnePhotoBackfill wineId="w" imageIds={imageIds} details={details} onApply={onApply}/></MemoryRouter>));
  return {onApply};
}
const button=(text:string)=>[...host.querySelectorAll('button')].find(node=>node.textContent===text)!;
it('restores completed suggestions on return and applies only missing fields on explicit click',async()=>{
  const {onApply}=await render(completed);
  expect(host.textContent).toContain('Spring 2024');expect(host.textContent).not.toContain('4 g/L');
  expect(onApply).not.toHaveBeenCalled();
  await act(async()=>button('Add suggestions to form').click());
  expect(onApply).toHaveBeenCalledWith({disgorgement:'Spring 2024'});
  expect(host.textContent).toContain('then Save');
});
it('restores pending work without submitting it again',async()=>{
  await render({...completed,status:'submitted',details:null});
  expect(button('Extraction queued…').disabled).toBe(true);
  expect(startChampagneExtraction).not.toHaveBeenCalled();
});
it('queues the selected saved photos, disables repeats, and waits for review',async()=>{
  const {onApply}=await render(null,{},['p1','p2']);
  vi.mocked(startChampagneExtraction).mockResolvedValue({run:{...completed,status:'queued',details:null}});
  vi.mocked(getChampagneExtraction).mockResolvedValue({run:{...completed,status:'queued',details:null}});
  await act(async()=>host.querySelectorAll<HTMLInputElement>('input')[1].click());
  await act(async()=>button('Extract Champagne details').click());
  expect(startChampagneExtraction).toHaveBeenCalledWith('w',['p1'],expect.any(AbortSignal));
  expect(button('Extraction queued…').disabled).toBe(true);expect(onApply).not.toHaveBeenCalled();
});
it('handles no photos and empty results without inventing suggestions',async()=>{
  await render({...completed,details:null}, {}, []);
  expect(host.textContent).toContain('Add bottle photos');
  expect(host.textContent).toContain('No release details were readable');
  expect(host.textContent).not.toContain('Add suggestions to form');
});
