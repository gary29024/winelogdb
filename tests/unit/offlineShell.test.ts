// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fillShell, shellFiles, shellVersion } from '../../src/lib/offline/shellFiles';

const template = readFileSync('src/lib/offline/serviceWorker.template.js', 'utf8');

/** Run the service worker file against a stand-in browser and hand back its request planner. */
function loadPlanner() {
  const listeners: Record<string, unknown> = {};
  const self = {
    location: { origin: 'https://winelog.example' },
    addEventListener: (name: string, handler: unknown) => (listeners[name] = handler),
  };
  const source = fillShell(template, { version: 'v1', files: ['/assets/a.js'] });
  const plan = new Function('self', 'caches', 'fetch', `${source}\nreturn plan;`)(self, {}, () => null) as (request: {
    method: string;
    url: string;
    mode?: string;
  }) => string;
  return { plan, listeners };
}

describe('which built files the phone keeps', () => {
  it('keeps scripts and styles but not the heavy single-screen files', () => {
    expect(
      shellFiles([
        'assets/index-abc.js',
        'assets/index-abc.css',
        'assets/corton.evidence-xyz.js',
        'assets/VillageMap-123.js',
        'index.html',
        'assets/logo.png',
      ]),
    ).toEqual(['/assets/index-abc.css', '/assets/index-abc.js']);
  });

  it('gets a new version whenever a kept file changes', () => {
    expect(shellVersion(['/assets/a-1.js'])).not.toBe(shellVersion(['/assets/a-2.js']));
    expect(shellVersion(['/assets/a-1.js'])).toBe(shellVersion(['/assets/a-1.js']));
  });
});

describe('filling the service worker template', () => {
  it('produces a script with no placeholder left in it', () => {
    const filled = fillShell(template, { version: 'v1', files: ['/assets/a.js'] });
    expect(filled).not.toContain('__SHELL__');
    expect(filled).toContain('const SHELL = {"version":"v1","files":["/assets/a.js"]};');
  });

  it('refuses a template whose slot is missing or repeated', () => {
    expect(() => fillShell('nothing here', { version: 'v1', files: [] })).toThrow('exactly once');
  });
});

describe('what the service worker answers itself', () => {
  const { plan, listeners } = loadPlanner();
  const get = (path: string, mode = 'cors') => plan({ method: 'GET', url: `https://winelog.example${path}`, mode });

  it('never answers data, sign-in or maps from a saved copy', () => {
    expect(get('/api/me')).toBe('network');
    expect(get('/api/journal?query=x')).toBe('network');
    expect(get('/maps/lossless/a.json')).toBe('network');
    expect(plan({ method: 'POST', url: 'https://winelog.example/assets/a.js' })).toBe('network');
    expect(plan({ method: 'GET', url: 'https://elsewhere.example/assets/a.js' })).toBe('network');
  });

  it('serves the app itself from the phone', () => {
    expect(get('/assets/index-abc.js')).toBe('cache-first');
    expect(get('/icons/icon-192.png')).toBe('cache-first');
    expect(plan({ method: 'GET', url: 'https://fonts.gstatic.com/s/x.woff2' })).toBe('cache-first');
  });

  it('tries the network first for a page and falls back to the saved one', () => {
    expect(get('/wines/w1', 'navigate')).toBe('page');
    expect(Object.keys(listeners).sort()).toEqual(['activate', 'fetch', 'install']);
  });
});

describe('opening the app with no signal', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
  });
  const user = { id: 'alice', email: 'a@example.com', display_name: 'Alice', role: 'member', status: 'active' };
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('opens as the person last seen here when the request cannot leave the phone', async () => {
    vi.resetModules();
    const { bootstrapAccount, hasSession, clearSession } = await import('../../src/lib/auth/client');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply({ user })));
    await bootstrapAccount();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect((await bootstrapAccount())?.id).toBe('alice');
    expect(hasSession()).toBe(true);
    // Signing out forgets them, so the next offline start asks for sign-in.
    clearSession();
    await expect(bootstrapAccount()).rejects.toThrow('Failed to fetch');
    expect(hasSession()).toBe(false);
  });

  it('forgets the person when the server says they are signed out', async () => {
    vi.resetModules();
    const { bootstrapAccount, hasSession } = await import('../../src/lib/auth/client');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply({ user })));
    await bootstrapAccount();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply({ error: 'Unauthorized' }, 401)));
    expect(await bootstrapAccount()).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(bootstrapAccount()).rejects.toThrow('Failed to fetch');
    expect(hasSession()).toBe(false);
  });
});
