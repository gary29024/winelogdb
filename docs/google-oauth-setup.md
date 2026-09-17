# Set up Google sign-in for WineLog

For the existing WineLog deployment, use the simpler owner runbook first: **[GO_LIVE.md](../GO_LIVE.md)**. This page explains the Google-specific details.

WineLog uses Google's server-side authorization-code flow with PKCE. It requests only:

- `openid`
- `email`
- `profile`

It does **not** need Gmail, Drive, Calendar, Contacts or another Google API scope.

## 1. Decide the final WineLog address

Use the HTTPS address members will actually open. This is `APP_URL`, for example:

```text
https://wine.example.com
```

WineLog's Google callback is:

```text
APP_URL/api/auth/google/callback
```

For the example above:

```text
https://wine.example.com/api/auth/google/callback
```

WineLog normalises `APP_URL` to its origin internally, so a trailing `/` is harmless. Do not put `/login`, `/about`, query parameters, credentials or another path into `APP_URL`.

If you only have a `workers.dev` hostname, the private pilot can still use Google OAuth in **Testing** mode. For a polished **In production** Google consent screen, a custom domain you own is preferable because Google expects production app domains to be verifiable.

## 2. Open Google Auth Platform

1. Go to <https://console.cloud.google.com/>.
2. Select or create the Google Cloud project that will own WineLog sign-in.
3. Open **Google Auth Platform**.

Keep the project under a Google account you control.

## 3. Configure Branding

Under **Branding** set:

- App name: `WineLog`
- User support email: an address you monitor
- Developer contact email: an address you monitor

After PR #224 is deployed, the final public URLs are:

```text
Homepage:         APP_URL/about
Privacy policy:   APP_URL/privacy
Terms of service: APP_URL/terms
```

The same public Privacy Policy is linked from WineLog's sign-in page.

If you use your own custom domain, add its registrable domain under **Authorized domains** and verify ownership in Google Search Console if Google requests it. Example: `https://wine.example.com` normally uses `example.com` as the authorized domain.

## 4. Configure Audience

For a small private pilot:

1. Choose **External**, unless all users are inside one Google Workspace organisation you control.
2. Start with publishing status **Testing**.
3. Add the owner Google email as a **Test user**.
4. When you invite a new pilot member, also add that Google email as a test user while the project remains in Testing.

Google currently allows up to 100 test users. Google also says test-user authorisations expire after seven days. WineLog's own session lasts seven days, so a pilot user can simply sign in again.

Once the app is working, the legal pages are publicly reachable, and any custom domain is verified, you can move the Google app to **In production**. WineLog uses only basic identity scopes, not sensitive/restricted scopes; Google may still apply its normal branding/domain verification requirements to a production app.

## 5. Create the Web OAuth client

Open **Google Auth Platform → Clients → Create client**.

Choose:

- Application type: **Web application**
- Name: `WineLog web production`

Add exactly one production **Authorized redirect URI**:

```text
APP_URL/api/auth/google/callback
```

For example:

```text
https://wine.example.com/api/auth/google/callback
```

WineLog starts OAuth on the Worker and does not use the Google JavaScript sign-in SDK, so **Authorized JavaScript origins can be left empty**.

Create the client and copy:

- Client ID → `GOOGLE_CLIENT_ID`
- Client secret → `GOOGLE_CLIENT_SECRET`

The secret is a password for the server. Never commit it to GitHub or place it in browser/Vite code.

## 6. Put the values into Cloudflare before merging

Open:

**Cloudflare Dashboard → Workers & Pages → winelogdb → Settings → Variables and Secrets**

These are **runtime** values. Do not put them only under Build Variables.

Add:

| Name | Type | Value |
| --- | --- | --- |
| `APP_URL` | Text | Exact public WineLog HTTPS origin |
| `SUPPORT_EMAIL` | Text | Monitored public support address |
| `GOOGLE_CLIENT_ID` | Secret | Client ID from Google |
| `GOOGLE_CLIENT_SECRET` | Secret | Client secret from Google |
| `OWNER_EMAIL` | Secret | Google email that owns the existing WineLog data |
| `AUTH_SECRET` | Secret | Fresh random value, at least 32 characters |

For `AUTH_SECRET`, a password manager's random generator is fine; use 48–64 random characters if convenient.

The repository uses `keep_vars: true`, so runtime values configured in Cloudflare are preserved when the GitHub deployment runs.

## 7. First owner login

After PR #224 is deployed:

1. Open `APP_URL/login`.
2. Choose **Continue with Google**.
3. Sign in with exactly `OWNER_EMAIL`.
4. WineLog binds that verified Google identity to the existing `owner` record.

`OWNER_EMAIL` is only a bootstrap rule. Once an identity is already bound to `owner`, the email alone cannot claim another owner identity.

### Optional stricter owner binding

You do **not** need this to launch.

Later, you can read the immutable Google subject from D1:

```powershell
npx wrangler d1 execute DB --remote --command "SELECT subject FROM auth_identities WHERE provider = 'google' AND user_id = 'owner';"
```

Save it as the Worker secret `OWNER_GOOGLE_SUB`. When present, it takes precedence over `OWNER_EMAIL`.

You may leave `OWNER_EMAIL` configured; after the owner identity exists, it cannot bootstrap a second owner account.

## 8. Verify the four public pages

Before inviting anyone, open these in an incognito/private browser:

```text
APP_URL/about
APP_URL/privacy
APP_URL/terms
APP_URL/login
```

About, Privacy and Terms must work without authentication. The public pages should display the `SUPPORT_EMAIL` configured in Cloudflare.

Then confirm:

- owner Google login succeeds;
- an uninvited Google account cannot join;
- the owner still sees the existing WineLog journal;
- a deliberately invited test account can join only with the invited Google email.

## Common errors

### `redirect_uri_mismatch`

The redirect URI in **Google Auth Platform → Clients** does not match:

```text
APP_URL/api/auth/google/callback
```

Compare `https`, hostname and callback path.

### `Google sign-in has not been configured`

At least one of these is missing in the deployed Worker:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OWNER_EMAIL` (or optional `OWNER_GOOGLE_SUB`)

### `APP_URL is not configured as a valid application origin`

Set the Cloudflare runtime variable `APP_URL` to only the public origin, for example:

```text
https://wine.example.com
```

### `AUTH_SECRET must be at least 32 characters`

Replace the Worker secret with a new random value of at least 32 characters.

## Official Google references

- Google OAuth web-server applications: <https://developers.google.com/identity/protocols/oauth2/web-server>
- Google Auth Platform clients: <https://support.google.com/cloud/answer/15549257>
- OAuth app branding: <https://support.google.com/cloud/answer/15549049>
- OAuth audience/testing: <https://support.google.com/cloud/answer/15549945>
