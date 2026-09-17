import { describe,it,expect,vi } from 'vitest';
import { migratedSqliteD1 } from './support/sqliteD1';
import { recordAiUsage } from '../../src/lib/usage/aiUsage';

describe('persisted AI response accounting',()=>{
  it('deduplicates batch polling in both the event ledger and monthly totals',async()=>{
    const {db,sqlite}=migratedSqliteD1(),writeDataPoint=vi.fn();
    vi.useFakeTimers({toFake:['Date']});
    vi.setSystemTime(new Date('2026-09-10T12:00:00.000Z'));
    try{
      const event={kind:'scan_batch' as const,runId:'session',eventId:'provider-job:item',model:'gemini-test',tier:'batch' as const,promptTokens:1200,outputTokens:400,units:1};
      await recordAiUsage({DB:db,AI_USAGE:{writeDataPoint}},'owner',event);
      await recordAiUsage({DB:db,AI_USAGE:{writeDataPoint}},'owner',event);
      expect(sqlite.prepare('SELECT count(*) AS count FROM ai_usage_events').get()?.count).toBe(1);
      expect(sqlite.prepare('SELECT requests,prompt_tokens,output_tokens,units FROM ai_usage_monthly').get()).toEqual({requests:1,prompt_tokens:1200,output_tokens:400,units:1});
      expect(writeDataPoint).toHaveBeenCalledTimes(1);
      // A fresh generation is a new bill even with the same run and target.
      await recordAiUsage({DB:db},'owner',{...event,eventId:undefined,units:0});
      await recordAiUsage({DB:db},'owner',{...event,eventId:undefined,units:0});
      expect(sqlite.prepare('SELECT requests,units FROM ai_usage_monthly').get()).toEqual({requests:3,units:1});
    }finally{vi.useRealTimers();sqlite.close()}
  });
});


it('rolls back the monthly increment when the following event insert fails',async()=>{
  const {db,sqlite}=migratedSqliteD1();
  try{
    sqlite.exec("CREATE TRIGGER reject_usage BEFORE INSERT ON ai_usage_events BEGIN SELECT RAISE(ABORT,'test event insert failure'); END");
    const event={kind:'scan_batch' as const,runId:'s',eventId:'job:item',model:'test',promptTokens:100};
    await recordAiUsage({DB:db},'owner',event);
    expect(sqlite.prepare('SELECT count(*) AS count FROM ai_usage_monthly').get()?.count).toBe(0);
    expect(sqlite.prepare('SELECT count(*) AS count FROM ai_usage_events').get()?.count).toBe(0);
    sqlite.exec('DROP TRIGGER reject_usage');
    await recordAiUsage({DB:db},'owner',event);
    await recordAiUsage({DB:db},'owner',event);
    expect(sqlite.prepare('SELECT requests,prompt_tokens FROM ai_usage_monthly').get()).toEqual({requests:1,prompt_tokens:100});
  }finally{sqlite.close()}
});
