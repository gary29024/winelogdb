import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { realD1 } from './support/realD1';
import { createWineResearchRun } from '../../src/lib/research/backgroundJobs';
import { createResearchBatchJob } from '../../src/lib/research/batchJobStore';

let database:ReturnType<typeof realD1>;
const daysAgo=(days:number)=>new Date(Date.now()-days*86400_000).toISOString();

beforeEach(()=>{
  // Months from SQLite's own clock, as the Deep Search persistence tests run.
  // Measured on SQLite's clock, the run created at this time was more than 30
  // days old and deleted as it was created, which failed 54 of those tests.
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-25T04:00:00.000Z'));
  database=realD1();
  database.sql.exec("INSERT INTO app_users(id,email,display_name,role) VALUES('alice','alice@example.com','Alice','member'); INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES('krug','alice','Krug','Grande Cuvée','now','now')");
});
afterEach(()=>{vi.useRealTimers();database.close()});

describe('research history retention',()=>{
  it('keeps the run it creates and removes runs untouched for 30 days',async()=>{
    for(const [id,days] of [['run-old-0000',31],['run-recent-0000',29]] as const)
      database.sql.prepare("INSERT INTO wine_research_runs(owner_id,request_id,wine_id,status,stage,started_at,updated_at) VALUES('alice',?,'krug','complete','complete',?,?)").run(id,daysAgo(days),daysAgo(days));
    const created=await createWineResearchRun(database.db,'alice','krug','none','run-new-0000');
    expect(created?.run).toMatchObject({requestId:'run-new-0000',status:'running'});
    expect(database.sql.prepare('SELECT request_id FROM wine_research_runs ORDER BY request_id').all().map(row=>row.request_id)).toEqual(['run-new-0000','run-recent-0000']);
  });

  it('removes finished batch jobs untouched for 30 days, never a running one',async()=>{
    for(const [id,status,days] of [['finished-old','complete',31],['running-old','running',31],['finished-recent','failed',29]] as const)
      database.sql.prepare("INSERT INTO research_batch_jobs(id,owner_id,request_id,target_kind,target_id,google_batch_name,model,status,created_at,updated_at) VALUES(?,'alice',?,'wine','krug','batches/x','model',?,?,?)").run(id,id,status,daysAgo(days),daysAgo(days));
    const created=await createResearchBatchJob(database.db,{owner:'alice',requestId:'new',targetKind:'wine',targetId:'krug',googleBatchName:'batches/new',model:'model',attempt:1,keys:[]});
    expect(database.sql.prepare('SELECT request_id FROM research_batch_jobs ORDER BY request_id').all().map(row=>row.request_id)).toEqual(['finished-recent','new','running-old']);
    expect(database.sql.prepare('SELECT id FROM research_batch_jobs WHERE request_id=?').get('new')!.id).toBe(created);
  });
});
