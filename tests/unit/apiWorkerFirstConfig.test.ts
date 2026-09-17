import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';

function stripJsonc(source:string){
  return source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
}

describe('Worker-first API routing',()=>{
  it('keeps /api/* ahead of SPA static asset fallback',()=>{
    const config=JSON.parse(stripJsonc(readFileSync('wrangler.jsonc','utf8'))) as {assets?:{run_worker_first?:string[]}};
    expect(config.assets?.run_worker_first).toContain('/api/*');
  });
});
