// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SharedLabel } from '../../src/features/wines/SharedLabel';
import { recallPhoto, setSavedPhotosStore } from '../../src/lib/offline/savedPhotos';
import { setSavedReadsBackend, setSavedReadsOwner, type DeviceStore } from '../../src/lib/offline/savedReads';

function memoryStore<T>(): DeviceStore<T> {
  const scopes = new Map<string, Map<string, { value: T; at: number }>>();
  return {
    get: async (scope, key) => scopes.get(scope)?.get(key),
    put: async (scope, key, saved) =>
      void (scopes.get(scope) ?? scopes.set(scope, new Map()).get(scope)!).set(key, saved),
    clear: async (scope) => void scopes.delete(scope),
  };
}

const small = new Blob(['small photo']);
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  setSavedPhotosStore(memoryStore<Blob>());
  setSavedReadsBackend(memoryStore<unknown>());
  setSavedReadsOwner('alice');
  URL.createObjectURL = vi.fn(() => 'blob:kept-shared-label');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  setSavedReadsOwner(null);
  setSavedPhotosStore(null);
  setSavedReadsBackend(null);
  localStorage.clear();
  vi.unstubAllGlobals();
});

it("keeps a friend's small label once it has loaded, and shows it when the picture cannot load", async () => {
  const src = '/api/shared/wines/w1/photos/p1?variant=thumbnail';
  const fetcher = vi.fn(async () => ({ ok: true, blob: async () => small }));
  vi.stubGlobal('fetch', fetcher);
  const first = render(<SharedLabel src={src} alt="Friend label" className="journal-wine-thumb" />);
  fireEvent.load(first.getByAltText('Friend label'));
  await settle();
  expect(fetcher).toHaveBeenCalledWith(src, { cache: 'force-cache', credentials: 'same-origin' });
  expect(await recallPhoto(src)).toBe(small);
  first.unmount();

  // Later, with no connection, the browser cannot load the picture.
  const later = render(<SharedLabel src={src} alt="Friend label" />);
  fireEvent.error(later.getByAltText('Friend label'));
  await waitFor(() => expect(later.getByAltText('Friend label').getAttribute('src')).toBe('blob:kept-shared-label'));
  expect(fetcher).toHaveBeenCalledTimes(1);

  // The full-size photo on the friend's wine page is stood in for by the small one.
  const page = render(<SharedLabel src="/api/shared/wines/w1/photos/p1" alt="Full photo" />);
  fireEvent.error(page.getByAltText('Full photo'));
  await waitFor(() => expect(page.getByAltText('Full photo').getAttribute('src')).toBe('blob:kept-shared-label'));
});

it('never keeps a full-size photo, and leaves a picture alone when nothing was kept', async () => {
  const fetcher = vi.fn(async () => ({ ok: true, blob: async () => small }));
  vi.stubGlobal('fetch', fetcher);
  const src = '/api/shared/wines/w2/photos/p2';
  const { getByAltText } = render(<SharedLabel src={src} alt="Full photo" />);
  fireEvent.load(getByAltText('Full photo'));
  fireEvent.error(getByAltText('Full photo'));
  await settle();
  expect(fetcher).not.toHaveBeenCalled();
  expect(getByAltText('Full photo').getAttribute('src')).toBe(src);
});
