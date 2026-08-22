import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';

describe('group recognition session migration',()=>{
  it('stores server-side sessions, item links and retained source context',()=>{
    const sql=readFileSync('src/lib/db/migrations/0026_group_recognition_sessions.sql','utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS group_recognition_sessions');
    expect(sql).toContain('original_object_key TEXT NOT NULL');
    expect(sql).toContain('preview_object_key TEXT NOT NULL');
    expect(sql).toContain('retained INTEGER NOT NULL DEFAULT 0');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS group_recognition_items');
    expect(sql).toContain('saved_wine_id TEXT');
    expect(sql).toContain('UNIQUE(owner_id, session_id, client_key)');
  });
});
