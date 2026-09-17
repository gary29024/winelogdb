# WineLog multi-user go-live checklist

This is the owner checklist for PR #224. It is deliberately written for someone who does **not** want to work in code or a terminal.

The goal is simple: finish the Google and Cloudflare settings **before merging**, so the merge can deploy the multi-user version and you can sign in immediately afterwards.

## Before you start: write down these three values

1. **WineLog address (`APP_URL`)** — the exact HTTPS address you use to open WineLog now, for example `https://wine.example.com`. Do not include anything after the domain and do not worry about a trailing slash; the app normalises it.
2. **Owner Google email (`OWNER_EMAIL`)** — the Google account that should own the existing WineLog data.
3. **Support email (`SUPPORT_EMAIL`)** — an email address you are happy to show publicly on WineLog's About, Privacy and Terms pages. It may be the same as the owner email, but a separate support address is better if you have one.

If your WineLog address is only a shared `workers.dev` address, Google sign-in can still be used for the private pilot in **Testing** mode. For a polished Google **In production** consent screen, use a custom domain you own, because Google expects production app domains to be verifiable.

---

# Part A — Google setup before merging

## A1. Open Google Auth Platform

1. Go to <https://console.cloud.google.com/> and sign in with the Google account that will administer WineLog.
2. Choose an existing Google Cloud project for WineLog or create a new one.
3. Open **Google Auth Platform**.

WineLog only requests `openid`, `email`, and `profile`. It does **not** request Gmail, Google Drive, Contacts, Calendar, or other sensitive application data.

## A2. Fill in Branding

In **Google Auth Platform → Branding** enter:

- **App name:** `WineLog`
- **User support email:** an email you monitor
- **Developer contact email:** an email you monitor

For the first launch, you can leave the app in Testing while the new public pages are not yet live on `main`.

Once PR #224 is deployed, use these final links:

- **Home page:** `APP_URL/about`
- **Privacy policy:** `APP_URL/privacy`
- **Terms of service:** `APP_URL/terms`

If you use your own custom domain, add the registrable domain under **Authorized domains** and verify ownership in Google Search Console when Google asks. Example: for `https://wine.example.com`, the authorized domain is normally `example.com`.

WineLog's login page uses Google's approved **Sign in with Google** artwork while keeping WineLog's server-side PKCE/OIDC flow behind it.

## A3. Set the audience

Open **Audience**:

1. Choose **External** unless every WineLog member belongs to one Google Workspace organisation that you control.
2. Keep the app in **Testing** for the first deployment.
3. Add your owner Google email as a **Test user**.

Testing mode is the easiest route to an immediate launch. Google currently permits up to 100 listed test users. You can add pilot members here as you invite them. Google notes that test-user authorisations expire after seven days; WineLog itself also uses seven-day login sessions, so members can simply sign in again.

After the deployment is working and the public legal pages are live, you can move the Google app to **In production**. WineLog only requests basic identity scopes, so it does not require sensitive/restricted-scope verification, although Google can still require branding/domain checks for a production app.

## A4. Create the OAuth client

Open **Google Auth Platform → Clients → Create client**.

Choose:

- **Application type:** `Web application`
- **Name:** `WineLog web production`

Under **Authorized redirect URIs**, add exactly:

```text
APP_URL/api/auth/google/callback
```

For example:

```text
https://wine.example.com/api/auth/google/callback
```

WineLog uses a server-side OAuth flow, so **Authorized JavaScript origins can be left empty**.

Press **Create** and copy both values Google shows you:

- Client ID → this becomes `GOOGLE_CLIENT_ID`
- Client secret → this becomes `GOOGLE_CLIENT_SECRET`

Keep the client secret private.

---

# Part B — Cloudflare settings before merging

Open **Cloudflare Dashboard → Workers & Pages → winelogdb → Settings**.

There are two different types of settings in Cloudflare. For the values below use **Runtime Variables and Secrets** (the section called **Variables and Secrets**), **not Build Variables**.

The repository has `keep_vars: true`, so these dashboard values are intentionally preserved when the Worker is deployed from GitHub.

## B1. Add the runtime variables

Under **Settings → Variables and Secrets**, add:

| Name | Type | What to enter |
| --- | --- | --- |
| `APP_URL` | Text | Your exact public WineLog HTTPS origin, e.g. `https://wine.example.com` |
| `SUPPORT_EMAIL` | Text | The monitored address to show on the public legal pages |
| `GOOGLE_CLIENT_ID` | Secret | The Client ID copied from Google |
| `GOOGLE_CLIENT_SECRET` | Secret | The Client secret copied from Google |
| `OWNER_EMAIL` | Secret | Your owner Google email address |
| `AUTH_SECRET` | Secret | A new random string of at least 32 characters; 48–64 random characters is better |

For `AUTH_SECRET`, the easiest non-technical method is to use the random-password generator in your password manager and generate at least 48 random characters. Save it in your password manager. Do not reuse a normal password.

`OWNER_GOOGLE_SUB` is **not required for launch**. After your first successful owner login, WineLog permanently binds that Google account to the existing owner record. You can add `OWNER_GOOGLE_SUB` later as extra hardening if you want.

Do **not** delete or replace your existing Gemini / Cloudflare AI Gateway secrets just for this rollout. If AI features work today, leave those credentials in place.

## B2. Check the GitHub deployment settings

Still in the Worker, open **Settings → Build**.

For the production connection use:

- **Repository:** `gary29024/winelogdb`
- **Production branch:** `main`
- **Build command:** `npm run build`
- **Deploy command:** `npm run db:migrate && npx wrangler deploy`

This order matters: the new D1 tables must be created before the new Worker code is promoted.

The repository includes `.node-version` with Node 24, so Cloudflare Builds uses the same major Node version as CI.

Build Variables are not needed for the OAuth runtime settings above.

## B3. Confirm existing Cloudflare resources

PR #224 expects the same existing resources already configured in `wrangler.jsonc`:

- D1 database: `winelogdb`
- private R2 bucket: `winelog-private`
- queue: `winelog-research`
- dead-letter queue: `winelog-research-dlq`
- Workers AI binding
- Images binding
- Analytics Engine dataset

If the current WineLog deployment is working, these should already exist. Do not create replacements just for the multi-user rollout.

---

# Part C — Recovery point immediately before merging

Modern Cloudflare D1 uses **Time Travel**, and it is always on. You do not need to create a manual snapshot just to have a rollback point. Immediately before merging, write down the current date and time; if a migration goes wrong, D1 can be restored to a point before the merge. Cloudflare's current retention is 7 days on the Workers Free plan and 30 days on the Paid plan.

For extra protection, an independent SQL export is still useful. If you are comfortable with one copy-and-paste command, run this from the repository:

```powershell
npx wrangler d1 export DB --remote --output=winelog-before-multi-user.sql
```

Also confirm your R2 images are still present. D1 Time Travel does **not** restore R2 objects, so do not delete or recreate the existing R2 bucket during this rollout.

If you do not want to use a command line, recording the pre-merge time plus D1 Time Travel is enough for the database rollback path; the SQL export is an additional independent copy, not a prerequisite to understand or operate the new login.

---

# Part D — Merge PR #224

Once Parts A–C are complete, merge PR #224 into `main`.

Cloudflare should then:

1. install dependencies;
2. run `npm run build`;
3. run all pending D1 migrations through migration **0069**;
4. deploy `worker/multiUserEntry.ts` and the built front end.

Migration 0069 seeds the current budget month only when that value is blank, so the first owner AI action is not blocked by a setting that did not exist before the multi-user cutover. Future month changes still require the normal owner usage update.

Do not invite anybody until you have completed Part E.

---

# Part E — Five-minute owner check after deployment

## E1. Check the public pages first

Open these in a private/incognito browser window:

```text
APP_URL/about
APP_URL/privacy
APP_URL/terms
APP_URL/login
```

The About, Privacy and Terms pages must work without being signed in. The public pages should show the `SUPPORT_EMAIL` you configured.

## E2. Sign in as the owner

Open `APP_URL/login` and press **Sign in with Google**.

Use exactly the Google account stored in `OWNER_EMAIL`.

You should return to WineLog already signed in and still see your existing wines, producers, tastings, cellar data and photos.

If Google says `redirect_uri_mismatch`, compare the URI shown in Google with:

```text
APP_URL/api/auth/google/callback
```

They must be the same HTTPS address.

## E3. Open Owner controls

Go to:

**Account & friends → Owner controls**

Your existing owner workflow is deliberately continuous across the cutover: the owner pays the provider directly, so owner AI requests use zero WineLog credits and do **not** require you to create member prices or grant credits to yourself first. The operation is still recorded for audit/usage purposes.

Before inviting members:

1. review the seeded member/storage/AI limits;
2. configure every credit price you intend to make available **to members**;
3. grant credits to test/member accounts as needed;
4. run **Inventory R2 storage**;
5. run **Index existing research**;
6. confirm the maintenance/rollout status is healthy.

The initial settings are intentionally conservative. A newly deployed member cannot spend unpriced AI by accident.

## E4. Test the important functions

Use your owner account to check:

- open the Journal;
- open an existing wine and photo;
- scan one bottle;
- run one Deep Search;
- run one Smart Search;
- open a producer;
- check **Owner controls → Member usage**.

If those work, the multi-user boundary, D1, R2, queues, Google sign-in and AI path are all being exercised.

---

# Part F — Invite the first member

Only after Part E succeeds:

1. configure the member AI prices you want to offer and decide how many credits to grant;
2. create one invitation in **Owner controls** for a specific Google email address;
3. if Google OAuth is still in Testing, add that same email to Google Auth Platform → Audience → Test users;
4. send the invitation link privately;
5. ask the member to sign in with that exact Google email;
6. confirm they see an empty/private account rather than your owner journal;
7. exchange friend codes if you want to test sharing/research reuse.

Start with one member. Once that account works, add the remaining pilot users.

---

# Optional hardening after first owner login

This is **not required to go live**.

If you later want the owner account pinned to Google's immutable account identifier rather than just relying on the identity already bound in D1, retrieve the owner's Google subject from `auth_identities` and save it as the `OWNER_GOOGLE_SUB` Worker secret. When `OWNER_GOOGLE_SUB` is present, it takes precedence over `OWNER_EMAIL`.

You can leave `OWNER_EMAIL` stored as a secret. Once the owner identity is already bound, the email bootstrap cannot claim another owner account.

---

# What must be true before you press Merge

Do not merge until all of these are true:

- [ ] I know my final `APP_URL`.
- [ ] Google Auth Platform is configured.
- [ ] The Google Web client has the exact callback `APP_URL/api/auth/google/callback`.
- [ ] My owner email is a Google OAuth test user.
- [ ] Cloudflare runtime Variables and Secrets contain `APP_URL`, `SUPPORT_EMAIL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OWNER_EMAIL`, and a 32+ character `AUTH_SECRET`.
- [ ] Existing AI credentials remain configured.
- [ ] Cloudflare production branch is `main`.
- [ ] Build command is `npm run build`.
- [ ] Deploy command is `npm run db:migrate && npx wrangler deploy`.
- [ ] I have noted the pre-merge time for D1 Time Travel; an SQL export is optional extra protection.

If every box is checked, PR #224 is designed to deploy into a sign-in-ready state rather than requiring a second code change after merge.
