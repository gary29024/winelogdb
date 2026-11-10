import { describe, expect, it } from 'vitest';
import { createSession } from '../../src/lib/auth/session';
import { requestOwner } from '../../worker/identity';

const AUTH_SECRET = 'test-secret-value-long-enough-for-hmac';

describe('requestOwner', () => {
  it('takes the member the entry point already verified, ignoring any header', async () => {
    const other = `Bearer ${await createSession('someone-else', AUTH_SECRET)}`;
    expect(await requestOwner(other, { AUTH_SECRET, VERIFIED_MEMBER_ID: 'member-1' })).toBe('member-1');
    expect(await requestOwner(null, { AUTH_SECRET, VERIFIED_MEMBER_ID: 'member-1' })).toBe('member-1');
  });

  it('accepts a signed session token when no member was passed down', async () => {
    const header = `Bearer ${await createSession('owner', AUTH_SECRET)}`;
    expect(await requestOwner(header, { AUTH_SECRET })).toBe('owner');
  });

  it('refuses a missing, malformed or wrongly signed token', async () => {
    await expect(requestOwner(undefined, { AUTH_SECRET })).rejects.toThrow();
    await expect(requestOwner('Bearer not-a-token', { AUTH_SECRET })).rejects.toThrow();
    const wrongKey = `Bearer ${await createSession('owner', 'another-secret-value-long-enough')}`;
    await expect(requestOwner(wrongKey, { AUTH_SECRET })).rejects.toThrow();
  });

  it('does not treat an empty member id as verified', async () => {
    await expect(requestOwner(undefined, { AUTH_SECRET, VERIFIED_MEMBER_ID: '' })).rejects.toThrow();
  });
});
