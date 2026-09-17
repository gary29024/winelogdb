import { describe,expect,it } from 'vitest';
import fs from 'node:fs';

function stripJsonc(input:string){
  return input.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
}

describe('Cloudflare asset routing',()=>{
  it('routes every API path through the Worker before SPA asset fallback',()=>{
    const config=JSON.parse(stripJsonc(fs.readFileSync('wrangler.jsonc','utf8'))) as {assets?:{run_worker_first?:string[]}};
    expect(config.assets?.run_worker_first).toContain('/api/*');
  });
});
