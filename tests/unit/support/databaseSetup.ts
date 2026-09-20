import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync,readFileSync,readdirSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext { databaseTemplate:string }
}

// Rebuilt for every invocation (and watch rerun), never a persistent schema cache.
// Migration-specific tests still apply migrations to their own historical data.
export default function setup(project:TestProject){
  const directory=mkdtempSync(join(tmpdir(),'winelog-tests-'));
  const template=join(directory,'template.sqlite');
  const build=()=>{
    rmSync(template,{force:true});
    const db=new DatabaseSync(template);
    try{
      db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=MEMORY; PRAGMA synchronous=OFF');
      for(const file of readdirSync('src/lib/db/migrations').filter(file=>file.endsWith('.sql')).sort()){
        db.exec(readFileSync(`src/lib/db/migrations/${file}`,'utf8'));
      }
    }finally{db.close()}
  };
  try{build()}catch(error){rmSync(directory,{recursive:true,force:true});throw error}
  project.provide('databaseTemplate',template);
  project.onTestsRerun(build);
  return ()=>rmSync(directory,{recursive:true,force:true});
}
