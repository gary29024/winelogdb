// @vitest-environment jsdom
import { afterEach,expect,it,vi } from 'vitest';
import { cleanup,render,waitFor } from '@testing-library/react';
import { WineImage } from '../../src/features/wines/WineImage';
vi.mock('../../src/lib/auth/client',()=>({authHeaders:()=>({Authorization:'Bearer test'})}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks()});
it('keeps thumbnail and original requests and blob caches separate when a photo is enlarged',async()=>{
  vi.stubGlobal('IntersectionObserver',undefined);
  const fetcher=vi.fn(async()=>({ok:true,blob:async()=>new Blob(['image'])}));vi.stubGlobal('fetch',fetcher);
  let number=0;URL.createObjectURL=vi.fn(()=>`blob:variant-${++number}`);URL.revokeObjectURL=vi.fn();
  const {rerender,getByAltText}=render(<WineImage imageId="variant-test" alt="Bottle"/>);
  await waitFor(()=>expect(getByAltText('Bottle').getAttribute('src')).toBe('blob:variant-1'));
  expect(fetcher.mock.calls[0]).toEqual(['/api/images/variant-test?variant=thumbnail',{headers:{Authorization:'Bearer test'},cache:'default'}]);
  rerender(<WineImage imageId="variant-test" alt="Bottle" variant="original"/>);
  await waitFor(()=>expect(getByAltText('Bottle').getAttribute('src')).toBe('blob:variant-2'));
  expect(fetcher.mock.calls[1]).toEqual(['/api/images/variant-test',{headers:{Authorization:'Bearer test'},cache:'default'}]);
  rerender(<WineImage imageId="variant-test" alt="Bottle"/>);
  await waitFor(()=>expect(getByAltText('Bottle').getAttribute('src')).toBe('blob:variant-1'));
  expect(fetcher).toHaveBeenCalledTimes(2);
});
