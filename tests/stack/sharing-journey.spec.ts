import { test, expect, type Page } from '@playwright/test';
import { api, startStack } from './support/stack';
import { buildResearchTargets, upsertResearchCache } from '../../src/lib/research/cache';
import { producerEntry } from '../unit/support/researchFixture';
import { blank } from '../unit/support/wineSaveFixture';
import { thumbnailObjectKey } from '../../src/lib/r2/thumbnails';

test('owner-to-member sharing through browser, Worker, D1 and R2', async ({ browser }) => {
  const stack = await startStack();
  let passed = false;
  try {
    const owner = await stack.signIn(browser, 'owner');
    const member = await stack.signIn(browser, 'member');
    const outsider = await stack.signIn(browser, 'outsider');
    expect(owner.user.role).toBe('owner');
    expect(member.user.role).toBe('member');
    const code = (await api(member.page, '/api/friends/code')).body.code;
    expect((await api(owner.page, '/api/friends/requests', 'POST', { code })).status).toBe(201);
    const incoming = (await api(member.page, '/api/friends/requests')).body.incoming;
    expect((await api(member.page, `/api/friends/requests/${incoming[0].id}/accept`, 'POST', {})).status).toBe(200);

    const page = owner.page;
    await page.goto(`${stack.origin}/wines/new`);
    await page.getByRole('textbox', { name: 'Producer *', exact: true }).fill('Domaine Dujac');
    await page.getByRole('textbox', { name: 'Wine name *', exact: true }).fill('Clos de la Roche typo');
    await page.getByRole('spinbutton', { name: 'Vintage', exact: true }).fill('2019');
    await page.getByLabel('Country', { exact: true }).fill('France');
    await page.getByLabel('Region', { exact: true }).fill('Burgundy');
    await page.locator('input[name=appellation]').fill('Clos de la Roche');
    await page.locator('select[name=wineStyle]').selectOption('red');
    await page.getByLabel('Tasting notes', { exact: true }).fill('OWNER_SECRET_NOTES');
    await page.getByLabel('Venue', { exact: true }).fill('OWNER_SECRET_VENUE');
    await page.getByLabel('Place name', { exact: true }).fill('OWNER_SECRET_LOCATION');
    await page.getByLabel('Tags (comma separated)', { exact: false }).fill('OWNER_SECRET_TAG');
    await page.getByLabel('Rating / 100', { exact: true }).fill('91');
    await page.getByLabel('Price', { exact: true }).fill('123');
    await page.getByLabel('Currency', { exact: true }).fill('USD');
    await page.getByLabel('Drinking date', { exact: true }).fill('2026-09-01');
    await page.getByRole('button', { name: 'Save wine', exact: true }).click();
    await expect(page).toHaveURL(/\/wines\/[0-9a-f-]{36}$/);
    const wineId = new URL(page.url()).pathname.split('/').pop()!;
    expect(await stack.db.prepare('SELECT wine_name FROM wines WHERE id=? AND owner_id=?').bind(wineId, owner.user.id).first('wine_name')).toBe('Clos de la Roche typo');
    await page.getByRole('link', { name: 'Edit tasting', exact: true }).click();
    await page.getByRole('textbox', { name: 'Wine name *', exact: true }).fill('Clos de la Roche');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page).toHaveURL(`${stack.origin}/wines/${wineId}`);
    expect(await stack.db.prepare('SELECT wine_name FROM wines WHERE id=?').bind(wineId).first('wine_name')).toBe('Clos de la Roche');
    console.log('Checkpoint: owner save and correction persisted');
    // Same synthetic canvas technique as the existing recognition browser test.
    const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 800; const ctx = canvas.getContext('2d')!; ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 600, 800); ctx.fillStyle = 'black'; ctx.fillText('Journey label', 40, 100); return canvas.toDataURL('image/png').split(',')[1]; });
    await uploadPhoto(page, wineId, png);
    const photo = await stack.db.prepare('SELECT id,object_key FROM wine_images WHERE wine_id=?').bind(wineId).first<{id:string;object_key:string}>();
    expect(photo).toBeTruthy();
    expect(await stack.bucket.head(photo!.object_key)).toBeTruthy();
    console.log('Checkpoint: uploaded photo persisted in local R2');
    // An unrelated wine/photo owned by the same source must not be accessible by
    // substituting its image ID into the granted wine's photo URL.
    const decoy = await api(page, '/api/wines', 'POST', { producer: 'Other estate', wineName: 'Unshared bottle' });
    expect(decoy.status).toBe(201);
    await page.goto(`${stack.origin}/wines/${decoy.body.id}`);
    await uploadPhoto(page, decoy.body.id, png);
    const otherPhotoId = await stack.db.prepare('SELECT id FROM wine_images WHERE wine_id=?').bind(decoy.body.id).first('id');
    await page.goto(`${stack.origin}/wines/${wineId}`);

    await page.getByRole('button', { name: /^Tag friends,/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'member', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm tags', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Tagged with 1 friend');
    expect(await stack.db.prepare('SELECT recipient_id FROM wine_shares WHERE wine_id=?').bind(wineId).first('recipient_id')).toBe(member.user.id);
    console.log('Checkpoint: friend tag persisted');

    await member.page.goto(`${stack.origin}/journal`);
    const sharedCard = member.page.locator(`a[href="/shared/${wineId}"]`).first();
    await expect(sharedCard).toBeVisible();
    const shared = await api(member.page, `/api/shared/wines/${wineId}`);
    expect(shared.status).toBe(200);
    expect(JSON.stringify(shared.body)).not.toContain('OWNER_SECRET');
    expect(shared.body).toMatchObject({ wineName: 'Clos de la Roche', tastingNotes: '', rating: null, venue: null, price: null });
    expect(shared.body).not.toHaveProperty('tags');
    expect((await api(outsider.page, `/api/shared/wines/${wineId}`)).status).toBe(404);
    expect((await api(member.page, `/api/wines/${wineId}`)).status).toBe(404);
    expect((await api(member.page, `/api/wines/${wineId}`, 'PUT', { producer: 'Intruder', wineName: 'Changed' })).status).toBe(404);
    expect((await api(member.page, '/api/journal')).body.items.find((item: {id:string}) => item.id === wineId)).toMatchObject({ shared: true, rating: null, venue: null, tastingDate: '2026-09-01' });

    const imagePath = `/api/shared/wines/${wineId}/photos/${photo!.id}`;
    const original = await image(member.page, imagePath);
    expect(original.status).toBe(200);
    expect(original.bytes).toBe((await stack.bucket.head(photo!.object_key))!.size);
    const thumbnail = await image(member.page, imagePath + '?variant=thumbnail');
    expect(thumbnail.status).toBe(200);
    expect(thumbnail.type).toBe('image/webp');
    await expect.poll(async () => Boolean(await stack.bucket.head(thumbnailObjectKey(photo!.object_key)))).toBe(true);
    // Read again after persistence to exercise the shared derivative/cache path.
    expect((await image(member.page, imagePath + '?variant=thumbnail')).status).toBe(200);
    expect((await image(outsider.page, imagePath)).status).toBe(404);
    expect((await image(member.page, `/api/images/${photo!.id}`)).status).toBe(404);
    expect((await image(member.page, `/api/shared/wines/${wineId}/photos/${otherPhotoId}`)).status).toBe(404);
    const anonymous = await browser.newContext();
    await anonymous.route('**/*', route => new URL(route.request().url()).origin === stack.origin ? route.continue() : route.abort('blockedbyclient'));
    const anonymousPage = await anonymous.newPage();
    await anonymousPage.goto(`${stack.origin}/login`);
    expect((await image(anonymousPage, imagePath)).status).toBe(401);
    await anonymous.close();
    await sharedCard.click();
    await expect(member.page.getByRole('heading', { name: 'Clos de la Roche', exact: true })).toBeVisible();
    await member.page.getByRole('button', { name: /your experience/ }).click();
    await member.page.getByLabel('Sensory notes', { exact: true }).fill('MEMBER_NOTES violets and silk');
    await member.page.getByLabel('Rating / 100', { exact: true }).fill('94');
    await member.page.getByLabel('Drinking date', { exact: true }).fill('2026-09-02');
    await member.page.getByLabel('Tasting / event', { exact: true }).fill('Member dinner');
    await member.page.getByLabel('Venue', { exact: true }).fill('MEMBER_VENUE');
    await member.page.getByLabel('Location', { exact: true }).fill('MEMBER_LOCATION');
    await member.page.getByLabel('Price', { exact: true }).fill('75');
    await member.page.getByLabel('Currency', { exact: true }).fill('eur');
    await member.page.getByRole('combobox', { name: /^Acidity/ }).selectOption('high');
    await member.page.getByRole('button', { name: 'Save experience', exact: true }).click();
    await expect(member.page.getByRole('status')).toContainText('Your experience was saved');
    await member.page.getByRole('button', { name: 'Add to favorites', exact: true }).click();
    await member.page.reload();
    await expect(member.page.getByText('MEMBER_NOTES violets and silk', { exact: true })).toBeVisible();
    const experience = await stack.db.prepare('SELECT * FROM shared_wine_preferences WHERE wine_id=? AND recipient_id=?').bind(wineId, member.user.id).first();
    expect(experience).toMatchObject({ tasting_notes: 'MEMBER_NOTES violets and silk', rating: 94, venue: 'MEMBER_VENUE', currency: 'EUR', favorite: 1, structure_json: '{"acidity":"high"}' });
    expect(await stack.db.prepare('SELECT count(*) AS n FROM wines WHERE owner_id=?').bind(member.user.id).first('n')).toBe(0);
    expect((await api(owner.page, `/api/wines/${wineId}`)).body).toMatchObject({ tastingNotes: 'OWNER_SECRET_NOTES', rating: 91, venue: 'OWNER_SECRET_VENUE' });
    console.log('Checkpoint: isolated recipient experience persisted');

    // A non-lexical query must find the shared wine via actual persisted vectors.
    const query = 'elegant floral bottle for a quiet evening';
    await member.page.goto(`${stack.origin}/journal`);
    await member.page.getByRole('searchbox', { name: 'Search wines' }).fill(query);
    await member.page.getByRole('button', { name: 'Run smart search' }).click();
    await expect.poll(async () => Number(await stack.db.prepare('SELECT count(*) AS n FROM wine_semantic_embeddings WHERE owner_id=? AND wine_id=?').bind(member.user.id, wineId).first('n')), { timeout: 15_000 }).toBe(1);
    await member.page.getByRole('button', { name: 'Run smart search' }).click();
    await expect(member.page.locator(`a[href="/shared/${wineId}"]`).first()).toBeVisible();
    const indexedDocuments = stack.providerCalls.filter(call => call.kind === 'embedding').flatMap(call => call.texts ?? []);
    expect(indexedDocuments.join('\n')).toContain('MEMBER_NOTES');
    expect(indexedDocuments.join('\n')).not.toContain('OWNER_SECRET');
    console.log('Checkpoint: shared wine found through persisted Smart Search vectors');

    // A separately owned matching bottle adopts factual research through the
    // real GET path. Reuse the existing quality-gated adoption fixture.
    const facts = { producer: 'Domaine Dujac', wineName: 'Clos de la Roche', vintage: 2019, country: 'France', region: 'Burgundy', appellation: 'Clos de la Roche', wineStyle: 'red' };
    const sourceWine = (await api(owner.page, `/api/wines/${wineId}`)).body;
    const target = buildResearchTargets(sourceWine).find(target => target.scope === 'producer')!;
    await upsertResearchCache(stack.db as unknown as D1Database, owner.user.id, producerEntry(target));
    const ownSave = await api(member.page, '/api/wines', 'POST', { ...blank, ...facts, tastingNotes: 'Independent bottle' });
    expect(ownSave.status).toBe(201);
    const ownId = ownSave.body.id;
    expect((await api(member.page, `/api/wines/${ownId}`)).body.deepSearch.producerDetails).toContain('Morey-Saint-Denis');
    await expect.poll(() => stack.db.prepare("SELECT source_user_id FROM research_cache WHERE owner_id=? AND scope='producer'").bind(member.user.id).first('source_user_id')).toBe(owner.user.id);
    expect(await stack.db.prepare('SELECT count(*) AS n FROM reusable_research WHERE contributor_id=?').bind(member.user.id).first('n')).toBe(0);

    // Owner corrections flow through without overwriting the member's experience.
    await page.goto(`${stack.origin}/wines/${wineId}/edit`);
    await page.getByLabel('Alcohol %', { exact: true }).fill('13.5');
    await page.getByRole('textbox', { name: 'Wine name *', exact: true }).fill('Clos de la Roche corrected');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page).toHaveURL(`${stack.origin}/wines/${wineId}`);
    await member.page.goto(`${stack.origin}/shared/${wineId}`);
    await expect(member.page.getByRole('heading', { name: 'Clos de la Roche corrected', exact: true })).toBeVisible();
    expect((await api(member.page, `/api/shared/wines/${wineId}`)).body).toMatchObject({ alcoholPercentage: 13.5, tastingNotes: 'MEMBER_NOTES violets and silk', rating: 94, price: 75 });
    await api(member.page, `/api/journal?query=${encodeURIComponent(query)}&semantic=1`);
    await expect.poll(async () => {
      const revision = await stack.db.prepare('SELECT source_updated_at FROM wine_semantic_embeddings WHERE owner_id=? AND wine_id=?').bind(member.user.id, wineId).first<string>('source_updated_at');
      return revision;
    }).toBe(await stack.db.prepare('SELECT updated_at FROM wines WHERE id=?').bind(wineId).first('updated_at'));
    expect((await api(member.page, `/api/journal?query=${encodeURIComponent(query)}&semantic=1`)).body.items.some((item: {id:string}) => item.id === wineId)).toBe(true);

    await page.getByRole('button', { name: /^Tag friends,/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: /member/ }).click();
    await page.getByRole('button', { name: 'Confirm tags', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Friend tags removed');
    expect(await stack.db.prepare('SELECT count(*) AS n FROM wine_shares WHERE wine_id=?').bind(wineId).first('n')).toBe(0);
    expect((await api(member.page, `/api/shared/wines/${wineId}`)).status).toBe(404);
    expect((await api(member.page, `/api/shared/wines/${wineId}/experience`, 'PUT', { tastingNotes: 'After revoke' })).status).toBe(404);
    expect((await image(member.page, imagePath)).status).toBe(404);
    expect((await image(member.page, imagePath + '?variant=thumbnail')).status).toBe(404);
    expect((await image(owner.page, `/api/images/${photo!.id}`)).status).toBe(200);
    for (const path of ['/api/journal', `/api/journal?query=${encodeURIComponent(query)}&semantic=1`, '/api/shared/wines']) {
      expect((await api(member.page, path)).body.items.some((item: {id:string}) => item.id === wineId)).toBe(false);
    }
    await member.page.goto(`${stack.origin}/journal?query=${encodeURIComponent(query)}&semantic=1`);
    await expect(member.page.locator(`a[href="/shared/${wineId}"]`)).toHaveCount(0);
    await member.page.goto(`${stack.origin}/shared/${wineId}`);
    await expect(member.page.getByRole('alert')).toContainText('Shared wine not found');
    // Even ending friendship cannot take back research already adopted on an
    // independently owned wine. It also must not become the reader's contribution.
    expect((await api(member.page, `/api/friends/${owner.user.id}`, 'DELETE')).status).toBe(200);
    expect((await api(member.page, `/api/wines/${ownId}`)).body.deepSearch.producerDetails).toContain('Morey-Saint-Denis');
    expect(await stack.db.prepare("SELECT source_user_id FROM research_cache WHERE owner_id=? AND scope='producer'").bind(member.user.id).first('source_user_id')).toBe(owner.user.id);
    expect(await stack.db.prepare('SELECT count(*) AS n FROM reusable_research WHERE contributor_id=?').bind(member.user.id).first('n')).toBe(0);
    expect(stack.providerCalls.some(call => call.kind === 'embedding')).toBe(true);
    expect(await stack.db.prepare('SELECT count(*) AS n FROM member_ai_action_usage').first('n')).toBe(0);
    expect(stack.unexpectedOutbound).toEqual([]);
    passed = true;
  } finally { await stack.close({ preserve: !passed }); }
});

async function image(page: Page, path: string) {
  return page.evaluate(async path => { const response = await fetch(path); return { status: response.status, bytes: (await response.arrayBuffer()).byteLength, cache: response.headers.get('cache-control'), type: response.headers.get('content-type') }; }, path);
}

async function uploadPhoto(page: Page, wineId: string, png: string) {
  const uploaded = page.waitForResponse(response => response.url().endsWith(`/api/wines/${wineId}/images`) && response.request().method() === 'POST');
  await page.locator('input[type=file]').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  expect((await uploaded).ok()).toBe(true);
}
