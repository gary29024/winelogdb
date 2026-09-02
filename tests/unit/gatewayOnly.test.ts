import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { resolveGeminiTransport } from '../../worker/geminiTransport';
import { fetchGeminiBatch } from '../../src/lib/research/geminiBatch';
import { cancelGeminiBatch } from '../../src/lib/research/cancelResearch';

const gateway={CF_AI_GATEWAY_TOKEN:'t',AI_GATEWAY_ACCOUNT_ID:'a',AI_GATEWAY_ID:'g',
  VERTEX_PROJECT_ID:'p',VERTEX_REGION:'global'};

describe('running with no direct Gemini key at all',()=>{
  it('resolves to the gateway, because that is what is configured',()=>{
    // The deployment has GEMINI_API_KEY removed. Every call has to reach Vertex
    // through AI Gateway or not go out at all.
    expect(resolveGeminiTransport(gateway)).toBe('vertex-ai-gateway');
    expect(resolveGeminiTransport({...gateway,GEMINI_API_KEY:''})).toBe('vertex-ai-gateway');
  });

  it('says what is missing rather than falling back silently',()=>{
    // A half-configured gateway must not quietly become a direct call to an
    // endpoint that has no credential.
    expect(()=>resolveGeminiTransport({AI_GATEWAY_ACCOUNT_ID:'a'})).toThrow(/incomplete/);
    expect(()=>resolveGeminiTransport({})).toThrow(/No Gemini transport/);
  });

  it('registers the batch gateway under the same handle the callers pass',()=>{
    // The research paths hand env.GEMINI_API_KEY to createGeminiBatch as a
    // credential handle, and it is now undefined. configureGeminiBatchGateway
    // keys on String(apiKey ?? ''), so both sides agree on '' and the gateway
    // runtime is found - which is the only reason deep search still works.
    const source=readFileSync('src/lib/research/geminiBatch.ts','utf8');
    expect(source).toMatch(/const credentialKey=\(apiKey:unknown\)=>String\(apiKey\?\?''\)/);
  });

  it('configures that gateway on every way into the worker',()=>{
    // Registered in fetch and in queue. Miss either and a batch submitted from
    // that path would fall through to the direct API with no key.
    const entry=readFileSync('worker/structureEntry.ts','utf8');
    expect(entry.match(/configureBatchGateway\(env\)/g)??[]).toHaveLength(2);
  });

  it('refuses the direct batch calls instead of sending an empty credential',async()=>{
    // These two are the developer-API fallback, reached only when the gateway is
    // not configured. With no key they used to send x-goog-api-key: undefined and
    // come back as a bare 401; now they say which setting is missing.
    const status=await fetchGeminiBatch(undefined,'batches/abc');
    expect(status).toMatchObject({ok:false,status:503});
    expect(status.error).toMatch(/GEMINI_API_KEY/);
    const cancelled=await cancelGeminiBatch(undefined,'batches/abc');
    expect(cancelled).toMatchObject({ok:false,status:503});
    expect(cancelled.error).toMatch(/GEMINI_API_KEY/);
  });

  it('sends the vintage lookup through the transport like everything else',()=>{
    const handler=readFileSync('worker/vintageWindowHandler.ts','utf8')
      .replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
    expect(handler).toMatch(/postGeminiGenerateContent\(/);
    expect(handler).not.toMatch(/GEMINI_API_KEY/);
  });
});
