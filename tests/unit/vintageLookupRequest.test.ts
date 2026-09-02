import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';

const handler=readFileSync('worker/vintageWindowHandler.ts','utf8');

describe('the request that asks about a vintage',()=>{
  /**
   * The bug this pins: the handler declared the search tool and set
   * responseMimeType with a responseSchema. The API will not do both, and what
   * comes back is well-formed JSON with the grounding silently dropped - so the
   * handler rejected its own answer for having no sources, every single time.
   * geminiBatch documents the same trap; this is a second copy of it.
   */
  it('never asks for controlled generation and grounding at once',()=>{
    // Comments stripped first: the file explains in words why it does not do
    // this, and that sentence must not read as the thing it rules out.
    const code=handler.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
    expect(code).toContain('google_search');
    expect(code).not.toMatch(/responseMimeType/);
    expect(code).not.toMatch(/generationConfig:\{/);
  });

  it('states the shape in the prompt instead, from the one schema',()=>{
    expect(handler).toMatch(/describeResponseSchema\(responseSchema\)/);
    expect(handler).toMatch(/groundedGenerationConfig\(/);
  });

  it('asks for a note about the cell the answer is filed in',()=>{
    // A village Gevrey and a premier cru beside it share a Burgundy 2011, so a
    // note naming one vineyard would be wrong on the other - which is what came
    // back: "This weather profile endowed 2011 Chambertin-Clos de Bèze with..."
    // shown on a Charmes-Chambertin. A named grand cru is its own cell, and
    // there the vineyard is exactly what the note should be about.
    expect(handler).toMatch(/The note is kept for every \$\{style\} of \$\{subject\.vintage\} from \$\{cell\.label\}/);
    expect(handler).toMatch(/do not name a producer, an estate or a single vineyard in it/);
    expect(handler).toMatch(/write it about that vineyard in that year/);
    // and the place it names is the cell's, not the region column, which a
    // bottle edited across France can still be carrying
    expect(handler).toMatch(/const cell=vintageCell\(subject\)/);
  });

  it('carries the house and the bottling to the prompt, not to the cell',()=>{
    // The route dropped them, so a Dom Perignon was told wines like it are
    // worth drinking for three to fifteen years - what Champagne says when
    // nobody mentions the cuvee - and the answer was anchored to that.
    const route=readFileSync('worker/cuveeEntry.ts','utf8');
    expect(route).toMatch(/producer:typeof source\.producer==='string'/);
    expect(route).toMatch(/wineName:typeof source\.wineName==='string'/);
  });

  it('says why a reply was refused, without payload logging being on',()=>{
    // Two requests for one lookup means the cheap model was refused, and AI
    // Gateway stores no bodies unless payload logging is turned on - which to
    // catch an intermittent failure would mean keeping every research prompt
    // and answer outside D1 in the meantime. The Worker log carries the shape
    // of the reply and the first of its text instead, only when it failed.
    expect(handler).toMatch(/finishReason:candidate\?\.finishReason/);
    expect(handler).toMatch(/metadataChunks:/);
    expect(handler).toMatch(/redirects:/);
    expect(handler).toMatch(/reply:text\.slice\(0,300\)/);
    expect(handler).toMatch(/\.\.\.attempt\.detail/);
    // and which model answered in the end, so the escalation rate is countable
    expect(handler).toMatch(/event:'vintage-window-answered'/);
  });

  it('still refuses an answer nothing was retrieved for',()=>{
    // The guard was right; it was the request that was wrong. An ungrounded
    // answer is a memory dressed as research, and this feature exists to tell
    // those apart. vintageLookupReply covers the behaviour against a real reply;
    // this only holds the refusal in place.
    expect(handler).toMatch(/!wasGrounded\(payload,sources\)/);
    expect(handler).toMatch(/Nothing was retrieved for this vintage/);
  });
});

describe('how the request reaches Gemini',()=>{
  /**
   * Reported as: nothing passed through the Cloudflare AI Gateway. It could
   * not - this handler posted to generativelanguage.googleapis.com by hand,
   * which is the one path that never reaches the gateway, and on a deployment
   * configured for Vertex through it there was no working credential either.
   */
  it('goes through the shared transport rather than its own fetch',()=>{
    const code=handler.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
    expect(code).toMatch(/postGeminiGenerateContent\(/);
    expect(code).not.toMatch(/generativelanguage\.googleapis\.com/);
  });

  it('asks the cheap model, and keeps the strong one for when it is needed',()=>{
    // The work is retrieval, not reasoning, and flash-lite retrieves. What
    // argued against it was whether it would search at all - an ungrounded
    // answer is thrown away - and that is answered by asking the stronger model
    // on the calls where it did not, rather than by paying for it every time.
    // vintageModelEscalation covers the behaviour; this holds the pair in place.
    expect(handler).toMatch(/const MODEL='gemini-3\.1-flash-lite'/);
    expect(handler).toMatch(/const ESCALATION_MODEL='gemini-3\.7-flash'/);
  });

  it('bounds the pair, and gives the thinking model the longer half',()=>{
    // A person is waiting on a button, so the two attempts share a budget
    // rather than each taking the old one. Flash-lite does not think before it
    // writes and needs less of it than the model it escalates to.
    const code=handler.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
    const primary=Number(code.match(/const TIMEOUT_MS=([\d_]+)/)![1].replace(/_/g,''));
    const escalation=Number(code.match(/const ESCALATION_TIMEOUT_MS=([\d_]+)/)![1].replace(/_/g,''));
    expect(primary).toBeLessThan(escalation);
    expect(primary+escalation).toBeLessThanOrEqual(90_000);
  });

  it('surfaces what the provider said when it refuses',()=>{
    // "Vintage lookup failed (400)" on its own sent me looking in the wrong
    // place for an afternoon.
    expect(handler).toMatch(/Vintage lookup failed \(\$\{response\.status\}\)/);
    expect(handler).toMatch(/response\.text\(\)/);
  });
});
