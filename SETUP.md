# Setting up your own WineLog

A step-by-step guide to running this repository as your own private wine
notebook on Cloudflare.

WineLog is **single-tenant by design**: one deployment belongs to one person,
protected by one password. Every database row is owned by a fixed owner ID, so
there is no sign-up flow, no user table and no tenant separation to configure.
If two people want their own notebooks, they each deploy their own copy.

Budget about 30 minutes. Nothing here is irreversible, and every resource can be
deleted afterwards.

---

## What you are deploying

One Cloudflare Worker serves both the API and the built React app, backed by
four Cloudflare products:

| Resource | Binding | What it holds |
|---|---|---|
| D1 database | `DB` | Wines, tastings, producers, research cache, job state |
| R2 bucket | `WINE_IMAGES` | Original photos and recognition copies, private |
| Queue + dead-letter queue | `RESEARCH_QUEUE` | Background recognition and Deep Search jobs |
| Static assets | `ASSETS` | The built front end |

Gemini does label recognition and grounded research. Your API key and R2
bindings stay server-side; the browser never sees them.

---

## Prerequisites

- **Node 20 or newer** — `node --version`
- **A Cloudflare account.** D1, R2 and Queues all have free allowances. Check
  the current numbers on Cloudflare's pricing pages before committing to a
  workload; R2 in particular may ask for a payment method even within the free
  allowance.
- **A Google AI Studio (Gemini) API key** — <https://aistudio.google.com/apikey>
- **Wrangler**, which comes with the repo's dependencies. Every `wrangler`
  command below can be run as `npx wrangler …` without installing it globally.

---

## Step 1 — Get the code and sign in

```bash
git clone https://github.com/<your-account>/winelogdb.git
cd winelogdb
npm install
npx wrangler login
```

`wrangler login` opens a browser to authorise your account. If you work across
several Cloudflare accounts, run `npx wrangler whoami` afterwards and note the
account ID you intend to use.

---

## Step 2 — Create the Cloudflare resources

```bash
# D1 database — copy the database_id it prints
npx wrangler d1 create winelogdb

# Private R2 bucket
npx wrangler r2 bucket create winelog-private

# Queue and its dead-letter queue
npx wrangler queues create winelog-research
npx wrangler queues create winelog-research-dlq
```

Create the dead-letter queue even though nothing routine writes to it. The
consumer names it in `wrangler.jsonc`, and a deploy fails if it does not exist.

> **Keep the R2 bucket private.** Uploads and image reads pass through the
> authenticated Worker, which checks ownership before returning a photo. A
> public bucket would expose every image by URL.

---

## Step 3 — Point the config at *your* resources

`wrangler.jsonc` is committed with the original author's IDs. **Three values
must be replaced or your deploy will write into someone else's account or fail
outright.**

```jsonc
{
  "name": "winelogdb",                    // rename if you like; this becomes the worker name
  "d1_databases": [{
    "database_id": "PASTE_YOUR_OWN_ID"    // ← from `wrangler d1 create`
  }],
  "vars": {
    "AI_GATEWAY_ACCOUNT_ID": "…",         // ← yours, or delete (see Step 4)
    "VERTEX_PROJECT_ID": "…"              // ← yours, or delete (see Step 4)
  }
}
```

Leave `MAX_FILE_BYTES` (10 MiB) and `MAX_BATCH_FILES` (12) unless you have a
reason to change them.

---

## Step 4 — Choose how Gemini is called

Two transports are supported. **Pick one — a half-configured gateway fails
loudly at runtime rather than falling back.**

### Option A — Gemini API directly (recommended to start)

Simplest path. Delete all four gateway variables from `wrangler.jsonc`:

```jsonc
"vars": {
  "MAX_FILE_BYTES": "10485760",
  "MAX_BATCH_FILES": "12"
}
```

Then set `GEMINI_API_KEY` in Step 5 and you are done. The transport resolver
picks the direct API when no gateway variables are present.

### Option B — Vertex AI through Cloudflare AI Gateway

Adds request logging, analytics and Vertex's Flex service tier. It needs a
Google Cloud project with Vertex AI enabled, and **all five** of these set:

| Variable | Where it lives | Value |
|---|---|---|
| `AI_GATEWAY_ACCOUNT_ID` | `wrangler.jsonc` vars | Your Cloudflare account ID |
| `AI_GATEWAY_ID` | `wrangler.jsonc` vars | The gateway's name |
| `VERTEX_PROJECT_ID` | `wrangler.jsonc` vars | Your Google Cloud project ID |
| `VERTEX_REGION` | `wrangler.jsonc` vars | `global` |
| `CF_AI_GATEWAY_TOKEN` | **secret** | An AI Gateway authentication token |

Setting *some* of them raises
`AI Gateway configuration is incomplete: missing …` on the first research call.
Setting *none* falls back to Option A. There is no partial mode.

On this option `GEMINI_API_KEY` is not used and should be left unset: the
resolver checks the five gateway variables before it looks at the key, so
every call goes to Vertex through the gateway. The few direct-API fallbacks
that remain refuse with a message naming the key rather than calling out
without a credential.

Leave `AI_GATEWAY_LOG_PAYLOADS` at `"false"`. Turn it on only to debug a
specific failing response, then turn it back off — it stores entire research
prompts and answers.

---

## Step 5 — Set the secrets

Secrets are encrypted and never appear in `wrangler.jsonc`.

```bash
# The password you will log in with
npx wrangler secret put APP_PASSWORD

# Signing key for session tokens — at least 32 random characters
npx wrangler secret put AUTH_SECRET

# Only for Option A — the gateway path does not use it
npx wrangler secret put GEMINI_API_KEY

# Only for Option B
npx wrangler secret put CF_AI_GATEWAY_TOKEN
```

A good `AUTH_SECRET`:

```bash
openssl rand -base64 48
```

You also need `APP_URL`, which is the exact origin the browser will load and is
compared against for CORS. You will not know it until the first deploy, so set
it in Step 7.

> Changing `AUTH_SECRET` later invalidates every issued session token, which
> only means logging in again. Changing `APP_PASSWORD` takes effect at the next
> login; tokens already issued stay valid until they expire after seven days.

---

## Step 6 — Create the database schema

```bash
npx wrangler d1 migrations apply DB --remote
```

This applies all 36 migrations in order. Expect it to list every one. Run the
same command with `--local` instead for a local development database.

Verify it landed:

```bash
npx wrangler d1 execute DB --remote --command \
  "SELECT count(*) AS tables FROM sqlite_master WHERE type='table'"
```

---

## Step 7 — Deploy

```bash
npm run deploy
```

That builds the front end, applies any pending migrations and deploys the
Worker. Wrangler prints the deployed URL, something like
`https://winelogdb.<your-subdomain>.workers.dev`.

**Now set `APP_URL` to exactly that origin** — scheme and host, no trailing
slash — and deploy once more:

```jsonc
"vars": {
  "APP_URL": "https://winelogdb.your-subdomain.workers.dev"
}
```

```bash
npm run deploy
```

Getting `APP_URL` wrong does not break the page, but API calls fail the CORS
origin check. If you later put the app on a custom domain, update `APP_URL` to
match and redeploy.

### Deploying from GitHub instead

If you connect the repository to Cloudflare Workers Builds, a push to `main`
builds and deploys on its own. Two things are worth knowing:

- **Set the build command to `npm run deploy`**, not `wrangler deploy`. Only
  the npm script runs `db:migrate`, and a release that adds a migration will
  otherwise deploy code against a schema that does not have its tables yet —
  the feature 500s while everything else looks fine. If your build command is
  the bare `wrangler deploy`, run `npm run db:migrate` yourself before merging.
- **The build follows the push event, not the merge.** If GitHub does not emit
  one — it happens, and the sign is that no CI run appears for the merge commit
  either — nothing builds even though `main` moved. Deploy the current `main`
  from the Cloudflare dashboard (Workers → your worker → Builds → retry the
  latest commit), or run `npm run deploy` locally. Merging something else on
  top works too, but only because it produces a fresh push event.

---

## Step 8 — Log in

Open the deployed URL. You should land on the login page. Enter the
`APP_PASSWORD` from Step 5.

A successful login stores a seven-day session token in the browser's
`localStorage`. There is no "log out on all devices" — rotating `AUTH_SECRET`
does that.

---

## Verify it works

Work through these in order; each exercises a different piece.

1. **Auth** — the login page accepts your password and rejects a wrong one.
2. **D1** — add a wine by hand (`Add wine`) and find it in the Journal.
3. **R2** — upload a label photo and confirm it renders on the wine.
4. **Gemini recognition** — scan a bottle and check the fields come back filled.
5. **Queues + research** — run Deep Search on a wine. It should move through
   *queued → researching → complete*. If it stays queued, the queue consumer is
   not running; see below.

---

## Local development

```bash
cp .dev.vars.example .dev.vars     # then fill it in — never commit this file
npm run db:migrate:local
npm run dev
```

`.dev.vars` holds the same secrets as Step 5 plus `APP_URL`, which locally is
`http://localhost:5173`. It is gitignored.

```bash
npm test         # unit tests
npm run lint
npm run build
npm run test:e2e # Playwright
```

---

## Troubleshooting

**`No Gemini transport is configured`**
Neither `GEMINI_API_KEY` nor a complete gateway configuration is present. Set
the key (Step 5).

**`AI Gateway configuration is incomplete: missing …`**
Option B is partially configured. Set every variable the message names, or
remove all four gateway vars to fall back to Option A.

**Deep Search stays "queued" forever**
The queue consumer is not consuming. Confirm both queues exist
(`npx wrangler queues list`) and that the deploy included the consumer, then
watch it live with `npx wrangler tail --format pretty`.

**Deep Search fails with "answered without grounding … 0 web sources"**
Gemini returned an answer without searching, so the quality gate rejected it —
correctly, since ungrounded research is what the gate exists to catch. It
retries on a different model automatically. If it happens on every run, check
that your key or Vertex project actually has Google Search grounding available.

**`D1_ERROR: no such column` after pulling new commits**
New migrations have not been applied. Run Step 6 again.

**Images 404 on the wine page**
The R2 bucket name in `wrangler.jsonc` does not match the bucket you created,
or the bucket is in a different account than the Worker.

**API calls fail with CORS errors**
`APP_URL` does not exactly match the origin in the browser's address bar.
Compare scheme, host and the absence of a trailing slash.

---

## Running costs

The design deliberately keeps browsing cheap: reads never write, the landing
page and achievement progress are cached against a revision counter, and
background jobs poll with an increasing interval instead of a fixed timer. See
*Staying inside the D1 free tier* in the README for the reasoning.

The variable cost is Gemini. Recognition runs once per photo; Deep Search runs
once per missing research scope and is then cached permanently and reused by
every other wine that matches the same scope. Refreshing a wine's vintage
research re-runs only the vintage-sensitive scopes, not the producer or terroir
research.

---

## Backups

Nothing here is backed up by default. Schedule both:

```bash
npx wrangler d1 export DB --remote --output backups/winelog-$(date +%F).sql
```

and an R2 copy to a second private bucket (`rclone sync` or R2 replication).
Encrypt the exports, and test a restore occasionally — an untested backup is a
guess. The README's *Backup and recovery* section describes the restore order.
