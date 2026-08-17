import { Hono } from 'hono';
import baseApp from './index';
import { requireSession } from '../src/lib/auth/session';
import { runLayeredDeepSearch } from '../src/lib/research/deepSearch';

type Bindings={
  DB:D1Database;
  WINE_IMAGES:R2Bucket;
  ASSETS:Fetcher;
  GEMINI_API_KEY:string;
  AUTH_SECRET:string;
  APP_PASSWORD:string;
  APP_URL:string;
  MAX_FILE_BYTES?:string;
  MAX_BATCH_FILES?:string;
};

type AppEnv={Bindings:Bindings};
const app=new Hono<AppEnv>();

app.post('/api/wines/:id/deep-search',async c=>{
  const origin=c.req.header('Origin');
  if(origin&&origin===c.env.APP_URL){c.header('Access-Control-Allow-Origin',origin);c.header('Vary','Origin')}
  try{
    const session=await requireSession(c.req.header('Authorization'),c.env.AUTH_SECRET);
    const body=await c.req.json().catch(()=>({})) as {confirmation?:string;refresh?:'none'|'vintage'|'all'};
    const result=await runLayeredDeepSearch(c.env,session.userId,c.req.param('id'),body);
    return c.json(result.body,result.status);
  }catch{return c.json({error:'Unauthorized'},401)}
});

// Everything except Deep Search stays on the existing, already-tested Worker app.
app.all('*',c=>baseApp.fetch(c.req.raw,c.env,c.executionCtx));

export default app;
