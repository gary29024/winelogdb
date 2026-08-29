import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';

const migration=readFileSync('src/lib/db/migrations/0041_tasting_sessions.sql','utf8');

describe('the tasting session migration',()=>{
  it('adds the three columns a live session needs',()=>{
    for(const column of ['started_at','ended_at','last_wine_at'])
      expect(migration).toContain(`ALTER TABLE tastings ADD COLUMN ${column} TEXT`);
  });

  it('makes one open tasting per owner a database invariant',()=>{
    // A convention enforced in three places is a convention broken in one.
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS idx_tastings_open_owner/);
  });

  it('requires started_at as well as a null ended_at for "open"',()=>{
    // Both halves are load-bearing. The tastings table has been written on every
    // wine save since 0002, and resolveTasting still creates rows implicitly
    // whenever an event name is typed into the form. Those rows have a null
    // ended_at, so "ended_at IS NULL" alone would read every one of them - past
    // and future - as a tasting that is happening right now.
    const index=migration.match(/CREATE UNIQUE INDEX IF NOT EXISTS idx_tastings_open_owner[\s\S]*?;/)?.[0]??'';
    expect(index).toContain('ended_at IS NULL');
    expect(index).toContain('started_at IS NOT NULL');
  });

  it('keeps the wine list beside the tasting and cascades it away with it',()=>{
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS tasting_documents/);
    expect(migration).toMatch(/REFERENCES tastings\(id\) ON DELETE CASCADE/);
  });

  it('adds no trigger on tastings',()=>{
    // Nothing cached reads this table, for the reason 0031 gives about
    // wine_experiences: a trigger here would invalidate the whole Passport
    // payload every time a wine joined an evening.
    expect(migration).not.toMatch(/CREATE TRIGGER/i);
  });

  it('is re-runnable, so a partially applied migration does not wedge a deploy',()=>{
    for(const statement of migration.match(/CREATE (?:TABLE|INDEX|UNIQUE INDEX)[^\n]*/g)??[])
      expect(statement).toContain('IF NOT EXISTS');
  });
});
