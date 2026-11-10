import { requireSession } from '../src/lib/auth/session';

/**
 * Who a request belongs to, decided in one place.
 *
 * The public entry point (`multiUserEntry`) checks the member's session cookie
 * once and passes the answer down as `VERIFIED_MEMBER_ID` on the environment
 * object it hands to the inner routes. That object is built by the Worker for
 * each request and cannot be set by a browser, so the inner routes take it as
 * read. It replaces a short-lived token the entry point used to sign for
 * itself on every request, which each inner layer then verified again.
 *
 * Without it, the caller must present a signed session token. Nothing in
 * production takes that path, because every request arrives through the entry
 * point; it is how tests exercise an inner route directly.
 */
export type IdentityBindings = { VERIFIED_MEMBER_ID?: string; AUTH_SECRET: string };

/** The member the request acts for. Throws when there is none. */
export async function requestOwner(authorization: string | null | undefined, env: IdentityBindings): Promise<string> {
  if (env.VERIFIED_MEMBER_ID) return env.VERIFIED_MEMBER_ID;
  return (await requireSession(authorization ?? undefined, env.AUTH_SECRET)).userId;
}
