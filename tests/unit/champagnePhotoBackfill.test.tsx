// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { ChampagnePhotoBackfill } from '../../src/features/wines/ChampagnePhotoBackfill';
import { getChampagneExtraction,startChampagneExtraction } from '../../src/features/wines/champagneExtractionApi';
import type { ChampagneExtractionStatus } from '../../src/lib/wine/champagneExtraction';
import type { SparklingDetails } from '../../src/lib/wine/sparklingDetails';

vi.mock('../../src/features/wines/champagneExtractionApi',()=>({getChampagneExtraction:vi.fn(),startChampagneExtraction:vi.fn()}));
vi.mock('../../src/features/wines/WineImage',()=>({WineImage:({alt}:{alt:string})=><span>{alt}</span>}));
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let root:Root|undefined,host:HTMLDivElement;
beforeEach(()=>{
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
});
afterEach(()=>{act(()=>root?.unmount());host?.remove();vi.clearAllMocks()});
const completed:ChampagneExtractionStatus={requestId:'r',status:'complete',details:{dosageGPerL:4,disgorgement:'Spring 2024'},error:null,imageIds:['p1']};
async function render(run:ChampagneExtractionStatus|null,details:SparklingDetails={dosageGPerL:0},imageIds=['p1']){
  vi.mocked(getChampagneExtraction).mockResolvedValue({run});
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  const onApply=vi.fn();
  await act(async()=>root!.render(<MemoryRouter><ChampagnePhotoBackfill wineId="w" imageIds={imageIds} details={details} onApply={onApply}/></MemoryRouter>));
  return {onApply};
}
const button=(text:string)=>[...document.querySelectorAll('button')].find(node=>node.textContent===text)!;
const open=async()=>{await act(async()=>{const trigger=host.querySelector('button')!;trigger.focus();trigger.click()})};
it('shows failed answer excerpts as diagnostics without offering to apply them',async()=>{
  const {onApply}=await render({...completed,status:'failed',details:null,error:'Response limit',diagnostics:{finishReason:'MAX_TOKENS',outputTokens:8176,thoughtTokens:null,answerCharacters:20,answerStart:'partial model output',answerEnd:'',excerptTruncated:false}},{});
  await open();
  expect(document.body.textContent).toContain('Failure diagnostics');
  expect(document.body.textContent).toContain('partial model output');
  expect(button('Add suggestions to form')).toBeUndefined();
  expect(onApply).not.toHaveBeenCalled();
});
it('shows literal wording and review notices while applying only ready suggestions',async()=>{
  const {onApply}=await render({...completed,details:{dosageGPerL:3,malolactic:null},sourceText:{malolactic:'MALOLACTIQUE NON SOUHAITÉE'},reviewFields:['malolactic']},{});
  await open();
  expect(document.body.textContent).toContain('MALOLACTIQUE NON SOUHAITÉE');
  expect(document.body.textContent).toContain('excluded from suggestions: Malolactic');
  await act(async()=>button('Add suggestions to form').click());
  expect(onApply).toHaveBeenCalledWith({dosageGPerL:3});
});
it('does not call an uncertain-only result unreadable',async()=>{
  await render({...completed,details:null,sourceText:{malolactic:'MALOLACTIQUE ...'},reviewFields:['malolactic']},{});
  await open();
  expect(document.body.textContent).toContain('no additional suggestions are ready');
  expect(document.body.textContent).not.toContain('No release details were readable');
});
it('restores completed suggestions on return and applies only missing fields on explicit click',async()=>{
  const {onApply}=await render(completed);
  await open();
  expect(document.body.textContent).toContain('Spring 2024');expect(document.body.textContent).not.toContain('4 g/L');
  expect(onApply).not.toHaveBeenCalled();
  await act(async()=>button('Add suggestions to form').click());
  expect(onApply).toHaveBeenCalledWith({disgorgement:'Spring 2024'});
  expect(host.textContent).toContain('Save wine');
  expect(document.querySelector('dialog')).toBeNull();
});
it('restores the exact pending source-photo selection without submitting it again',async()=>{
  await render({...completed,status:'submitted',details:null,imageIds:['p1']},{},['p1','p2']);
  await open();
  const inputs=[...document.querySelectorAll<HTMLInputElement>('dialog input[type=checkbox]')];
  expect(inputs).toHaveLength(2);
  expect(inputs[0].checked).toBe(true);
  expect(inputs[1].checked).toBe(false);
  expect(button('Extraction queued…').disabled).toBe(true);
  expect(startChampagneExtraction).not.toHaveBeenCalled();
});
it('queues the selected saved photos, disables repeats, and waits for review',async()=>{
  const {onApply}=await render(null,{},['p1','p2']);
  await open();
  vi.mocked(startChampagneExtraction).mockResolvedValue({run:{...completed,status:'queued',details:null}});
  vi.mocked(getChampagneExtraction).mockResolvedValue({run:{...completed,status:'queued',details:null}});
  await act(async()=>document.querySelectorAll<HTMLInputElement>('dialog input')[1].click());
  await act(async()=>button('Confirm 1 photo & extract').click());
  expect(startChampagneExtraction).toHaveBeenCalledWith('w',['p1'],expect.any(AbortSignal));
  expect(button('Extraction queued…').disabled).toBe(true);expect(onApply).not.toHaveBeenCalled();
});
it('keeps a new selection when completed source photos are refreshed',async()=>{
  const {onApply}=await render(completed,{},['p1','p2']);
  await open();
  const inputs=()=>[...document.querySelectorAll<HTMLInputElement>('dialog input[type=checkbox]')];
  expect(inputs().map(input=>input.checked)).toEqual([true,true]);
  await act(async()=>inputs()[0].click());
  await act(async()=>root!.render(<MemoryRouter><ChampagnePhotoBackfill wineId="w" imageIds={['p1','p2','p3']} details={{}} onApply={onApply}/></MemoryRouter>));
  expect(inputs().map(input=>input.checked)).toEqual([false,true,false]);
  expect(document.body.textContent).toContain('Result source photos: Photo 1');
});
it('handles no photos and empty results without inventing suggestions',async()=>{
  await render({...completed,details:null}, {}, []);
  await open();
  expect(document.body.textContent).toContain('Add bottle photos');
  expect(document.body.textContent).toContain('No release details were readable');
  expect(host.textContent).not.toContain('Add suggestions to form');
});

it('keeps the form compact and requires photo confirmation before scanning',async()=>{
  await render(null);
  expect(document.querySelector('dialog')).toBeNull();
  expect(host.querySelectorAll('button')).toHaveLength(1);
  expect(host.querySelector('input')).toBeNull();
  await open();
  expect(document.querySelector('dialog[open]')).not.toBeNull();
  expect(startChampagneExtraction).not.toHaveBeenCalled();
  await act(async()=>document.querySelector('dialog')!.dispatchEvent(new Event('cancel',{cancelable:true})));
  expect(document.querySelector('dialog')).toBeNull();
  expect(document.activeElement).toBe(host.querySelector('button'));
  expect(document.body.style.overflow).not.toBe('hidden');
});
