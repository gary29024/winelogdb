import { readdirSync } from 'node:fs';
import { describe,expect,it } from 'vitest';

describe('D1 migration numbering',()=>{
  it('uses every numeric migration prefix only once',()=>{
    const files=readdirSync('src/lib/db/migrations').filter(file=>/^\d{4}_.*\.sql$/.test(file)).sort();
    const byPrefix=new Map<string,string[]>();
    for(const file of files){
      const prefix=file.slice(0,4);
      byPrefix.set(prefix,[...(byPrefix.get(prefix)??[]),file]);
    }
    const duplicates=[...byPrefix.entries()].filter(([,names])=>names.length>1);
    expect(duplicates).toEqual([]);
  });
});
