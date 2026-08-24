import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';

const migration=readFileSync('src/lib/db/migrations/0031_journey_cache_and_read_indexes.sql','utf8');

describe('journey cache migration',()=>{
  it('keys the cached payload on the owner and its payload version',()=>{
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS journey_summary_cache/);
    expect(migration).toMatch(/owner_id TEXT PRIMARY KEY/);
    expect(migration).toMatch(/payload_version INTEGER NOT NULL/);
  });

  it('bumps the shared revision for every table the cached payload reads',()=>{
    for(const trigger of ['owner_rev_structures_insert','owner_rev_structures_update','owner_rev_structures_delete','owner_rev_wine_images_insert','owner_rev_wine_images_delete']){
      expect(migration).toContain(trigger);
    }
  });

  it('leaves wine_experiences out of the revision, since nothing cached reads it',()=>{
    expect(migration).not.toMatch(/ON wine_experiences/);
  });

  it('is re-runnable, so a partially applied migration does not wedge a deploy',()=>{
    const statements=migration.match(/CREATE (?:TABLE|TRIGGER|INDEX)[^\n]*/g)??[];
    expect(statements.length).toBeGreaterThan(0);
    for(const statement of statements)expect(statement).toContain('IF NOT EXISTS');
  });
});
