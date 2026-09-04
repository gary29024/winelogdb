import { describe,expect,it } from 'vitest';
import { countSearchQueries } from '../../src/lib/research/geminiBatch';
import { MAX_INCOMPLETE_SPLITS,catalogDefaultChunkKeys,requestForKey,researchPromptFor } from '../../src/lib/producers/batchResearch';
import { GEMINI_REQUESTS_PER_PRODUCER } from '../../src/lib/producers/researchCampaign';

const response=(queries?:string[])=>({
  metadata:{key:'k'},
  response:{candidates:[{content:{parts:[{text:'{}'}]},...(queries?{groundingMetadata:{webSearchQueries:queries}}:{})}]}
} as Parameters<typeof countSearchQueries>[0][number]);

describe('counting what grounding actually bills',()=>{
  it('counts the searches the model ran, not the requests it ran them in',()=>{
    // Gemini 3 bills per search query rather than per prompt: one request that
    // searches seven times costs seven. Measured on this app, a grounded
    // request averaged 7.4 - which is why 1,653 requests became 12,183
    // billable searches in a day.
    const searches=countSearchQueries([
      response(['william fevre range','william fevre chablis grand cru','william fevre wines list']),
      response(['domaine dujac wines'])
    ]);
    expect(searches).toBe(4);
  });

  it('counts nothing when a response never grounded',()=>{
    expect(countSearchQueries([response(),response([])])).toBe(0);
    expect(countSearchQueries([])).toBe(0);
  });
});

describe('what a producer costs before it needs splitting',()=>{
  it('is two grounded requests, not six',()=>{
    // A profile and one whole-range catalogue request. The five lettered
    // slices are now the recovery ladder rather than the opening move, so a
    // producer with a short range never pays for them.
    expect(catalogDefaultChunkKeys).toHaveLength(1);
    expect(GEMINI_REQUESTS_PER_PRODUCER).toBe(1+catalogDefaultChunkKeys.length);
    expect(GEMINI_REQUESTS_PER_PRODUCER).toBe(2);
  });
});

describe('what the prompts ask for',()=>{
  const whole=researchPromptFor('Domaine William Fevre','catalog_slice_a_z_other');
  const slice=researchPromptFor('Domaine William Fevre','catalog_slice_a_e');
  const profile=researchPromptFor('Domaine William Fevre','profile');

  it('gives every grounded request a search budget',()=>{
    // The bill is the number of searches, so the prompt has to have an opinion
    // about it. Without this line a request averaged 7.4.
    for(const [label,prompt] of [['whole',whole],['slice',slice],['profile',profile]] as const){
      expect(prompt,label).toMatch(/use at most \d+ Google searches/);
      expect(prompt,label).toContain('Do not run a separate search for each wine');
      expect(prompt,label).toContain("producer's own website");
    }
  });

  it('keeps provenance non-negotiable',()=>{
    // Cheaper must not mean guessed: the answer still has to come from a page
    // retrieved in this request.
    expect(whole).toContain('must come from a page you actually retrieved in this request');
    expect(profile).toContain('must come from a page you actually retrieved in this request');
    expect(whole).toContain('do not invent cuvees');
  });

  it('asks the whole-range request for everything, and to admit a cut-off',()=>{
    expect(whole).toContain('COVERAGE: return every current cuvee');
    expect(whole).toContain('rangeComplete');
    expect(whole).not.toContain('SLICE: return ONLY');
  });

  it('still bounds a lettered slice',()=>{
    expect(slice).toContain('SLICE: return ONLY');
    expect(slice).not.toContain('COVERAGE: return every current cuvee');
  });
});

describe('the room an answer is given, which decides whether the ladder is climbed',()=>{
  // Reported after the move to 3.8: producer research runs far longer and burns
  // far more grounded searches. Nothing in the request changed but the model
  // name. Thinking tokens are output tokens and count against this cap, so a
  // model that thinks harder inside a fixed 8192 runs out mid-range, reports
  // itself unfinished, and the whole range is re-asked in halves - each half a
  // fresh grounded request with its own search budget.
  const roomFor=(key:string)=>(requestForKey('Domaine William Fevre',key).request.generationConfig as {maxOutputTokens?:number}).maxOutputTokens;

  it('gives the whole range the most, because its overflow is what starts the ladder',()=>{
    expect(roomFor('catalog_slice_a_z_other')).toBe(32768);
    expect(roomFor('catalog_slice_a_z_other')).toBeGreaterThan(roomFor('catalog_slice_a_e')!);
  });

  it('gives every grounded request more room than the 8192 that ran out',()=>{
    for(const key of ['profile','catalog_slice_a_z_other','catalog_slice_a_e','catalog_slice_other'])
      expect(roomFor(key),`${key} needs room for its thinking as well as its answer`).toBeGreaterThan(8192);
  });

  it('keeps grounding switched on for every one of them',()=>{
    // A ceiling is not a spend - only tokens produced are billed - so the room
    // costs nothing. What it must not do is change the request otherwise.
    for(const key of ['profile','catalog_slice_a_z_other','catalog_slice_a_e'])
      expect(requestForKey('Domaine William Fevre',key).request.tools).toEqual([{google_search:{}}]);
  });
});

describe('how far an unfinished range may be re-asked',()=>{
  it('stops after three rounds rather than doubling all evening',()=>{
    // Each round doubles the grounded requests: six of them is twenty-six
    // slices and an evening's wait. Three is A-Z, halves, quarters.
    expect(MAX_INCOMPLETE_SPLITS).toBe(3);
    expect(2**MAX_INCOMPLETE_SPLITS,'the worst case stays in single figures').toBeLessThanOrEqual(8);
  });
});
