import { Hono } from 'hono';
import baseApp from './index';
import layeredApp from './layered';
import { applyJournalVintageSearch } from '../src/lib/journal/searchQuery';
import { handleRecognitionRequest } from './recognitionHandler';

type Bindings={DB:D1Database;WINE_IMAGES:R2Bucket;ASSETS:Fetcher;GEMINI_API_KEY:string;AUTH_SECRET:string;APP_PASSWORD:string;APP_URL:string;MAX_FILE_BYTES?:string;MAX_BATCH_FILES?:string};
type AppEnv={Bindings:Bindings};
const app=new Hono<AppEnv>();

app.post('/api/recognition',c=>handleRecognitionRequest(c.req.raw,c.env));

app.get('/api/wines',c=>{
  const url=new URL(c.req.raw.url);
  if(!applyJournalVintageSearch(url))return layeredApp.fetch(c.req.raw,c.env,c.executionCtx);
  const request=new Request(url.toString(),{method:'GET',headers:c.req.raw.headers});
  return layeredApp.fetch(request,c.env,c.executionCtx);
});

app.all('*',c=>layeredApp.fetch(c.req.raw,c.env,c.executionCtx));
export default app;
