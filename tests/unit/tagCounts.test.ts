import { describe, expect, it } from 'vitest';
import { listTagCounts } from '../../src/lib/journal/tagCounts';
import { migratedSqliteD1 } from './support/sqliteD1';

describe('counting the hashtags on your wines', () => {
  it('counts each wine once per tag, ignores capitals, and leaves other people out', async () => {
    const { db, sqlite } = migratedSqliteD1();
    const add = sqlite.prepare(
      'INSERT INTO wines(id,owner_id,producer,wine_name,tags_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
    );
    const now = '2026-11-12T00:00:00.000Z';
    add.run(
      'w1',
      'alice',
      'Dujac',
      'Clos de la Roche',
      JSON.stringify(['Burgundy', 'birthday', 'Pinot Noir']),
      now,
      now,
    );
    add.run('w2', 'alice', 'Roulot', 'Meursault', JSON.stringify(['burgundy', ' Burgundy ', '']), now, now);
    add.run('w3', 'alice', 'Krug', 'Grande Cuvée', '[]', now, now);
    add.run('w4', 'bob', 'Roumier', 'Bonnes-Mares', JSON.stringify(['Burgundy', 'secret']), now, now);

    expect(await listTagCounts(db, 'alice')).toEqual([
      { tag: 'Burgundy', wines: 2 },
      { tag: 'birthday', wines: 1 },
      { tag: 'Pinot Noir', wines: 1 },
    ]);
    expect(await listTagCounts(db, 'alice', 1)).toEqual([{ tag: 'Burgundy', wines: 2 }]);
    expect(await listTagCounts(db, 'nobody')).toEqual([]);
  });
});
