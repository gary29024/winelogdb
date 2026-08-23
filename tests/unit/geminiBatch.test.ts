import { describe,expect,it } from 'vitest';
import { bypassPrimaryGeminiBatchOnce,clearPrimaryGeminiBatchBypass,createGeminiBatch,extractBatchResponses,inlineResponseText,isEmulatedGeminiBatchName,isTerminalBatchState,normalizeBatchState,normalizeVertexGenerateContentRequest,responsesByKey } from '../../src/lib/research/geminiBatch';

describe('Gemini Batch helpers',()=>{
  it('normalizes Gemini batch state names',()=>{
    expect(normalizeBatchState({state:'BATCH_STATE_SUCCEEDED'})).toBe('JOB_STATE_SUCCEEDED');
    expect(normalizeBatchState({metadata:{state:'JOB_STATE_RUNNING'}})).toBe('JOB_STATE_RUNNING');
    expect(isTerminalBatchState('JOB_STATE_SUCCEEDED')).toBe(true);
    expect(isTerminalBatchState('JOB_STATE_RUNNING')).toBe(false);
  });

  it('extracts keyed inline responses from the batch destination',()=>{
    const payload={dest:{inlinedResponses:[
      {metadata:{key:'profile'},response:{candidates:[{content:{parts:[{text:'{"profile":"ok"}'}]}}]}},
      {metadata:{key:'catalog'},error:{message:'failed'}}
    ]}};
    const responses=extractBatchResponses(payload),byKey=responsesByKey(responses);
    expect(responses).toHaveLength(2);
    expect(inlineResponseText(byKey.get('profile')!)).toBe('{"profile":"ok"}');
    expect(byKey.get('catalog')?.error?.message).toBe('failed');
  });

  it('also accepts operation response inline results',()=>{
    const payload={response:{dest:{inlinedResponses:[{metadata:{key:'wine-research'},response:{candidates:[{content:{parts:[{text:'{}'}]}}]}}]}}};
    expect(extractBatchResponses(payload)[0]?.metadata?.key).toBe('wine-research');
  });

  it('normalizes Developer API Google Search tool names for Vertex generateContent',()=>{
    const request={contents:[{role:'user',parts:[{text:'research'}]}],tools:[{google_search:{}}],generationConfig:{responseMimeType:'application/json'}};
    const normalized=normalizeVertexGenerateContentRequest(request),tool=(normalized.tools as Array<Record<string,unknown>>)[0];
    expect(tool.googleSearch).toEqual({});
    expect(tool.google_search).toBeUndefined();
    expect(request.tools[0].google_search).toEqual({});
  });

  it('recognizes only well-formed queued Vertex batch names',()=>{
    expect(isEmulatedGeminiBatchName('vertex-batches/123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    expect(isEmulatedGeminiBatchName('batches/abc')).toBe(false);
    expect(isEmulatedGeminiBatchName('vertex-batches/')).toBe(false);
    expect(isEmulatedGeminiBatchName('vertex-batches/a/b')).toBe(false);
  });

  it('can bypass one primary Batch create without making a network call',async()=>{
    const requestId='123e4567-e89b-12d3-a456-426614174000';
    bypassPrimaryGeminiBatchOnce(requestId);
    await expect(createGeminiBatch('unused','gemini-3.7-flash',`winelog-producer-${requestId}-1`,[{key:'profile',request:{}}])).rejects.toThrow('temporarily in cooldown');
    clearPrimaryGeminiBatchBypass(requestId);
  });
});
