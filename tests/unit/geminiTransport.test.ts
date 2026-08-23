import { describe,expect,it } from 'vitest';
import { resolveGeminiTransport,vertexGenerateContentUrl } from '../../worker/geminiTransport';

const vertexEnv={
  GEMINI_API_KEY:'legacy-key',
  CF_AI_GATEWAY_TOKEN:'cf-token',
  AI_GATEWAY_ACCOUNT_ID:'account-123',
  AI_GATEWAY_ID:'winelog',
  VERTEX_PROJECT_ID:'project-456',
  VERTEX_REGION:'global'
};

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
});
