import { afterEach,describe,expect,it,vi } from 'vitest';
import { postGeminiGenerateContent,resolveGeminiTransport,vertexGenerateContentUrl } from '../../worker/geminiTransport';

const vertexEnv={
  GEMINI_API_KEY:'legacy-key',
  CF_AI_GATEWAY_TOKEN:'cf-token',
  AI_GATEWAY_ACCOUNT_ID:'account-123',
  AI_GATEWAY_ID:'winelog',
  VERTEX_PROJECT_ID:'project-456',
  VERTEX_REGION:'global'
};

afterEach(()=>vi.unstubAllGlobals());

describe('Gemini transport',()=>{
  it('prefers Vertex AI Gateway when the complete gateway configuration is present',()=>{
    expect(resolveGeminiTransport(vertexEnv)).toBe('vertex-ai-gateway');
  });

  it('keeps the Gemini Developer API available for local development when no gateway configuration exists',()=>{
    expect(resolveGeminiTransport({GEMINI_API_KEY:'dev-key'})).toBe('gemini-developer-api');
  });

  it('fails closed when only part of the AI Gateway configuration is present',()=>{
    expect(()=>resolveGeminiTransport({GEMINI_API_KEY:'legacy-key',AI_GATEWAY_ID:'winelog'})).toThrow(/AI Gateway configuration is incomplete/);
  });

  it('builds the provider-native Vertex generateContent endpoint',()=>{
    expect(vertexGenerateContentUrl(vertexEnv,'gemini-3.1-flash-lite')).toBe(
      'https://gateway.ai.cloudflare.com/v1/account-123/winelog/google-vertex-ai/v1/projects/project-456/locations/global/publishers/google/models/gemini-3.1-flash-lite:generateContent'
    );
  });

  it('adds Flex PayGo headers only when the caller explicitly requests flex',async()=>{
    const seen:Headers[]=[];
    vi.stubGlobal('fetch',vi.fn(async(_input:RequestInfo|URL,init?:RequestInit)=>{seen.push(new Headers(init?.headers));return new Response('{}',{status:200})}));
    const signal=new AbortController().signal;
    await postGeminiGenerateContent(vertexEnv,'gemini-3.7-flash','{}',signal,{feature:'research'},{serviceTier:'flex',serverTimeoutSeconds:600});
    await postGeminiGenerateContent(vertexEnv,'gemini-3.1-flash-lite','{}',signal,{feature:'recognition'});
    expect(seen[0].get('X-Vertex-AI-LLM-Request-Type')).toBe('shared');
    expect(seen[0].get('X-Vertex-AI-LLM-Shared-Request-Type')).toBe('flex');
    expect(seen[0].get('X-Server-Timeout')).toBe('600');
    expect(seen[0].get('cf-aig-collect-log-payload')).toBe('false');
    expect(seen[1].has('X-Vertex-AI-LLM-Request-Type')).toBe(false);
    expect(seen[1].has('X-Vertex-AI-LLM-Shared-Request-Type')).toBe(false);
  });

  it('rejects Flex PayGo outside the global Vertex endpoint',async()=>{
    const env={...vertexEnv,VERTEX_REGION:'us-central1'};
    await expect(postGeminiGenerateContent(env,'gemini-3.7-flash','{}',new AbortController().signal,undefined,{serviceTier:'flex'})).rejects.toThrow(/requires VERTEX_REGION=global/);
  });
});
