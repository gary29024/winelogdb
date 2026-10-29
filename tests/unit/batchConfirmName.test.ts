import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { realD1 } from './support/realD1';
import { hash,seconds,stamp } from '../../worker/multiUser/common';
import publicWorker from '../../worker/multiUserEntry';

let database:ReturnType<typeof realD1>;

beforeEach(async()=>{
  database=realD1();
  database.sql.prepare("INSERT INTO app_users(id,email,display_name,role) VALUES('member','member@example.com','Member','member') ON CONFLICT(id) DO UPDATE SET role='member',status='active'").run();
  database.sql.prepare('INSERT INTO auth_sessions VALUES(?,?,?)').run(await hash('member-session'),'member',seconds()+3600);
  // A wine recognized as "A4 Chardonnay", waiting for review.
  const now=stamp(),expires=new Date(Date.now()+3600_000).toISOString();
  database.sql.prepare(`INSERT INTO batch_recognition_sessions(id,owner_id,status,total_items,expected_items,created_at,updated_at,expires_at)
    VALUES('batch','member','ready',1,1,?,?,?)`).run(now,now,expires);
  database.sql.prepare(`INSERT INTO batch_recognition_items(id,owner_id,session_id,position,status,metadata_json,recognition_json,created_at,updated_at)
    VALUES('item','member','batch',0,'ready','[]',?,?,?)`).run(JSON.stringify({producer:'Domaine Test',wineName:'A4 Chardonnay',vintage:2024,confidence:0.9}),now,now);
});
afterEach(()=>{database.close();vi.restoreAllMocks()});

const env=()=>({
  DB:database.db,AUTH_SECRET:'a'.repeat(48),APP_URL:'https://wine.example',
  WINE_IMAGES:{get:async()=>null,put:async()=>({}),delete:async()=>undefined},
  RESEARCH_QUEUE:{send:vi.fn(async()=>undefined)},
  ASSETS:{fetch:vi.fn(async()=>Response.json({},{status:404}))}
}) as unknown as Parameters<typeof publicWorker.fetch>[1];
const ctx=()=>({waitUntil:vi.fn(),passThroughOnException:vi.fn()}) as unknown as ExecutionContext;
const headers={Cookie:'__Host-winelog=member-session',Origin:'https://wine.example','Content-Type':'application/json'};

/** Confirm the reviewed wine, with the name typed and the label reading the form sends beside it. */
async function confirm(wineName:string,recognizedWineName:string){
  const wine={producer:'Domaine Test',wineName,vintage:2024,recognizedProducer:'Domaine Test',recognizedWineName,recognizedVintageText:'2024',
    country:'Australia',region:null,appellation:null,grapes:[],grapeBlend:[],wineStyle:'white',tastingNotes:'',tags:[],recognitionStatus:'complete',referenceDecision:{action:'unmatched'}};
  const response=await publicWorker.fetch(new Request('https://wine.example/api/batch-recognition/sessions/batch/items/item/confirm',{method:'POST',headers,body:JSON.stringify({wine})}),env(),ctx());
  expect(response.status).toBe(200);
  const {id}=await response.json() as {id:string};
  return database.sql.prepare('SELECT wine_name FROM wines WHERE id=?').get(id)!.wine_name;
}
async function card(){
  const response=await publicWorker.fetch(new Request('https://wine.example/api/batch-recognition/sessions/batch',{headers}),env(),ctx());
  return (await response.json() as {items:Array<{saved:{wineName:string}|null}>}).items[0].saved;
}

describe('confirming a wine renamed in Batch Scan review',()=>{
  it('saves it under the new name when the reading is replaced, as the form now sends it',async()=>{
    expect(await confirm('A4 Reserve Chardonnay','A4 Reserve Chardonnay')).toBe('A4 Reserve Chardonnay');
    expect(await card()).toMatchObject({wineName:'A4 Reserve Chardonnay'});
  });

  it('files it back under the label reading when that is sent beside the new name',async()=>{
    // The reported bug, end to end: the wine's cuvée is resolved from the
    // reading, and the save takes the cuvée's name over the one typed.
    expect(await confirm('A4 Reserve Chardonnay','A4 Chardonnay')).toBe('A4 Chardonnay');
  });
});
