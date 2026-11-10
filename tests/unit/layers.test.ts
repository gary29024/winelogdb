import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../src/lib/credits/primitives';
import { composeLayers, inward } from '../../worker/layers';
import { layers as stack } from '../../worker/researchQueueEntry';

const get = (app: Hono, path: string, headers: Record<string, string> = {}) =>
  app.fetch(new Request(`https://x${path}`, { headers }));

describe('composeLayers', () => {
  it('lets the outermost layer that declares an address answer it', async () => {
    const outer = new Hono().get('/a', (c) => c.text('outer'));
    const inner = new Hono().get('/a', (c) => c.text('inner')).get('/b', (c) => c.text('inner b'));
    const app = composeLayers([outer, inner]);
    expect(await (await get(app, '/a')).text()).toBe('outer');
    expect(await (await get(app, '/b')).text()).toBe('inner b');
    expect((await get(app, '/missing')).status).toBe(404);
  });

  it('hands a request to the layers beneath, skipping the rest of the caller’s own layer', async () => {
    // The shape of GET /api/producers/resolve: passed inward so that the same
    // layer's `/:id` route does not swallow it.
    const outer = new Hono()
      .get('/producers/resolve', (c, next) => inward(c, next))
      .get('/producers/:id', (c) => c.text(`outer ${c.req.param('id')}`));
    const inner = new Hono().get('/producers/resolve', (c) => c.text('inner resolve'));
    const app = composeLayers([outer, inner]);
    expect(await (await get(app, '/producers/resolve')).text()).toBe('inner resolve');
    expect(await (await get(app, '/producers/42')).text()).toBe('outer 42');
  });

  it('skips only the layers already passed, through several hand-offs', async () => {
    const seen: string[] = [];
    const top = new Hono()
      .get('/w', async (c, next) => {
        seen.push('top');
        return inward(c, next);
      })
      .get('/w', (c) => c.text('top again'));
    const middle = new Hono()
      .get('/w', async (c, next) => {
        seen.push('middle');
        const answer = await inward(c, next);
        return new Response(`middle(${await answer.text()})`);
      })
      .get('/w', (c) => c.text('middle again'));
    const bottom = new Hono().get('/w', (c) => {
      seen.push('bottom');
      return c.text('bottom');
    });
    const response = await get(composeLayers([top, middle, bottom]), '/w');
    expect(await response.text()).toBe('middle(bottom)');
    expect(seen).toEqual(['top', 'middle', 'bottom']);
  });

  it('replaces the inner answer whole when the caller returns its own', async () => {
    const outer = new Hono().get('/a', async (c, next) => {
      const answer = await inward(c, next);
      expect(answer.headers.get('ETag')).toBe('"inner"');
      return c.json({ wrapped: await answer.json() }, 201);
    });
    const inner = new Hono().get('/a', (c) => {
      c.header('ETag', '"inner"');
      return c.json({ ok: true });
    });
    const response = await get(composeLayers([outer, inner]), '/a');
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ wrapped: { ok: true } });
  });

  it('returns the inner answer untouched when the caller passes it straight back', async () => {
    const outer = new Hono().get('/a', async (c, next) => {
      const answer = await inward(c, next);
      return answer.ok ? answer : c.text('never');
    });
    const inner = new Hono().get('/a', (c) => c.json({ ok: true }, 200, { 'Cache-Control': 'no-store' }));
    const response = await get(composeLayers([outer, inner]), '/a');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ ok: true });
  });

  it('runs inner middleware only for requests that reach its layer', async () => {
    const outer = new Hono().get('/api/open', (c) => c.text('open'));
    const inner = new Hono();
    inner.use('/api/*', async (c, next) => {
      if (!c.req.header('X-Member')) return c.json({ error: 'Unauthorized' }, 401);
      await next();
    });
    inner.get('/api/guarded', (c) => c.text('guarded'));
    const app = composeLayers([outer, inner]);
    expect(await (await get(app, '/api/open')).text()).toBe('open');
    expect((await get(app, '/api/guarded')).status).toBe(401);
    expect(await (await get(app, '/api/guarded', { 'X-Member': 'm' })).text()).toBe('guarded');
  });

  it('turns an ApiError from any layer into its status, and lets other errors surface', async () => {
    const outer = new Hono().get('/a', (c, next) => inward(c, next));
    const inner = new Hono()
      .get('/a', () => {
        throw new ApiError(409, 'Conflict here');
      })
      .get('/b', () => {
        throw new Error('boom');
      });
    const app = composeLayers([outer, inner]);
    const conflict = await get(app, '/a');
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ error: 'Conflict here' });
    await expect(get(app, '/b')).rejects.toThrow('boom');
  });
});

describe('the API stack', () => {
  it('is five layers with no catch-all hand-offs left between them', () => {
    expect(stack).toHaveLength(5);
    // Only the innermost layer may match everything: its shared middleware and the static-asset fallback.
    for (const layer of stack.slice(0, -1)) {
      expect(layer.routes.filter((route) => route.path === '*' || route.method === 'ALL')).toEqual([]);
    }
  });
});
