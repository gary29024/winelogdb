import { build } from 'esbuild';
import { unstable_readConfig } from 'wrangler';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import type { Browser, Page } from '@playwright/test';

const run = promisify(execFile);
const clientId = 'local-journey.apps.googleusercontent.com';
const sha256 = (value: string) => createHash('sha256').update(value).digest('base64url');
// Resolve from Wrangler, not the project: npm/Bun may install different copies.
// The journey must use the same Miniflare/workerd as migrations and runtime smoke.
const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler'));
const miniflare = wranglerRequire('miniflare');

export async function startStack() {
  await mkdir('.tmp/sharing-journey', { recursive: true });
  const root = resolve('.tmp/sharing-journey');
  const directory = await mkdtemp(join(root, 'run-'));
  const production = unstable_readConfig({ config: resolve('wrangler.jsonc') }, { hideWarnings: true });
  if (!production.main) throw new Error('Missing production Worker entrypoint');
  if (!Array.isArray(production.assets?.run_worker_first) || !production.assets.run_worker_first.includes('/api/*')) throw new Error('Missing production API routing invariant');
  console.log('Local runtime versions:', { wrangler: require('wrangler/package.json').version, miniflare: wranglerRequire('miniflare/package.json').version });
  const config = join(directory, 'wrangler.json');
  const persist = join(directory, 'state');
  await writeFile(config, JSON.stringify({
    name: 'sharing-journey-local', main: resolve(production.main),
    compatibility_date: production.compatibility_date,
    d1_databases: [{ binding: 'DB', database_name: 'journey', database_id: 'journey', migrations_dir: resolve('src/lib/db/migrations') }],
  }));
  // Wrangler applies the real migration sequence to a fresh, isolated local D1.
  const migration = await run(process.execPath, [resolve('node_modules/wrangler/bin/wrangler.js'),
    'd1', 'migrations', 'apply', 'DB', '--local', '--config', config, '--persist-to', persist], {
    env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_PATH: join(directory, 'wrangler.log') },
    maxBuffer: 4 * 1024 * 1024,
  });
  await writeFile(join(directory, 'migrations.log'), migration.stdout + migration.stderr);
  console.log('Local D1 migrations applied:', directory);
  const bundle = join(directory, 'worker.mjs');
  await build({ entryPoints: [production.main], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', outfile: bundle });
  const keys = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(keys.publicKey), kid: 'journey', alg: 'RS256', use: 'sig' };
  const codes = new Map<string, { name: string; nonce: string; challenge: string }>();
  const providerCalls: Array<{ kind: string; texts?: string[] }> = [];
  const unexpectedOutbound: string[] = [];
  let origin = '';
  const options = {
    name: 'journey', modules: true, scriptPath: bundle, compatibilityDate: production.compatibility_date,
    host: '127.0.0.1', port: 0, cf: false,
    resourcePersistencePath: join(persist, 'v3'),
    d1Databases: { DB: 'journey' }, d1Persist: join(persist, 'v3/d1'),
    r2Buckets: { WINE_IMAGES: 'journey-images', REFERENCE_DATA: 'journey-images' }, r2Persist: join(persist, 'v3/r2'),
    images: { binding: 'IMAGES' },
    queueProducers: { RESEARCH_QUEUE: 'journey-research' },
    assets: { directory: resolve('dist/client'), binding: 'ASSETS', run_worker_first: ['/api/*'], routerConfig: { has_user_worker: true }, assetConfig: { not_found_handling: 'single-page-application' } },
    bindings: {
      APP_URL: 'http://127.0.0.1', AUTH_SECRET: 'local-journey-only-secret-0123456789abcdef',
      GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: 'local-fake-secret', OWNER_EMAIL: 'owner@example.test',
      SEMANTIC_SEARCH_PROVIDER: 'gemini', SEMANTIC_GEMINI_API_KEY: 'local-fake-key', SEMANTIC_GEMINI_DIMENSIONS: '128',
    },
    // Deny all unlisted provider traffic. No real credentials, remote bindings or paid calls.
    outboundService: async (request: Request) => {
      const url = new URL(request.url);
      if (url.href === 'https://www.googleapis.com/oauth2/v3/certs') return Response.json({ keys: [jwk] });
      if (url.href === 'https://oauth2.googleapis.com/token') {
        const form = new URLSearchParams(await request.text()), code = form.get('code') ?? '', flow = codes.get(code);
        codes.delete(code);
        if (!flow || sha256(form.get('code_verifier') ?? '') !== flow.challenge || form.get('redirect_uri') !== `${origin}/api/auth/google/callback` || form.get('client_id') !== clientId) return Response.json({ error: 'invalid_grant' }, { status: 400 });
        providerCalls.push({ kind: 'oauth' });
        const token = await new SignJWT({ nonce: flow.nonce, email: `${flow.name}@example.test`, email_verified: true, name: flow.name })
          .setProtectedHeader({ alg: 'RS256', kid: 'journey' }).setSubject(`google-${flow.name}`)
          .setIssuer('https://accounts.google.com').setAudience(clientId).setIssuedAt().setExpirationTime('5m').sign(keys.privateKey);
        return Response.json({ id_token: token });
      }
      if (url.hostname === 'generativelanguage.googleapis.com' && url.pathname.endsWith(':batchEmbedContents')) {
        const payload = await request.json() as { requests: Array<{ content: { parts: Array<{ text: string }> } }> };
        const texts = payload.requests.map(item => item.content.parts.map(part => part.text).join('\n'));
        providerCalls.push({ kind: 'embedding', texts });
        return Response.json({ embeddings: texts.map(() => ({ values: [1, ...Array(127).fill(0)] })) });
      }
      unexpectedOutbound.push(url.origin + url.pathname);
      return Response.json({ error: 'Unexpected outbound request blocked by local test' }, { status: 502 });
    },
  };
  // Miniflare v5 adapts the v4 options; resolve the adapter from the same module.
  const convert = miniflare.convertV4MiniflareOptions;
  const mf = new miniflare.Miniflare(convert ? convert(options) : options);
  try {
    origin = (await mf.ready).origin;
    options.port = Number(new URL(origin).port);
    options.bindings.APP_URL = origin;
    await mf.setOptions(convert ? convert(options) : options);
    const db: D1Database = await mf.getD1Database('DB');
    const migrationCount = (await readdir('src/lib/db/migrations')).filter(file => file.endsWith('.sql')).length;
    const applied = await db.prepare('SELECT count(*) AS n FROM d1_migrations').first('n');
    if (applied !== migrationCount) throw new Error(`D1 migrations: expected ${migrationCount}, got ${applied}`);
    console.log('Serving migrated D1:', applied);
    // The migration defaults to one pilot member. This synthetic isolation
    // fixture needs a recipient and an unrelated member; allowance rules stay intact.
    await db.prepare("UPDATE pilot_settings SET value_json=json_set(value_json,'$.memberLimit',2) WHERE id=1").run();
    const bucket: R2Bucket = await mf.getR2Bucket('WINE_IMAGES');
    async function signIn(browser: Browser, name: string) {
      const context = await browser.newContext();
      await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient'));
      const page = await context.newPage();
      let invitation = '';
      if (name !== 'owner') {
        invitation = randomUUID();
        const tokenHash = createHash('sha256').update(invitation).digest('hex');
        await db.prepare('INSERT INTO member_invitations(token_hash,email,created_by,expires_at) VALUES(?,?,?,?)')
          .bind(tokenHash, `${name}@example.test`, 'owner', Math.floor(Date.now() / 1000) + 3600).run();
      }
      await page.goto(`${origin}/login${invitation ? `?invitation=${invitation}` : ''}`);
      const startPath = await page.getByRole('link', { name: /Google/ }).getAttribute('href');
      if (!startPath?.startsWith('/api/auth/google/start')) throw new Error('Missing OAuth login link');
      // Stop the real HTTP start response at Google's authorization boundary.
      // The context request client shares the browser's real cookie jar. Browser
      // routing does not reliably intercept cross-origin redirect chains.
      const start = await context.request.get(origin + startPath, { maxRedirects: 0 });
      if (start.status() !== 302) throw new Error(`OAuth start: ${start.status()}`);
      const authorization = new URL(start.headers().location);
      if (authorization.origin !== 'https://accounts.google.com') throw new Error('Unexpected OAuth provider');
      const code = randomUUID();
      codes.set(code, { name, nonce: authorization.searchParams.get('nonce')!, challenge: authorization.searchParams.get('code_challenge')! });
      const callback = await page.goto(`${origin}/api/auth/google/callback?state=${encodeURIComponent(authorization.searchParams.get('state')!)}&code=${code}`);
      if (!callback?.ok()) throw new Error(`OAuth callback failed: ${await callback?.text()}`);
      await page.waitForURL(origin + '/', { timeout: 15_000 });
      const me = await api(page, '/api/me');
      if (me.status !== 200) throw new Error(`Sign-in failed: ${JSON.stringify(me)}`);
      console.log('Verified signed OAuth session:', name);
      return { page, context, user: me.body.user };
    }
    async function close({ preserve = false } = {}) {
      await mf.dispose();
      if (preserve) return;
      // Verify the resolved deletion target stays directly inside this harness's
      // temp root, including on Windows where a junction can change resolution.
      const target = await realpath(directory), parent = await realpath(root);
      if (dirname(target) !== parent || !basename(target).startsWith('run-')) throw new Error(`Unsafe stack cleanup target: ${target}`);
      await rm(target, { recursive: true, force: true, maxRetries: 3 });
    }
    return { origin, directory, db, bucket, providerCalls, unexpectedOutbound, signIn, close };
  } catch (error) { await mf.dispose(); throw error; }
}

// Security probes also traverse the browser network and production router.
export async function api(page: Page, path: string, method = 'GET', data?: unknown) {
  return page.evaluate(async ({ path, method, data }) => {
    const response = await fetch(path, { method, ...(data === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }) });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null, headers: Object.fromEntries(response.headers) };
  }, { path, method, data });
}
