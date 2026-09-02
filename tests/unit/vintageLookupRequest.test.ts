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

  it('still refuses an answer nothing was retrieved for',()=>{
    // The guard was right; it was the request that was wrong. An ungrounded
    // answer is a memory dressed as research, and this feature exists to tell
    // those apart.
    expect(handler).toMatch(/if\(!parsed\.sources\.length\)throw/);
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

  it('asks the model the grounded paths ask',()=>{
    // Whether it searches at all is the only thing that matters here: an
    // ungrounded answer is thrown away, so a model that grounds unreliably
    // spends the call and returns nothing.
    expect(handler).toMatch(/const MODEL='gemini-3\.7-flash'/);
  });

  it('surfaces what the provider said when it refuses',()=>{
    // "Vintage lookup failed (400)" on its own sent me looking in the wrong
    // place for an afternoon.
    expect(handler).toMatch(/Vintage lookup failed \(\$\{response\.status\}\)/);
    expect(handler).toMatch(/response\.text\(\)/);
  });
});
