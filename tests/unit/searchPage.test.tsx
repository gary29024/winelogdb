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

async function render(path: string, wineReply: unknown = { items: wines, total: 9, nextOffset: null }) {
  const fetchMock = vi.fn(async (url: string) => {
    const address = String(url);
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
    expect(fetchMock).not.toHaveBeenCalled();
    expect(host!.textContent).toContain('Type at least two letters');
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
