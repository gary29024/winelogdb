import { Hono, type Context, type Env, type Handler, type Next } from 'hono';
import { apiErrorHandler } from '../src/lib/credits/primitives';

/**
 * One app instead of apps inside apps.
 *
 * The API grew as a stack of Hono apps: each layer answered what it knew and
 * handed everything else to the layer beneath by calling that app's `fetch`,
 * which built a fresh request context and matched the address all over again -
 * up to five times for one request. The layers are now registered, outermost
 * first, on a single app. A request is matched once and walks one chain of
 * handlers; a layer hands a request on with `inward(c, next)`.
 *
 * Two behaviours of the old stack are kept on purpose, because handlers were
 * written against them:
 *
 *  - Handing a request on skips the rest of the caller's own layer. Calling the
 *    inner app's `fetch` never came back to a later route of the same layer, so
 *    `GET /api/producers/resolve` could be passed inward without being caught
 *    by that layer's own `GET /api/producers/:id`.
 *  - What a handler returns after handing on replaces the inner answer whole.
 *    Hono by itself ignores a response returned once a later handler has
 *    answered, and merges headers when one is assigned over another.
 */
type LayerApp = { routes: Array<{ method: string; path: string; handler: unknown }> };
type Walk = { layer: number; floor: number; handedOn: boolean };

const walks = new WeakMap<object, Walk>();
const walkOf = (c: object) => {
  let walk = walks.get(c);
  if (!walk) walks.set(c, (walk = { layer: -1, floor: -1, handedOn: false }));
  return walk;
};

/** Passes the request to the layers beneath this one and returns their answer. */
export async function inward(c: Context, next: Next): Promise<Response> {
  const walk = walkOf(c);
  walk.floor = Math.max(walk.floor, walk.layer);
  await next();
  const answer = c.res;
  // Taken off the context so that a response the caller builds next starts
  // clean, as it did when the inner layer had a context of its own.
  c.res = undefined;
  walk.handedOn = true;
  return answer;
}

function inLayer(layer: number, handler: Handler): Handler {
  return async (c, next) => {
    const walk = walkOf(c);
    if (layer <= walk.floor) return next();
    walk.layer = layer;
    walk.handedOn = false;
    const answer = await handler(c, next);
    if (walk.handedOn) {
      walk.handedOn = false;
      if (answer instanceof Response) c.res = answer;
    }
    return answer;
  };
}

/** Registers every layer's routes on one app, in order: the first layer is the outermost. */
export function composeLayers<E extends Env = Env>(layers: readonly LayerApp[]): Hono<E> {
  const app = new Hono<E>();
  app.onError(apiErrorHandler);
  layers.forEach((layer, index) => {
    for (const route of layer.routes) {
      const handler = inLayer(index, route.handler as Handler);
      if (route.method === 'ALL') app.all(route.path, handler);
      else app.on(route.method, route.path, handler);
    }
  });
  return app;
}
