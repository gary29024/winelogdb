# Set up Google sign-in for WineLog

This guide configures the Google web OAuth client used by the multi-user
Worker. WineLog uses the server-side authorization-code flow with PKCE and
requests only `openid`, `email`, and `profile`. It does not need Google Drive,
Gmail, or any other Google API scope.

Complete this after the multi-user change is deployed, but before inviting a
member. Use a Google Cloud project that you control; do not reuse a client's or
another product's OAuth client.

## 1. Decide the public URL first

Choose the final HTTPS address for WineLog, for example
`https://wine.example.com` or its `workers.dev` address. In this guide that
address is called `APP_URL`.

WineLog calculates its callback as:

```text
APP_URL/api/auth/google/callback
```

There must be no trailing slash in `APP_URL`. The callback registered with
Google must exactly match the value WineLog sends, including `https`, host,
case, port, and trailing slash. The production callback therefore looks like:

```text
https://wine.example.com/api/auth/google/callback
```

The public `/about`, `/privacy`, and `/terms` pages added with this change must
be available at the same domain before the app is put into production.

## 2. Prepare the Cloudflare configuration

1. In `wrangler.jsonc`, add `APP_URL` under `vars` using the exact public
   origin. This is a normal Worker variable, not a secret.

   ```jsonc
   "vars": {
     "APP_URL": "https://wine.example.com"
   }
   ```

2. Deploy once so the chosen host and the public legal pages exist. If using
   the default Workers address, this first deploy tells you its exact URL; add
   that URL as `APP_URL` and deploy again.
3. Keep `APP_URL` in `.dev.vars` for local development, but use an HTTPS
   development host for an end-to-end Google login. The session cookies are
   `Secure` and intentionally do not work over ordinary HTTP.

## 3. Create or select the Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Use the project picker to create a project or select the project that will
   own WineLog sign-in.
3. Give the Google account that will maintain OAuth settings the Project Owner
   or Editor role. Keep the project and the app's support contact under your
   control.
4. Open **Google Auth Platform** in the left navigation.

## 4. Configure branding, domain, and audience

1. In **Branding**, set the app name to `WineLog`, choose a user-support email,
   and add a developer contact email that you monitor.
2. Add the domain portion of `APP_URL` in **Authorized domains**. For
   `https://wine.example.com`, add `example.com`, not the full URL. Verify
   domain ownership in Google Search Console with a Google account that is a
   project owner or editor.
3. Add these URLs under **App domain** using the same verified domain:

   ```text
   Homepage:       https://wine.example.com/about
   Privacy policy: https://wine.example.com/privacy
   Terms of service: https://wine.example.com/terms
   ```

   Before publishing, replace the contact process in the legal pages with a
   monitored operator contact and have the text reviewed for the jurisdictions
   in which you will operate.
4. In **Audience**, select **External** unless every pilot member belongs to
   one Google Workspace organisation that you control. For the private pilot,
   either:
   - keep **Testing** and add the owner and every pilot member as test users;
     Google allows up to 100 listed test users, or
   - move to **In production** once the homepage, privacy policy, terms, and
     domain ownership are complete.

   The identity-only scopes used by WineLog have a special testing exception,
   but production removes the unverified-app experience and is the appropriate
   choice for an ongoing pilot. Do not add scopes until the app needs them;
   additional scopes can create verification obligations.

## 5. Create the web OAuth client

1. In **Google Auth Platform → Clients**, choose **Create client**.
2. Choose **Web application** and name it `WineLog web production`.
3. Under **Authorized redirect URIs**, add exactly:

   ```text
   https://wine.example.com/api/auth/google/callback
   ```

4. Leave **Authorized JavaScript origins** empty. WineLog starts the OAuth
   authorization-code flow on the Worker; it does not run a Google JavaScript
   sign-in flow in the browser.
5. Create the client and copy the **Client ID** and **Client secret**. Treat
   the secret like a password; never put it in a Vite variable, browser code,
   `wrangler.jsonc`, or Git.

Create a separate client for an HTTPS development or staging hostname. Do not
add a production callback to a client shared with unrelated apps.

## 6. Set the Worker secrets

Run these from the repository while authenticated to the correct Cloudflare
account. Wrangler prompts for each value and stores it as a Worker secret:

```powershell
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put OWNER_EMAIL
npx wrangler secret put AUTH_SECRET
```

Use these values:

| Name | Value |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Client ID from the Google web OAuth client. |
| `GOOGLE_CLIENT_SECRET` | Client secret from that same client. |
| `OWNER_EMAIL` | The verified Google email address that owns the existing legacy WineLog data. It is a one-time bootstrap setting. |
| `AUTH_SECRET` | A fresh random value of at least 32 characters. Generate one with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`. |

Set `APP_URL` in `wrangler.jsonc`, as described above. It is deliberately not
a secret because the browser needs to know that public origin.

For local-only work, copy `.dev.vars.example` to `.dev.vars` and fill the same
values. `.dev.vars` is ignored by Git. Do not use a production OAuth secret in
a shared development machine or repository.

## 7. Bind the owner safely

1. Deploy after the secrets and `APP_URL` are set.
2. Open the app and use **Continue with Google** with the `OWNER_EMAIL`
   account. This is the only login that can bind the existing `owner` data.
   An uninvited account must be rejected.
3. Read the bound Google subject from D1:

   ```powershell
   npx wrangler d1 execute DB --remote --command "SELECT subject FROM auth_identities WHERE provider = 'google' AND user_id = 'owner';"
   ```

4. Save that value as the stricter permanent owner binding:

   ```powershell
   npx wrangler secret put OWNER_GOOGLE_SUB
   ```

5. Remove `OWNER_EMAIL` from the deployed Worker once `OWNER_GOOGLE_SUB` is
   confirmed, then deploy again:

   ```powershell
   npx wrangler secret delete OWNER_EMAIL
   ```

   Keep neither value in source control.

The app identifies Google accounts by Google provider plus subject, never by
email alone after this bootstrap. Do not use a second Google account with the
same email as an account-linking method.

## 8. Verify before inviting anyone

1. Start login from `/login`, complete Google sign-in, and confirm the browser
   returns to WineLog with a secure session.
2. Confirm `/about`, `/privacy`, and `/terms` load in a private browser window.
3. Confirm a Google account without an invitation cannot sign in.
4. Create one invitation in **Owner controls**, then sign in with the invited
   Google email and accept a friend request using its in-app friend code.
5. Revoke a session from the account page and confirm the next request is
   rejected.

Google documentation: [OpenID Connect setup](https://developers.google.com/identity/openid-connect/openid-connect), [OAuth app branding](https://support.google.com/cloud/answer/15549049?hl=en), and [app audience settings](https://support.google.com/cloud/answer/15549945?hl=en).
