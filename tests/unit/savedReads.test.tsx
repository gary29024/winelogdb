// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readKeepingCopy,
  recallRead,
  savedLabel,
  setSavedReadsBackend,
  setSavedReadsOwner,
  type SavedRead,
  type SavedReadsBackend,
} from '../../src/lib/offline/savedReads';
import { connectionReturned, oldestSavedCopyOnScreen, readShared, useLoad } from '../../src/lib/query/client';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** A stand-in for the browser's database: one map per account. */
function memoryBackend() {
  const scopes = new Map<string, Map<string, SavedRead>>();
  const backend: SavedReadsBackend = {
    get: async (scope, key) => scopes.get(scope)?.get(key),
    put: async (scope, key, saved) =>
      void (scopes.get(scope) ?? scopes.set(scope, new Map()).get(scope)!).set(key, saved),
    clear: async (scope) => void scopes.delete(scope),
  };
  return { backend, scopes };
}

const offline = () => new TypeError('Failed to fetch');
const settle = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));

let store: ReturnType<typeof memoryBackend>;
let root: Root | null = null;
let host: HTMLDivElement | null = null;
beforeEach(() => {
  store = memoryBackend();
  setSavedReadsBackend(store.backend);
  setSavedReadsOwner('alice');
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = host = null;
  setSavedReadsOwner(null);
  setSavedReadsBackend(null);
  localStorage.clear();
});

describe('saved copies of what a screen loaded', () => {
  it('hands back the saved copy when the server cannot be reached', async () => {
    expect(await readShared(['producers'], async () => ({ items: ['Dujac'] }))).toEqual({ items: ['Dujac'] });
    await settle();
    connectionReturned(); // drop what is in memory, as closing the app would
    const again = await readShared(['producers'], async () => Promise.reject(offline()));
    expect(again).toEqual({ items: ['Dujac'] });
  });

  it('still fails when nothing was ever saved for that screen', async () => {
    await expect(readShared(['tastings'], async () => Promise.reject(offline()))).rejects.toThrow('Failed to fetch');
  });

  it('never covers a real answer from the server, such as "not found"', async () => {
    await readShared(['wine', 'w1'], async () => ({ id: 'w1' }));
    await settle();
    connectionReturned();
    await expect(readShared(['wine', 'w1'], async () => Promise.reject(new Error('Wine not found')))).rejects.toThrow(
      'Wine not found',
    );
  });

  it('keeps each account apart and deletes copies on sign-out', async () => {
    await readShared(['producers'], async () => ({ items: ['Dujac'] }));
    await settle();
    expect(await recallRead(['producers'])).toMatchObject({ value: { items: ['Dujac'] } });
    setSavedReadsOwner('bob');
    await settle();
    expect(await recallRead(['producers'])).toBeUndefined();
    expect(store.scopes.has('alice')).toBe(false);
    setSavedReadsOwner(null);
    expect(await recallRead(['producers'])).toBeUndefined();
  });

  it('tells the offline bar which screen is showing a saved copy, and stops once it is fresh', async () => {
    await readShared(['producers'], async () => ({ items: ['Dujac'] }));
    await settle();
    connectionReturned();
    const load = vi.fn<() => Promise<{ items: string[] }>>().mockRejectedValueOnce(offline());
    function Screen() {
      const { data, failed } = useLoad(['producers'], load);
      return <p>{failed ? 'failed' : (data?.items.join(',') ?? 'loading')}</p>;
    }
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root!.render(<Screen />));
    await settle();
    expect(host.textContent).toBe('Dujac');
    expect(oldestSavedCopyOnScreen()).toBeGreaterThan(0);

    load.mockResolvedValueOnce({ items: ['Dujac', 'Roulot'] });
    await act(async () => connectionReturned());
    await settle();
    expect(host.textContent).toBe('Dujac,Roulot');
    expect(oldestSavedCopyOnScreen()).toBe(0);
  });
});

describe('the Journal list', () => {
  it('gets the saved copy of the same view back', async () => {
    const key = ['journal', 'query=dujac'];
    await readKeepingCopy(key, async () => ({ items: ['w1'], total: 1 }));
    await settle();
    const again = await readKeepingCopy(key, async () => Promise.reject(offline()));
    expect(again).toEqual({ items: ['w1'], total: 1 });
  });

  it('keeps a different search apart', async () => {
    await readKeepingCopy(['journal', 'query=dujac'], async () => ({ items: ['w1'] }));
    await settle();
    await expect(readKeepingCopy(['journal', 'query=roulot'], async () => Promise.reject(offline()))).rejects.toThrow(
      'Failed to fetch',
    );
  });

  it('reads through the shared loader, which keeps the copy and reloads when the signal returns', async () => {
    const { readFileSync } = await import('node:fs');
    const page = readFileSync('src/features/wines/LibraryPage.tsx', 'utf8');
    // Named after the exact view, so the copies saved before this change are still found.
    expect(page).toContain("useMemo(()=>['journal',queryKey] as const,[queryKey])");
    expect(page).toContain('useLoad<JournalPage>(journalKey,signal=>listWines(params,');
    expect(page).not.toMatch(/readKeepingCopy|addEventListener\('online'/);
  });
});

describe('how the offline bar words the date', () => {
  const now = new Date(2026, 10, 12, 15, 0).getTime();
  it('says today, yesterday, or the day', () => {
    expect(savedLabel(new Date(2026, 10, 12, 9, 5).getTime(), now)).toBe('today at 09:05');
    expect(savedLabel(new Date(2026, 10, 11, 23, 30).getTime(), now)).toBe('yesterday at 23:30');
    expect(savedLabel(new Date(2026, 10, 3, 18, 20).getTime(), now)).toBe('on 3 Nov at 18:20');
  });
});
