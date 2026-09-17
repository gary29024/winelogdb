# Setting up WineLog

If you already run WineLog and are preparing to merge the multi-user rollout, use **[GO_LIVE.md](GO_LIVE.md)**. It is the shortest, non-technical checklist and is designed so the app can be sign-in-ready immediately after the merge.

This document is the fuller reference for a new deployment or troubleshooting an existing one.

## What WineLog uses

One Cloudflare Worker serves the React app and the API. It uses:

| Resource | Binding | Purpose |
| --- | --- | --- |
| D1 | `DB` | Wines, tastings, accounts, research, credits and job state |
| R2 | `WINE_IMAGES` | Private original and derivative images |
| Queue | `RESEARCH_QUEUE` | Background recognition/research work |
| Workers AI | `AI` | Smart Search embeddings and model fallbacks |
| Images | `IMAGES` | Image transformations |
| Analytics Engine | `AI_USAGE` | AI usage telemetry |
| Static Assets | `ASSETS` | Built front end |

The production entrypoint is `worker/multiUserEntry.ts`.

## Requirements

- Node 24 is recommended. The repository includes `.node-version` with `24` so Cloudflare Builds uses the same major version as CI.
- A Cloudflare account.
- A Google Cloud project for Google sign-in.
- Existing Gemini / AI Gateway credentials for WineLog's AI features.

For the existing deployment, do **not** recreate D1, R2 or queues just because you are enabling multi-user support.

## Runtime Variables and Secrets

In Cloudflare open:

**Workers & Pages → winelogdb → Settings → Variables and Secrets**

These are runtime values. They are different from Build Variables.

### Required for multi-user sign-in

| Name | Type | Value |
| --- | --- | --- |
| `APP_URL` | Text | Public HTTPS origin, e.g. `https://wine.example.com` |
| `SUPPORT_EMAIL` | Text | Public monitored support address |
| `GOOGLE_CLIENT_ID` | Secret | Google Web OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Secret | Google Web OAuth client secret |
| `OWNER_EMAIL` | Secret | Google email that owns the legacy WineLog data |
| `AUTH_SECRET` | Secret | Fresh random value of at least 32 characters |

`OWNER_GOOGLE_SUB` is optional hardening after the first owner login. It is not needed to launch.

The Worker config has `keep_vars: true`, so runtime values added in the Cloudflare dashboard are preserved during Wrangler deployments.

### AI credentials

Keep the AI credentials that already work for your deployment.

Depending on the transport, the Worker may use:

- `GEMINI_API_KEY`
- `CF_AI_GATEWAY_TOKEN`
- optional `SEMANTIC_GEMINI_API_KEY`

Do not put these in GitHub source code or `wrangler.jsonc`.

## Google OAuth

Use [docs/google-oauth-setup.md](docs/google-oauth-setup.md).

The key production callback is:

```text
APP_URL/api/auth/google/callback
```

WineLog requests only `openid email profile`.

For the first rollout, Google Auth Platform **Testing** mode is the simplest option. Add the owner as a test user before merging. Add each pilot member as a test user while the project remains in Testing.

## Cloudflare Builds from GitHub

For the connected Worker, open **Settings → Build** and use:

- Repository: `gary29024/winelogdb`
- Production branch: `main`
- Build command: `npm run build`
- Deploy command: `npm run db:migrate && npx wrangler deploy`

This is intentional. Cloudflare runs the build step first, then the deploy step. The deploy command applies D1 migrations **before** promoting the new Worker code.

Do not use a bare `npx wrangler deploy` as the production deploy command for releases that contain migrations.

Build Variables are only available during the build process. OAuth runtime settings belong in **Settings → Variables and Secrets** instead.

## New Cloudflare deployment only

If you are creating a separate WineLog deployment from scratch, create:

```powershell
npx wrangler d1 create winelogdb
npx wrangler r2 bucket create winelog-private
npx wrangler queues create winelog-research
npx wrangler queues create winelog-research-dlq
```

Then replace the committed D1 `database_id` in `wrangler.jsonc` with the new database ID. If you use different resource names, update the matching bindings in `wrangler.jsonc` as well.

Keep the R2 bucket private.

The committed `wrangler.jsonc` contains deployment-specific AI Gateway/project configuration for the existing WineLog deployment. A new operator must replace or remove those account-specific values rather than accidentally targeting somebody else's infrastructure.

## Database migrations

For local/CLI deployment:

```powershell
npm run db:migrate
```

The current multi-user branch contains migrations through **0069**. Migration 0069 only fills a blank `cloudflareObservedMonth` with the current month so the existing owner is not blocked on the first AI action after cutover. Wrangler records which migrations are already applied and only applies pending ones.

For an existing deployment, make a fresh D1 export before applying the multi-user migrations:

```powershell
npx wrangler d1 export DB --remote --output=winelog-before-multi-user.sql
```

Do not recreate the existing R2 bucket.

## Local deployment from a computer

Once runtime settings and secrets are configured:

```powershell
npm install
npm run deploy
```

`npm run deploy` builds the app, applies pending remote D1 migrations, then deploys the Worker.

For an existing production app connected to GitHub, prefer the normal GitHub/Cloudflare build path described above so the deployment remains reproducible.

## Local development

Copy the example file:

```powershell
copy .dev.vars.example .dev.vars
```

Fill it with local credentials. `.dev.vars` is ignored by Git.

Then:

```powershell
npm run db:migrate:local
npm run dev
```

The secure multi-user session cookies are intended for HTTPS. Ordinary `http://localhost` is useful for UI/API development, but a complete Google sign-in flow should be tested on an HTTPS development/staging hostname.

## First owner login

After deployment:

1. Open `APP_URL/about`, `/privacy`, `/terms` and `/login` in a private browser window.
2. Confirm the legal pages are public and display the configured `SUPPORT_EMAIL`.
3. Choose **Sign in with Google**.
4. Use exactly the account configured as `OWNER_EMAIL`.
5. Confirm your existing owner wines, producers, tastings, cellar data and images remain present.

The first successful login binds that Google identity to the existing `owner` account. A later uninvited Google account cannot claim the owner merely because it knows the email.

The owner remains exempt from WineLog credit pricing because the owner pays the provider bill directly. Owner AI actions still create zero-credit operation records for audit/usage tracking, but the owner does not need a credit grant or member price table to continue scanning or researching after cutover.

## Owner controls before inviting members

Open:

**Account & friends → Owner controls**

Then:

1. review member/storage/AI budgets;
2. configure every AI credit price you intend members to use;
3. grant test/member credits as needed;
4. run **Inventory R2 storage**;
5. run **Index existing research**;
6. confirm rollout/maintenance state is healthy;
7. test one scan, one Deep Search and one Smart Search as the owner.

Only then create the first member invitation.

## Invite a member

1. Create an invitation in Owner controls for an exact Google email.
2. If Google OAuth is still in Testing, add the same email under Google Auth Platform → Audience → Test users.
3. Send the invitation link privately.
4. The member must sign in with that exact Google account.
5. Verify the member sees their own empty/private journal, not the owner's data.

Friendship is separate from admission. Members can exchange friend codes after both accounts exist.

## Verification commands

For developers or troubleshooting:

```powershell
npm test
npm run lint
npm run build
npm run test:e2e
```

CI runs the high-risk unit suite and build checks on pull requests.

## Common problems

### Google: `redirect_uri_mismatch`

The Google Web OAuth client must contain exactly:

```text
APP_URL/api/auth/google/callback
```

### WineLog: `Google sign-in has not been configured`

One of these is missing in the deployed Worker:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OWNER_EMAIL` or optional `OWNER_GOOGLE_SUB`

### WineLog: `APP_URL is not configured as a valid application origin`

Set the Cloudflare runtime variable to an origin only, such as:

```text
https://wine.example.com
```

### WineLog: `AUTH_SECRET must be at least 32 characters`

Replace `AUTH_SECRET` with a longer random secret.

### API writes return `Invalid request origin`

The browser origin and `APP_URL` differ. Check protocol and hostname.

### `D1_ERROR: no such table` or `no such column`

Pending migrations were not applied. Run:

```powershell
npm run db:migrate
```

and ensure the Cloudflare Deploy command is `npm run db:migrate && npx wrangler deploy`.

### Deep Search remains queued

Confirm `winelog-research` exists and the Worker has a queue consumer. Check Worker logs for queue delivery errors.

### Images return 404

Confirm the Worker is bound to the existing private `winelog-private` R2 bucket and that the bucket was not recreated under another account.

## Backup and rollback

Before major migrations, keep a D1 export outside the app's public assets. Preserve the existing R2 bucket and its objects.

After admitting multi-user accounts, do not roll the public Worker back to the old password boundary while keeping the migrated multi-user data model. If application code must be rolled back, retain the multi-user authentication/authorization boundary and diagnose the failed feature separately.
