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
