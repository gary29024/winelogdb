// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WineImage } from '../../src/features/wines/WineImage';
import { photoKeepingCopy, recallPhoto, setSavedPhotosStore } from '../../src/lib/offline/savedPhotos';
import { setSavedReadsBackend, setSavedReadsOwner, type DeviceStore } from '../../src/lib/offline/savedReads';

vi.mock('../../src/lib/auth/client', () => ({
  authHeaders: () => ({}),
  apiFetch: (...args: Parameters<typeof fetch>) => fetch(...args),
}));

/** A stand-in for the browser's database: one map per account. */
function memoryStore<T>() {
  const scopes = new Map<string, Map<string, { value: T; at: number }>>();
  const store: DeviceStore<T> = {
    get: async (scope, key) => scopes.get(scope)?.get(key),
    put: async (scope, key, saved) =>
      void (scopes.get(scope) ?? scopes.set(scope, new Map()).get(scope)!).set(key, saved),
    clear: async (scope) => void scopes.delete(scope),
  };
  return { store, scopes };
}

const offline = () => Promise.reject(new TypeError('Failed to fetch'));
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const small = new Blob(['small photo']);
const large = new Blob(['the full-size photo']);

let photos: ReturnType<typeof memoryStore<Blob>>;
beforeEach(() => {
  photos = memoryStore<Blob>();
  setSavedPhotosStore(photos.store);
  setSavedReadsBackend(memoryStore<unknown>().store);
  setSavedReadsOwner('alice');
});
afterEach(() => {
  cleanup();
  setSavedReadsOwner(null);
  setSavedPhotosStore(null);
  setSavedReadsBackend(null);
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('label photos kept on the phone', () => {
  it('keeps the small photo and hands it back when the server cannot be reached', async () => {
    expect(await photoKeepingCopy('p1', 'thumbnail', async () => small)).toEqual({ photo: small, standIn: false });
    await settle();
    expect(await photoKeepingCopy('p1', 'thumbnail', offline)).toEqual({ photo: small, standIn: false });
  });

  it('does not keep full-size photos, and offers the small one in their place offline', async () => {
    await photoKeepingCopy('p1', 'original', async () => large);
    await settle();
    expect(await recallPhoto('p1')).toBeUndefined();
    await photoKeepingCopy('p1', 'thumbnail', async () => small);
    await settle();
    expect(await photoKeepingCopy('p1', 'original', offline)).toEqual({ photo: small, standIn: true });
  });

  it('never covers a real answer from the server, such as a deleted photo', async () => {
    await photoKeepingCopy('p1', 'thumbnail', async () => small);
    await settle();
    await expect(
      photoKeepingCopy('p1', 'thumbnail', () => Promise.reject(new Error('Image failed (404)'))),
    ).rejects.toThrow('404');
  });

  it('fails as before when a photo was never seen on this phone', async () => {
    await expect(photoKeepingCopy('never', 'thumbnail', offline)).rejects.toThrow('Failed to fetch');
  });

  it('keeps accounts apart and deletes photos on sign-out', async () => {
    await photoKeepingCopy('p1', 'thumbnail', async () => small);
    await settle();
    setSavedReadsOwner('bob');
    await settle();
    expect(photos.scopes.has('alice')).toBe(false);
    expect(await recallPhoto('p1')).toBeUndefined();
    await photoKeepingCopy('p2', 'thumbnail', async () => small);
    await settle();
    setSavedReadsOwner(null);
    await settle();
    expect(photos.scopes.size).toBe(0);
    await photoKeepingCopy('p3', 'thumbnail', async () => small);
    await settle();
    expect(photos.scopes.size).toBe(0);
  });

  it('shows the kept label on a wine card with no connection', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    URL.createObjectURL = vi.fn(() => 'blob:kept-label');
    URL.revokeObjectURL = vi.fn();
    await photoKeepingCopy('offline-card', 'thumbnail', async () => small);
    await settle();
    vi.stubGlobal('fetch', vi.fn(offline));
    const { getByAltText } = render(<WineImage imageId="offline-card" alt="Dujac label" />);
    await waitFor(() => expect(getByAltText('Dujac label').getAttribute('src')).toBe('blob:kept-label'));
    expect(URL.createObjectURL).toHaveBeenCalledWith(small);
  });
});
