// @vitest-environment jsdom
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { forgetGroupSessionImages,groupPreviewImageUrl,loadGroupImageBlob,rememberGroupImageBlob,resetGroupImageCache } from '../../src/features/uploads/groupImageCache';

beforeEach(()=>{
  localStorage.clear();
  resetGroupImageCache();
});

afterEach(()=>{
  resetGroupImageCache();
  vi.unstubAllGlobals();
});

describe('Group Photo image cache',()=>{
  it('deduplicates simultaneous reads of the same private image',async()=>{
    let release:(response:Response)=>void=()=>undefined;
    const response=new Promise<Response>(resolve=>{release=resolve});
    const fetchMock=vi.fn(()=>response);
    vi.stubGlobal('fetch',fetchMock);
    const url=groupPreviewImageUrl('session-1');

    const first=loadGroupImageBlob(url);
    const second=loadGroupImageBlob(url);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    release(new Response(new Blob(['preview'],{type:'image/jpeg'}),{status:200}));
    const [a,b]=await Promise.all([first,second]);
    expect(a).toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reuses locally seeded session bytes and forgets them when the session is deleted',async()=>{
    const fetchMock=vi.fn(async()=>new Response(new Blob(['network'],{type:'image/jpeg'}),{status:200}));
    vi.stubGlobal('fetch',fetchMock);
    const url=groupPreviewImageUrl('session-2'),local=new Blob(['local'],{type:'image/jpeg'});

    rememberGroupImageBlob(url,local);
    expect(await loadGroupImageBlob(url)).toBe(local);
    expect(fetchMock).not.toHaveBeenCalled();

    forgetGroupSessionImages('session-2');
    const restored=await loadGroupImageBlob(url);
    expect(restored).not.toBe(local);
    expect(await loadGroupImageBlob(url)).toBe(restored);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not cache failed image responses',async()=>{
    const fetchMock=vi.fn()
      .mockResolvedValueOnce(new Response('busy',{status:503}))
      .mockResolvedValueOnce(new Response(new Blob(['ok'],{type:'image/jpeg'}),{status:200}));
    vi.stubGlobal('fetch',fetchMock);
    const url=groupPreviewImageUrl('session-3');

    await expect(loadGroupImageBlob(url)).rejects.toThrow('503');
    const restored=await loadGroupImageBlob(url);
    expect(await loadGroupImageBlob(url)).toBe(restored);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
