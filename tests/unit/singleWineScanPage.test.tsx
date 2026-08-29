// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

// The two steps that need a real browser: EXIF parsing and canvas resizing.
// Everything between choosing a photo and seeing the review is the page's own.
vi.mock('../../src/features/uploads/prepareImage',()=>({
  prepareRecognitionImage:vi.fn(async(file:File)=>({file,width:1200,height:1600}))
}));
vi.mock('../../src/features/uploads/photoMetadata',()=>({
  extractPhotoMetadata:vi.fn(async()=>({capturedAt:'2026-08-20T18:30:00.000Z',latitude:null,longitude:null,source:'exif'}))
}));

const recognized={
  producer:'Domaine Dujac',wineName:'Morey-Saint-Denis 1er Cru',vintage:2019,
  country:'France',region:'Burgundy',appellation:'Morey-Saint-Denis 1er Cru',
  style:'red',confidence:0.91,recognitionDurationMs:4200
};

let root:Root|null=null,host:HTMLDivElement|null=null;
const calls:{url:string;body:FormData}[]=[];

async function render(state?:unknown){
  calls.length=0;
  vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
    calls.push({url:String(url),body:init?.body as FormData});
    return new Response(JSON.stringify(recognized),{status:200,headers:{'content-type':'application/json'}});
  }));
  let previews=0;
  vi.stubGlobal('URL',Object.assign(globalThis.URL,{createObjectURL:()=>`blob:preview-${++previews}`,revokeObjectURL:()=>{}}));
  const {UploadPage}=await import('../../src/features/uploads/UploadPage');
  host=document.createElement('div');
  document.body.appendChild(host);
  root=createRoot(host);
  await act(async()=>{root!.render(
    <MemoryRouter initialEntries={[{pathname:'/upload',state}]}><UploadPage/></MemoryRouter>)});
  return host;
}

const button=(text:string)=>[...host!.querySelectorAll('button')].find(b=>b.textContent?.trim()===text);
const click=async(el:HTMLElement)=>{await act(async()=>{el.click()})};
const pick=async(...names:string[])=>{
  const input=host!.querySelector('input[type=file]') as HTMLInputElement;
  const files=names.map(name=>new File([new Uint8Array([1,2,3])],name,{type:'image/jpeg'}));
  Object.defineProperty(input,'files',{configurable:true,value:files});
  await act(async()=>{input.dispatchEvent(new Event('change',{bubbles:true}))});
};

afterEach(()=>{
  act(()=>root?.unmount());
  host?.remove();root=null;host=null;
  vi.unstubAllGlobals();
});

describe('the single wine page',()=>{
  it('opens ready to be used, with nothing handed to it',async()=>{
    // It used to be reached only from the bottom sheet, which opened the file
    // chooser first and passed the files through route state. Now Single Wine
    // navigates here with nothing, so the page has to stand on its own.
    await render();
    expect(host!.querySelector('.photo-source-card h2')?.textContent).toBe('Scan a wine');
    expect(button('Scan Wine')).toBeTruthy();
    expect(host!.querySelector('input[type=file]')).toBeTruthy();
    expect(host!.querySelectorAll('.upload-list li')).toHaveLength(0);
  });

  it('prepares the photos it is given and says they are ready',async()=>{
    await render();
    await pick('front.jpg','back.jpg');
    expect(host!.querySelector('.scan-summary strong')?.textContent).toBe('2 photos selected');
    const rows=[...host!.querySelectorAll('.upload-list li')];
    expect(rows).toHaveLength(2);
    expect(rows.map(row=>row.querySelector('strong')?.textContent)).toEqual(['Primary label','Additional label 2']);
    expect(rows.every(row=>row.textContent?.includes('ready to identify'))).toBe(true);
    expect(rows[0].textContent).toContain('Photo date:');
    expect(button('Identify this wine')?.disabled).toBe(false);
  });

  it('sends both photos as one bottle and shows the review',async()=>{
    await render();
    await pick('front.jpg','back.jpg');
    await click(button('Identify this wine')!);

    // Filtered rather than counted: the review mounts WineForm, which reads
    // /api/tastings/active for its prefill. What matters here is that the two
    // photos went up as one bottle in one recognition request.
    const recognitions=calls.filter(call=>call.url==='/api/recognition');
    expect(recognitions).toHaveLength(1);
    expect(recognitions[0].body.getAll('images')).toHaveLength(2);
    expect(JSON.parse(recognitions[0].body.get('metadata') as string)).toHaveLength(2);

    expect(host!.querySelector('.review h2')?.textContent).toBe('Combined identification');
    expect(host!.textContent).toContain('identified in 4.2s');
    const producer=host!.querySelector('.review input') as HTMLInputElement;
    expect(producer.value).toBe('Domaine Dujac');
  });

  it('says so when recognition fails instead of leaving the page still',async()=>{
    await render();
    await pick('front.jpg');
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({error:'Gemini is unavailable',requestId:'abc'}),{status:503}));
    await click(button('Identify this wine')!);
    expect(host!.querySelector('.scan-error')?.textContent).toBe('Gemini is unavailable · Request abc');
    expect(host!.querySelector('.review')).toBeNull();
  });
});
