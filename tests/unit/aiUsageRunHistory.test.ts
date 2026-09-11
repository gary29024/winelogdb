import { describe,expect,it } from 'vitest';
import { recordAiUsage,usageRunHistory,usageSummary } from '../../src/lib/usage/aiUsage';
import { DEFAULT_RATES } from '../../src/lib/usage/rates';
import { migratedSqliteD1 } from './support/sqliteD1';

describe('AI spend run history',()=>{
  it('keeps aggregate spend separate and groups requested research runs with useful labels',async()=>{
    const {db,sqlite}=migratedSqliteD1();
    try{
      const stamp=new Date().toISOString();
      sqlite.prepare(`INSERT INTO producers(id,owner_id,canonical_name,match_key,created_at,updated_at)
        VALUES('p1','owner','Domaine Test','domaine test',?,?)`).run(stamp,stamp);
      sqlite.prepare(`INSERT INTO wines(id,owner_id,producer,wine_name,vintage,created_at,updated_at)
        VALUES('w1','owner','Domaine Test','Les Suchots',2020,?,?)`).run(stamp,stamp);
      const vintageKey=JSON.stringify(['france|burgundy',2019,'red']);

      await recordAiUsage({DB:db},'owner',{kind:'producer_research',runId:'producer-run',targetId:'p1',eventId:'producer-1',model:'gemini-3.8-flash',tier:'batch',requests:1,searchQueries:2,promptTokens:1000,outputTokens:2000});
      await recordAiUsage({DB:db},'owner',{kind:'producer_research',runId:'producer-run',targetId:'p1',eventId:'producer-2',model:'gemini-3.7-flash',tier:'batch',requests:1,searchQueries:3,promptTokens:500,outputTokens:800});
      await recordAiUsage({DB:db},'owner',{kind:'wine_research',runId:'wine-run',targetId:'w1',eventId:'wine-1',model:'gemini-3.8-flash',tier:'batch',requests:1,searchQueries:4,promptTokens:900,outputTokens:1200});
      await recordAiUsage({DB:db},'owner',{kind:'vintage_window',runId:'vintage-run',targetId:vintageKey,eventId:'vintage-1',model:'gemini-3.1-flash-lite',requests:1,searchQueries:1,promptTokens:600,outputTokens:700});

      const summary=await usageSummary(db,'owner',DEFAULT_RATES,30);
      expect(summary.kinds.find(kind=>kind.kind==='producer_research')?.runs).toBe(1);
      expect('recentRuns' in summary).toBe(false);

      const producerHistory=await usageRunHistory(db,'owner',DEFAULT_RATES,'producer_research',30);
      const producer=producerHistory.runs[0];
      expect(producer).toMatchObject({runId:'producer-run',targetId:'p1',targetLabel:'Domaine Test',requests:2,searchQueries:5,promptTokens:1500,outputTokens:2800});
      expect(producer?.parts).toHaveLength(2);
      expect(producer?.cost).toBeCloseTo(producer!.parts.reduce((total,part)=>total+part.cost,0),8);

      expect((await usageRunHistory(db,'owner',DEFAULT_RATES,'wine_research',30)).runs[0]).toMatchObject({
        runId:'wine-run',targetId:'w1',targetLabel:'Domaine Test · 2020 · Les Suchots',requests:1,searchQueries:4
      });
      expect((await usageRunHistory(db,'owner',DEFAULT_RATES,'vintage_window',30)).runs[0]).toMatchObject({
        runId:'vintage-run',targetId:vintageKey,targetLabel:'Burgundy · 2019 · Red',requests:1,searchQueries:1
      });
    }finally{sqlite.close()}
  });

  it('keeps legacy vintage rows usable when no target key was recorded',async()=>{
    const {db,sqlite}=migratedSqliteD1();
    try{
      await recordAiUsage({DB:db},'owner',{kind:'vintage_window',runId:'old-vintage',eventId:'old-vintage-1',model:'gemini-3.1-flash-lite',requests:1,searchQueries:1,promptTokens:200,outputTokens:300});
      expect((await usageRunHistory(db,'owner',DEFAULT_RATES,'vintage_window',30)).runs[0]).toMatchObject({
        runId:'old-vintage',targetId:null,targetLabel:null
      });
    }finally{sqlite.close()}
  });

  it('still counts recognition runs in the cheap aggregate summary',async()=>{
    const {db,sqlite}=migratedSqliteD1();
    try{
      await recordAiUsage({DB:db},'owner',{kind:'scan_single',runId:'scan-run',eventId:'scan-1',model:'gemini-3.1-flash-lite',requests:1,units:1,promptTokens:500,outputTokens:300});
      const summary=await usageSummary(db,'owner',DEFAULT_RATES,30);
      expect(summary.kinds.find(kind=>kind.kind==='scan_single')?.runs).toBe(1);
    }finally{sqlite.close()}
  });

  it('returns at most the latest 100 logical runs',async()=>{
    const {db,sqlite}=migratedSqliteD1();
    try{
      for(let index=0;index<105;index++)await recordAiUsage({DB:db},'owner',{
        kind:'producer_research',runId:`run-${index}`,eventId:`event-${index}`,model:'gemini-3.8-flash',requests:1,promptTokens:10,outputTokens:20
      });
      expect((await usageRunHistory(db,'owner',DEFAULT_RATES,'producer_research',30)).runs).toHaveLength(100);
    }finally{sqlite.close()}
  });
});
