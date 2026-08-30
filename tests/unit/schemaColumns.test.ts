import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe,expect,it } from 'vitest';

/**
 * Every column a query names has to exist.
 *
 * A D1 error thrown outside a try lands as a bare 500 whose body is not JSON,
 * so the browser shows a generic failure and the reason never reaches anyone.
 * That is how `SELECT id,location_name FROM wines` shipped: location_name is a
 * wine_images column, the stubs in the route tests answer whatever they are
 * asked, and nothing said otherwise until a real photo failed to upload.
 */
const migrations=join(process.cwd(),'src/lib/db/migrations');
const sql=readdirSync(migrations).filter(name=>name.endsWith('.sql')).sort()
  .map(name=>readFileSync(join(migrations,name),'utf8')).join('\n');

/** A table's columns: its CREATE body, plus every ALTER that added one. */
function columnsOf(table:string){
  const created=new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?${table}\\s*\\(([\\s\\S]*?)\\n\\);`,'i').exec(sql);
  const columns=new Set<string>();
  // Columns are comma-separated rather than one per line, and a REFERENCES
  // clause carries its own brackets, so the split has to respect depth.
  const body=created?.[1]??'';
  let depth=0,part='';
  const take=(text:string)=>{
    const name=/^\s*([a-z_][a-z0-9_]*)\s+(?:TEXT|INTEGER|REAL|BLOB|NUMERIC)/i.exec(text);
    if(name)columns.add(name[1]);
  };
  for(const character of body){
    if(character==='(')depth++;
    else if(character===')')depth--;
    if(character===','&&depth===0){take(part);part='';continue}
    part+=character;
  }
  take(part);
  for(const match of sql.matchAll(new RegExp(`ALTER TABLE ${table} ADD COLUMN (?:IF NOT EXISTS )?([a-z_][a-z0-9_]*)`,'gi')))
    columns.add(match[1]);
  return columns;
}

const workerSql=readdirSync(join(process.cwd(),'worker')).filter(name=>name.endsWith('.ts'))
  .flatMap(name=>{
    const source=readFileSync(join(process.cwd(),'worker',name),'utf8');
    return [...source.matchAll(/SELECT\s+([\s\S]{1,400}?)\s+FROM\s+([a-z_]+)\s/gi)].map(match=>({
      file:name,columns:match[1],table:match[2]
    }));
  });

describe('the columns a worker query names',()=>{
  const tables=['wines','wine_images','tastings','wine_experiences'];

  it('reads the schema it is checking against',()=>{
    // The guard is worthless if the parse came back empty.
    expect(columnsOf('wines').has('producer')).toBe(true);
    expect(columnsOf('wine_images').has('location_name')).toBe(true);
    expect(columnsOf('wines').has('location_name'),'the column that caused this').toBe(false);
  });

  it('all exist on the table being read',()=>{
    const offenders:string[]=[];
    for(const query of workerSql){
      if(!tables.includes(query.table))continue;
      // Unaliased, unqualified, unwrapped names only: an aliased table or a
      // function call is beyond what this reads, and a false alarm would be
      // worse than the narrower check.
      if(/[(]|\bAS\b|\*|\bwe\b|\bw\b\./i.test(query.columns))continue;
      const known=columnsOf(query.table);
      for(const raw of query.columns.split(',')){
        const name=raw.trim();
        if(!/^[a-z_][a-z0-9_]*$/.test(name))continue;
        if(!known.has(name))offenders.push(`${query.file}: ${query.table}.${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
