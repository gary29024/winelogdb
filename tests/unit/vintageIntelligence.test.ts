import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { vintageQualitySchema,vintageScoreLabel,vintageWindowSchema } from '../../src/lib/maturity/vintageWindow';

describe('WineLog Vintage Intelligence',()=>{
  it('keeps the displayed quality band deterministic',()=>{
    expect(vintageScoreLabel(95)).toBe('Exceptional');
    expect(vintageScoreLabel(94)).toBe('Outstanding');
    expect(vintageScoreLabel(89)).toBe('Excellent');
    expect(vintageScoreLabel(84)).toBe('Very good');
    expect(vintageScoreLabel(79)).toBe('Good');
    expect(vintageScoreLabel(70)).toBe('Variable');
    expect(vintageScoreLabel(null)).toBeNull();
  });

  it('accepts a source-aware consensus and rejects false precision outside the rubric',()=>{
    const quality=vintageQualitySchema.parse({score:93,confidence:'high',consensus:'Broadly excellent vintage.',
      strengths:['ripe tannins','freshness'],cautions:['warmest sites']});
    expect(quality.score).toBe(93);
    expect(vintageQualitySchema.safeParse({...quality,score:101}).success).toBe(false);
    expect(vintageQualitySchema.safeParse({...quality,score:69}).success).toBe(false);
  });

  it('allows an evidence gap without inventing a score',()=>{
    const quality=vintageQualitySchema.parse({score:null,confidence:'low',consensus:'Evidence is too thin.',strengths:[],cautions:[]});
    expect(quality.score).toBeNull();
  });

  it('keeps old cached vintage-window payloads valid until refreshed',()=>{
    const old=vintageWindowSchema.parse({drinkFrom:2028,drinkTo:2040,note:'Existing grounded lookup.',sources:[]});
    expect(old.quality).toBeNull();
  });

  it('adds one nullable JSON column rather than a second vintage cache',()=>{
    const migration=readFileSync('src/lib/db/migrations/0054_vintage_intelligence.sql','utf8');
    expect(migration).toContain('ALTER TABLE vintage_windows ADD COLUMN quality_json TEXT');
    expect(migration).not.toMatch(/CREATE TABLE/i);
  });
});
