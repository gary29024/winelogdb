// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null,
  host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.unstubAllGlobals();
});

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

const producers = [
  {
    id: 'p1',
    canonicalName: 'Domaine Roulot',
    homeCountry: 'France',
    homeRegion: 'Burgundy',
    homeLocality: 'Meursault',
    tastedCount: 2,
    catalogCount: 0,
    researchedAt: null,
  },
  {
    id: 'p2',
    canonicalName: 'Domaine Dujac',
    homeCountry: 'France',
    homeRegion: 'Burgundy',
    homeLocality: 'Morey-Saint-Denis',
    tastedCount: 1,
    catalogCount: 0,
    researchedAt: null,
  },
];
const tastings = [
  {
    id: 't1',
    name: 'Roulot evening',
    tastingDate: '2026-08-28',
    venue: 'Clubhouse',
    startedAt: null,
    endedAt: null,
    lastWineAt: null,
    createdAt: '2026-08-28T10:00:00.000Z',
    updatedAt: '2026-08-28T10:00:00.000Z',
    wineCount: 4,
    averageRating: 93,
  },
  {
    id: 't2',
    name: 'Rhône night',
    tastingDate: '2026-07-01',
    venue: null,
    startedAt: null,
    endedAt: null,
    lastWineAt: null,
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z',
    wineCount: 2,
    averageRating: null,
  },
];
const wines = [
  {
    id: 'w1',
    producer: 'Domaine Roulot',
    wineName: 'Meursault',
    vintage: 2021,
    appellation: 'Meursault',
    region: 'Burgundy',
    shared: false,
  },
  {
    id: 'w2',
    producer: 'Domaine Roulot',
    wineName: 'Bourgogne Blanc',
    vintage: 2020,
    appellation: null,
    region: 'Burgundy',
    shared: true,
  },
];

const tags = [
  { tag: 'Burgundy', wines: 27 },
  { tag: 'Pinot Noir', wines: 19 },
  { tag: 'birthday', wines: 1 },
  ...Array.from({ length: 11 }, (_, i) => ({ tag: `extra${i + 1}`, wines: 1 })),
];

async function render(
  path: string,
  wineReply: unknown = { items: wines, total: 9, nextOffset: null },
  tagReply: unknown = { items: [] },
) {
  const fetchMock = vi.fn(async (url: string) => {
    const address = String(url);
    if (address.includes('/api/tags')) return json(tagReply);
    if (address.includes('/api/journal')) return json(wineReply);
    if (address.includes('/api/producers')) return json({ items: producers });
    if (address.includes('/api/tastings')) return json({ items: tastings });
    return json({});
  });
  vi.stubGlobal('fetch', fetchMock);
  const { SearchPage } = await import('../../src/features/search/SearchPage');
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <MemoryRouter initialEntries={[path]}>
        <SearchPage />
      </MemoryRouter>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return fetchMock;
}

const links = () => [...host!.querySelectorAll('a.search-result')].map((a) => a.getAttribute('href'));
const called = (mock: ReturnType<typeof vi.fn>, part: string) =>
  mock.mock.calls.filter((call) => String(call[0]).includes(part));

describe('search everywhere', () => {
  it('asks nothing until two letters are typed', async () => {
    const fetchMock = await render('/search');
    // The one thing asked for is the list of hashtags to offer.
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual(['/api/tags']);
    expect(host!.textContent).toContain('Type at least two letters');
    expect(host!.querySelector('.search-tags')).toBeNull();
  });

  it('offers your hashtags before anything is typed, and a tap searches that hashtag', async () => {
    const fetchMock = await render('/search', { items: [wines[0]], total: 1, nextOffset: null }, { items: tags });
    const pills = () => [...host!.querySelectorAll('.search-tag')];
    expect(host!.querySelector('.search-tags h2')!.textContent).toBe('Your hashtags 14');
    // The most used come first; the rest wait behind "Show all".
    expect(pills()).toHaveLength(12);
    expect(pills()[1].textContent).toBe('#Pinot Noir19');
    expect(pills()[1].querySelector('small')!.getAttribute('aria-label')).toBe('19 wines');
    expect(pills()[2].querySelector('small')!.getAttribute('aria-label')).toBe('1 wine');
    await act(async () => {
      (host!.querySelector('.search-tags-all') as HTMLButtonElement).click();
    });
    expect(pills()).toHaveLength(14);

    await act(async () => {
      (pills()[1] as HTMLButtonElement).click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect((host!.querySelector('input[type=search]') as HTMLInputElement).value).toBe('#Pinot Noir');
    expect(called(fetchMock, '/api/journal').map((call) => String(call[0]))[0]).toContain('query=%23Pinot+Noir');
    expect(host!.querySelector('.search-tags')).toBeNull();
    expect(host!.querySelector('.search-group h2')!.textContent).toBe('Wines tagged #Pinot Noir 1');
  });

  it('shows wines, producers and tastings together for one search', async () => {
    const fetchMock = await render('/search?q=roulot');
    expect(links()).toEqual(['/wines/w1', '/shared/w2', '/producers/p1', '/tastings/t1']);
    expect([...host!.querySelectorAll('.search-group h2')].map((h) => h.textContent)).toEqual([
      'Wines 9',
      'Producers 1',
      'Tastings 1',
    ]);
    // The quick word search only: a small page, and never the paid Smart search.
    const wineCalls = called(fetchMock, '/api/journal');
    expect(wineCalls).toHaveLength(1);
    expect(String(wineCalls[0][0])).toContain('query=roulot');
    expect(String(wineCalls[0][0])).toContain('limit=6');
    expect(String(wineCalls[0][0])).not.toContain('semantic');
  });

  it('hands the full wine list over to the Journal', async () => {
    await render('/search?q=roulot');
    const more = host!.querySelector('a.search-more');
    expect(more?.getAttribute('href')).toBe('/journal?query=roulot');
    expect(more?.textContent).toBe('See all 9 wines in the Journal');
  });

  it('ignores accents and word order', async () => {
    await render('/search?q=night rhone', { items: [], total: 0, nextOffset: null });
    expect(links()).toEqual(['/tastings/t2']);
  });

  it('treats a search starting with # as a hashtag and looks at wines only', async () => {
    const fetchMock = await render('/search?q=%23birthday');
    expect(links()).toEqual(['/wines/w1', '/shared/w2']);
    expect(host!.querySelector('.search-group h2')?.textContent).toBe('Wines tagged #birthday 9');
    expect(String(called(fetchMock, '/api/journal')[0][0])).toContain('query=%23birthday');
    expect(called(fetchMock, '/api/producers')).toHaveLength(0);
    expect(called(fetchMock, '/api/tastings')).toHaveLength(0);
    expect(host!.querySelector('a.search-more')?.getAttribute('href')).toBe('/journal?query=%23birthday');
  });

  it('makes the hashtags on a wine page open that search', () => {
    const detail = readFileSync('src/features/wines/DetailPage.tsx', 'utf8');
    expect(detail).toContain('to={`/search?q=${encodeURIComponent(`#${t}`)}`}');
  });

  it('says so plainly when nothing matches', async () => {
    await render('/search?q=zzzz', { items: [], total: 0, nextOffset: null });
    expect(host!.textContent).toContain('Nothing found');
    expect(links()).toEqual([]);
  });

  it('is reachable from the top bar on every screen and has a route', () => {
    const layout = readFileSync('src/components/Layout.tsx', 'utf8');
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(layout).toMatch(/className="top-search-link" to="\/search" aria-label="Search"/);
    expect(app).toContain('<Route path="search" element={<SearchPage/>}/>');
  });
});
