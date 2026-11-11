// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type QueryModule = typeof import('../../src/lib/query/client');
let query: QueryModule;
let root: Root | null = null;
let host: HTMLDivElement | null = null;

const settle = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));

async function show(node: React.ReactNode) {
  act(() => root?.unmount());
  host?.remove();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(node);
  });
}

beforeEach(async () => {
  vi.resetModules();
  vi.unstubAllGlobals();
  query = await import('../../src/lib/query/client');
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function Reader({ name, load }: { name: string; load: () => Promise<string> }) {
  const { data, loading, error, retry } = query.useLoad([name], load);
  return (
    <p>
      {loading ? 'loading' : error ? `error: ${error}` : data}
      <button type="button" onClick={retry}>
        again
      </button>
    </p>
  );
}

describe('reading something for a screen', () => {
  it('says it is loading, then shows the answer', async () => {
    let finish: (value: string) => void = () => undefined;
    const load = vi.fn(() => new Promise<string>((resolve) => (finish = resolve)));
    await show(<Reader name="a" load={load} />);
    expect(host!.textContent).toContain('loading');
    await act(async () => finish('first'));
    expect(host!.textContent).toContain('first');
  });

  it('makes one request when two parts of a screen ask for the same thing', async () => {
    const load = vi.fn(async () => 'shared');
    await show(
      <>
        <Reader name="a" load={load} />
        <Reader name="a" load={load} />
      </>,
    );
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
    expect(host!.textContent).toBe('sharedagainsharedagain');
  });

  it('shows the earlier answer at once on coming back, and asks again behind it', async () => {
    const answers = ['first', 'second'];
    const load = vi.fn(async () => answers.shift()!);
    await show(<Reader name="a" load={load} />);
    await settle();
    let release: () => void = () => undefined;
    const slow = vi.fn(() => new Promise<string>((resolve) => (release = () => resolve(answers.shift()!))));
    await show(<Reader name="a" load={slow} />);
    expect(host!.textContent, 'no loading state for something already read').toContain('first');
    await act(async () => release());
    expect(host!.textContent).toContain('second');
  });

  it('reports a failure and recovers when asked again, without retrying by itself', async () => {
    let attempt = 0;
    const load = vi.fn(async () => {
      if (++attempt === 1) throw new Error('No connection');
      return 'recovered';
    });
    await show(<Reader name="a" load={load} />);
    await settle();
    expect(host!.textContent).toContain('error: No connection');
    expect(load, 'the screen offers its own Try again').toHaveBeenCalledTimes(1);
    await act(async () => host!.querySelector('button')!.click());
    await settle();
    expect(host!.textContent).toContain('recovered');
  });

  it('keeps an answer on screen when a later refresh fails', async () => {
    const load = vi.fn(async () => 'kept');
    await show(<Reader name="a" load={load} />);
    await settle();
    const failing = vi.fn(async () => {
      throw new Error('No connection');
    });
    await show(<Reader name="a" load={failing} />);
    await settle();
    expect(failing).toHaveBeenCalledTimes(1);
    expect(host!.textContent).toContain('kept');
  });
});

describe('a write makes earlier answers a guess', () => {
  const respond = (status: number) =>
    vi.fn(async () => new Response('{}', { status, headers: { 'content-type': 'application/json' } }));

  it('drops what closed screens had read, so reopening one loads afresh', async () => {
    const load = vi.fn(async () => 'before the write');
    await show(<Reader name="a" load={load} />);
    await settle();
    await show(null);
    vi.stubGlobal('fetch', respond(200));
    const { apiFetch } = await import('../../src/lib/auth/client');
    await apiFetch('/api/tastings/t1', { method: 'DELETE' });
    const slow = vi.fn(() => new Promise<string>(() => undefined));
    await show(<Reader name="a" load={slow} />);
    expect(host!.textContent).toContain('loading');
  });

  it('asks again for a screen that is open', async () => {
    const answers = ['before', 'after'];
    const load = vi.fn(async () => answers.shift()!);
    await show(<Reader name="a" load={load} />);
    await settle();
    vi.stubGlobal('fetch', respond(200));
    const { apiFetch } = await import('../../src/lib/auth/client');
    await act(async () => void (await apiFetch('/api/tastings', { method: 'POST', body: '{}' })));
    await settle();
    expect(host!.textContent).toContain('after');
  });

  it.each([
    ['a read', 'GET', 200],
    ['a write that was refused', 'POST', 500],
  ])('leaves answers alone after %s', async (_label, method, status) => {
    const load = vi.fn(async () => 'still true');
    await show(<Reader name="a" load={load} />);
    await settle();
    vi.stubGlobal('fetch', respond(status));
    const { apiFetch } = await import('../../src/lib/auth/client');
    await act(async () => void (await apiFetch('/api/tastings', { method })));
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('forgets everything when the account changes', async () => {
    const load = vi.fn(async () => 'someone else’s');
    await show(<Reader name="a" load={load} />);
    await settle();
    await show(null);
    const { clearSession } = await import('../../src/lib/auth/client');
    clearSession();
    expect(query.queryClient.getQueryData(['a'])).toBeUndefined();
  });
});

describe('a summary read outside a screen', () => {
  const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => (resolve = done));
    return { promise, resolve };
  };
  const summary = { summary: true };

  it('shares concurrent requests and reuses the answer for thirty seconds', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const reply = deferred<number>();
    const load = vi.fn(() => reply.promise);
    const first = query.readShared(['s'], load, summary);
    const second = query.readShared(['s'], load, summary);
    reply.resolve(1);
    expect(await first).toBe(1);
    expect(await second).toBe(1);
    expect(await query.readShared(['s'], load, summary)).toBe(1);
    expect(load).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(31_001);
    await query.readShared(['s'], load, summary);
    expect(load).toHaveBeenCalledTimes(2);
    clock.mockRestore();
  });

  it('does not restore an answer from before it was discarded', async () => {
    const old = deferred<number>();
    const load = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue(2);
    const first = query.readShared(['s'], load, summary);
    await Promise.resolve();
    query.discard(['s']);
    old.resolve(1);
    expect(await first, 'the caller in flight gets the answer asked for afterwards').toBe(2);
    expect(await query.readShared(['s'], load, summary)).toBe(2);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('asks again after a failure instead of keeping it', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(2);
    await expect(query.readShared(['s'], load, summary)).rejects.toThrow('offline');
    expect(await query.readShared(['s'], load, summary)).toBe(2);
  });

  it('is left alone by an ordinary write, and dropped by discard', async () => {
    const load = vi.fn(async () => 1);
    await query.readShared(['s'], load, summary);
    query.dataChanged();
    await query.readShared(['s'], load, summary);
    expect(load, 'a cellar write must not throw away a count that is still true').toHaveBeenCalledTimes(1);
    query.discard(['s']);
    await query.readShared(['s'], load, summary);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('is not shared between accounts', async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ user: { id: 'a' } }))
        .mockResolvedValueOnce(Response.json({ user: { id: 'b' } })),
    );
    const { bootstrapAccount, clearSession } = await import('../../src/lib/auth/client');
    await bootstrapAccount();
    const load = vi.fn().mockResolvedValueOnce(1).mockResolvedValue(2);
    expect(await query.readShared(['s'], load, summary)).toBe(1);
    await bootstrapAccount();
    expect(await query.readShared(['s'], load, summary)).toBe(2);
    clearSession();
    await query.readShared(['s'], load, summary);
    expect(load).toHaveBeenCalledTimes(3);
  });
});

describe('a screen that edits what it loaded', () => {
  it('shows the saved record at once, without another read', async () => {
    const load = vi.fn(async () => ({ name: 'Before' }));
    function Editor() {
      const { data } = query.useLoad(['record'], load);
      return <p>{data?.name}</p>;
    }
    await show(<Editor />);
    await settle();
    await act(async () => query.setLoaded<{ name: string }>(['record'], (record) => ({ ...record, name: 'After' })));
    expect(host!.textContent).toBe('After');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('changes nothing when the record has not been read', () => {
    const change = vi.fn((record: { name: string }) => record);
    query.setLoaded<{ name: string }>(['unread'], change);
    expect(change).not.toHaveBeenCalled();
    expect(query.queryClient.getQueryData(['unread'])).toBeUndefined();
  });

  it('waits, still loading, while there is no id to ask about', async () => {
    const load = vi.fn(async () => 'never');
    function Waiting() {
      const { loading } = query.useLoad(['record', ''], load, { skip: true });
      return <p>{loading ? 'loading' : 'done'}</p>;
    }
    await show(<Waiting />);
    await settle();
    expect(host!.textContent).toBe('loading');
    expect(load).not.toHaveBeenCalled();
  });
});

describe('answers with their own rules', () => {
  it('reads a pinned answer once, through writes, until it is discarded', async () => {
    const load = vi.fn(async () => 'open tasting');
    const pinned = { pinned: true };
    await query.readShared(['p'], load, pinned);
    query.dataChanged();
    await query.readShared(['p'], load, pinned);
    expect(load).toHaveBeenCalledTimes(1);
    query.discard(['p']);
    await query.readShared(['p'], load, pinned);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('keeps the last page on screen, marked as loading, while the next one arrives', async () => {
    let finish: (value: string) => void = () => undefined;
    const pages: Record<number, () => Promise<string>> = {
      0: async () => 'page one',
      1: () => new Promise<string>((resolve) => (finish = resolve)),
    };
    function Pager({ page }: { page: number }) {
      const { data, loading } = query.useLoad(['list', page], pages[page], { keepPrevious: true });
      return (
        <p>
          {data}
          {loading ? ' (loading)' : ''}
        </p>
      );
    }
    await show(<Pager page={0} />);
    await settle();
    expect(host!.textContent).toBe('page one');
    await act(async () => root!.render(<Pager page={1} />));
    expect(host!.textContent).toBe('page one (loading)');
    await act(async () => finish('page two'));
    expect(host!.textContent).toBe('page two');
  });

  it('hands a signal to a loader that asks for one, and abandons it when the screen closes', async () => {
    let seen: AbortSignal | undefined;
    const load = vi.fn((signal: AbortSignal) => {
      seen = signal;
      return new Promise<string>(() => undefined);
    });
    function Abortable() {
      query.useLoad(['abortable'], load);
      return null;
    }
    await show(<Abortable />);
    expect(seen?.aborted).toBe(false);
    await show(null);
    expect(seen?.aborted).toBe(true);
  });
});

describe('screens moved onto the shared loader', () => {
  const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

  it.each([
    'src/features/tastings/TastingsPage.tsx',
    'src/features/producers/ProducersPage.tsx',
    'src/features/journey/PassportPage.tsx',
    'src/features/achievements/AchievementsPage.tsx',
    'src/features/achievements/AchievementDetailPage.tsx',
  ])('%s no longer keeps its own loading and error state', (path) => {
    const text = source(path);
    expect(text).toMatch(/useLoad\(|useJourneyData\(|useAchievementProgress\(/);
    expect(text).not.toMatch(/setLoading|setError|useEffect/);
  });
});

describe('detail pages show the shared copy of their record', () => {
  const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

  it.each([
    ['src/features/tastings/TastingDetailPage.tsx', /useState<Tasting\|null>/],
    ['src/features/wines/DetailPage.tsx', /useState<WineDetail>/],
    ['src/features/producers/ProducerDetailPage.tsx', /useState<ProducerDetail>/],
  ])('%s keeps no private copy', (path, privateCopy) => {
    const text = source(path);
    expect(text).toMatch(/useLoad\(/);
    expect(text).not.toMatch(privateCopy);
  });
});
