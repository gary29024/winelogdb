import { describe,expect,it } from 'vitest';
import { recordAiUsage,usageSummary } from '../../src/lib/usage/aiUsage';
import { DEFAULT_RATES } from '../../src/lib/usage/rates';
import { migratedSqliteD1 } from './support/sqliteD1';

describe('AI spend run history',()=>{
  it('groups research calls into named producer, wine and vintage runs',async()=>{
    const {db,sqlite}=migratedSqliteD1();
    try{
      const stamp=new Date().toISOString();
      sqlite.prepare(`INSERT INTO producers(id,owner_id,canonical_name,match_key,created_at,updated_at)
        VALUES('p1','owner','Domaine Test','domaine test',?,?)`).run(stamp,stamp);
      sqlite.prepare(`INSERT INTO wines(id,owner_id,producer,wine_name,vintage,created_at,updated_at)
        VALUES('w1','owner','Domaine Test','Les Suchots',2020,?,?)`).run(stamp,stamp);

      await recordAiUsage({DB:db},'owner',{kind:'producer_research',runId:'producer-run',targetId:'p1',eventId:'producer-1',model:'gemini-3.8-flash',tier:'batch',requests:1,searchQueries:2,promptTokens:1000,outputTokens:2000});
      await recordAiUsage({DB:db},'owner',{kind:'producer_research',runId:'producer-run',targetId:'p1',eventId:'producer-2',model:'gemini-3.7-flash',tier:'batch',requests:1,searchQueries:3,promptTokens:500,outputTokens:800});
      await recordAiUsage({DB:db},'owner',{kind:'wine_research',runId:'wine-run',targetId:'w1',eventId:'wine-1',model:'gemini-3.8-flash',tier:'batch',requests:1,searchQueries:4,promptTokens:900,outputTokens:1200});
      await recordAiUsage({DB:db},'owner',{kind:'vintage_window',runId:'vintage-run',eventId:'vintage-1',model:'gemini-3.1-flash-lite',requests:1,searchQueries:1,promptTokens:600,outputTokens:700});

      const summary=await usageSummary(db,'owner',DEFAULT_RATES,30);
      const producer=summary.recentRuns.producer_research?.[0];
      expect(producer).toMatchObject({runId:'producer-run',targetId:'p1',targetLabel:'Domaine Test',requests:2,searchQueries:5,promptTokens:1500,outputTokens:2800});
      expect(producer?.parts).toHaveLength(2);
      expect(producer?.cost).toBeCloseTo(producer!.parts.reduce((total,part)=>total+part.cost,0),8);
      expect(summary.kinds.find(kind=>kind.kind==='producer_research')?.runs).toBe(1);

      expect(summary.recentRuns.wine_research?.[0]).toMatchObject({
        runId:'wine-run',targetId:'w1',targetLabel:'Domaine Test · 2020 · Les Suchots',requests:1,searchQueries:4
      });
      expect(summary.recentRuns.vintage_window?.[0]).toMatchObject({
        runId:'vintage-run',targetId:null,targetLabel:null,requests:1,searchQueries:1
      });
    }finally{sqlite.close()}
  });

  it('does not expose recognition runs in the research drill-down payload',async()=>{
    const {db,sqlite}=migratedSqliteD1();
    try{
      await recordAiUsage({DB:db},'owner',{kind:'scan_single',runId:'scan-run',eventId:'scan-1',model:'gemini-3.1-flash-lite',requests:1,units:1,promptTokens:500,outputTokens:300});
      const summary=await usageSummary(db,'owner',DEFAULT_RATES,30);
      expect(summary.kinds.find(kind=>kind.kind==='scan_single')?.runs).toBe(1);
      expect(summary.recentRuns.scan_single).toBeUndefined();
    }finally{sqlite.close()}
  });
});
