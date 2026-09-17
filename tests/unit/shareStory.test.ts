// @vitest-environment jsdom
import { afterEach,describe,expect,it,vi } from 'vitest';
import type { LoadedPhoto,StoryCard } from '../../src/features/share/renderStoryCollage';

const card=()=>new File(['card'],'winelog-story.jpg',{type:'image/jpeg'});

async function loadModule(){
  vi.resetModules();
  return import('../../src/features/share/shareStory');
}

/** A navigator with only the share bits the sheet actually asks about. */
const navigatorWith=(parts:Partial<{share:unknown;canShare:unknown}>)=>parts as unknown as Navigator;

afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()});

describe('loading story photos',()=>{
  const story:StoryCard={title:'Evening',subtitle:'Today',wines:[
    {id:'w1',producer:'P',wineName:'W',vintage:2020,favorite:false,imageId:'img-1'}
  ]};

  it('shares pending fetches and decodes across overlapping redraws',async()=>{
    let resolve!:(response:Response)=>void;
    const fetch=vi.fn(()=>new Promise<Response>(done=>{resolve=done}));
    const decode=vi.fn(async()=>({width:400,height:600}));
    vi.stubGlobal('fetch',fetch);vi.stubGlobal('createImageBitmap',decode);
    const {loadStoryPhotos}=await loadModule();
    const cache=new Map<string,LoadedPhoto>();
    const first=loadStoryPhotos(story,cache),second=loadStoryPhotos(story,cache);
    expect(fetch).toHaveBeenCalledTimes(1);
    resolve(new Response(new Blob(['photo'])));
    await Promise.all([first,second]);
    await loadStoryPhotos(story,cache);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(decode).toHaveBeenCalledTimes(1);
    expect(cache.get('img-1')?.width).toBe(400);
  });

  it('retries a failed load on the next redraw',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(new Response(null,{status:503}))
      .mockResolvedValueOnce(new Response(new Blob(['photo'])));
    vi.stubGlobal('fetch',fetch);vi.stubGlobal('createImageBitmap',vi.fn(async()=>({width:400,height:600})));
    const {loadStoryPhotos}=await loadModule();
    const cache=new Map<string,LoadedPhoto>();
    await loadStoryPhotos(story,cache);
    expect(cache.has('img-1')).toBe(false);
    await loadStoryPhotos(story,cache);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(cache.get('img-1')?.width).toBe(400);
  });
});

describe('deciding whether the share sheet can take the card',()=>{
  it('says yes only when the browser has both halves of the API and accepts the file',async()=>{
    const {canShareFiles}=await loadModule();
    const file=card();
    expect(canShareFiles(file,navigatorWith({share:()=>Promise.resolve(),canShare:()=>true}))).toBe(true);
    expect(canShareFiles(file,navigatorWith({canShare:()=>true})),'no share()').toBe(false);
    expect(canShareFiles(file,navigatorWith({share:()=>Promise.resolve()})),'no canShare()').toBe(false);
    expect(canShareFiles(file,navigatorWith({})),'neither').toBe(false);
  });

  it('believes a browser that says it cannot take a file, rather than trying anyway',async()=>{
    const {canShareFiles}=await loadModule();
    // Desktop Safari has share() and canShare(), and refuses files.
    expect(canShareFiles(card(),navigatorWith({share:()=>Promise.resolve(),canShare:()=>false}))).toBe(false);
  });

  it('asks about the very file it is about to hand over',async()=>{
    const {canShareFiles}=await loadModule();
    const file=card();
    const canShare=vi.fn(()=>true);
    canShareFiles(file,navigatorWith({share:()=>Promise.resolve(),canShare}));
    expect(canShare).toHaveBeenCalledWith({files:[file]});
  });
});

describe('handing the card over',()=>{
  /** Downloads go through an <a>; watching the click is how we tell them apart. */
  function watchDownload(){
    const clicks:HTMLAnchorElement[]=[];
    const create=document.createElement.bind(document);
    vi.spyOn(document,'createElement').mockImplementation((tag:string,options?:ElementCreationOptions)=>{
      const element=create(tag as 'a',options);
      // preventDefault keeps jsdom from trying to navigate to the blob URL.
      if(tag==='a')element.addEventListener('click',event=>{event.preventDefault();clicks.push(element as HTMLAnchorElement)});
      return element;
    });
    vi.stubGlobal('URL',Object.assign(Object.create(URL),{createObjectURL:()=>'blob:story',revokeObjectURL:()=>undefined}));
    return clicks;
  }

  it('reports a completed share, and does not also save the file',async()=>{
    const share=vi.fn(async()=>undefined);
    vi.stubGlobal('navigator',navigatorWith({share,canShare:()=>true}));
    const clicks=watchDownload();
    const {shareStoryFile}=await loadModule();
    const file=card();
    await expect(shareStoryFile(file)).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({files:[file]});
    expect(clicks,'a shared card is not downloaded as well').toHaveLength(0);
  });

  it('treats a dismissed share sheet as a change of mind, not a failure',async()=>{
    const abort=Object.assign(new Error('share cancelled'),{name:'AbortError'});
    vi.stubGlobal('navigator',navigatorWith({share:async()=>{throw abort},canShare:()=>true}));
    const clicks=watchDownload();
    const {shareStoryFile}=await loadModule();
    await expect(shareStoryFile(card())).resolves.toBe('cancelled');
    expect(clicks,'nothing is forced on somebody who backed out').toHaveLength(0);
  });

  it('saves the card when there is no share sheet to hand it to',async()=>{
    vi.stubGlobal('navigator',navigatorWith({}));
    const clicks=watchDownload();
    const {shareStoryFile}=await loadModule();
    await expect(shareStoryFile(card())).resolves.toBe('downloaded');
    expect(clicks).toHaveLength(1);
    expect(clicks[0].download).toBe('winelog-story.jpg');
  });

  it('still leaves the person with the card when a share that promised to work throws',async()=>{
    vi.stubGlobal('navigator',navigatorWith({share:async()=>{throw new Error('NotAllowedError')},canShare:()=>true}));
    const clicks=watchDownload();
    const {shareStoryFile}=await loadModule();
    await expect(shareStoryFile(card())).resolves.toBe('downloaded');
    expect(clicks,'the fallback is the point of this branch').toHaveLength(1);
  });
});
