// @vitest-environment jsdom
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { loadBatchPreviewBlob,resetBatchPreviewCache } from '../../src/features/uploads/batchPreviewCache';

beforeEach(()=>{
  localStorage.clear();
  resetBatchPreviewCache();
});

afterEach(()=>{
  resetBatchPreviewCache();
  vi.unstubAllGlobals();
});

describe('Batch Scan preview cache',()=>{
  it('deduplicates simultaneous reads of the same staged image',async()=>{
    let release:(response:Response)=>void=()=>undefined;
    const response=new Promise<Response>(resolve=>{release=resolve});
    const fetchMock=vi.fn(()=>response);
    vi.stubGlobal('fetch',fetchMock);

    const first=loadBatchPreviewBlob('image-1');
    const second=loadBatchPreviewBlob('image-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    release(new Response(new Blob(['preview'],{type:'image/jpeg'}),{status:200}));
    const [a,b]=await Promise.all([first,second]);
    expect(a).toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reuses a successful preview after the component is remounted',async()=>{
    const fetchMock=vi.fn(async()=>new Response(new Blob(['preview'],{type:'image/jpeg'}),{status:200}));
    vi.stubGlobal('fetch',fetchMock);

    const first=await loadBatchPreviewBlob('image-2');
    const second=await loadBatchPreviewBlob('image-2');

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
