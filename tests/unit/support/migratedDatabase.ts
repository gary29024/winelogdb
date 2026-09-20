import { DatabaseSync } from 'node:sqlite';
import { copyFileSync,unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname,join } from 'node:path';
import { afterAll,inject } from 'vitest';

const open=new Map<DatabaseSync,string>();
afterAll(()=>{
  for(const [db,path] of open){
    if(db.isOpen)db.close();
    unlinkSync(path);
  }
  open.clear();
});

/** Each caller owns a fresh SQLite file, including schema, seed rows and sequences. */
export function migratedDatabase(){
  const template=inject('databaseTemplate');
  const path=join(dirname(template),`${randomUUID()}.sqlite`);
  copyFileSync(template,path);
  const db=new DatabaseSync(path);
  // Same transaction/constraint semantics as the former in-memory databases;
  // these disposable fixtures do not need disk durability or persistent journals.
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=MEMORY; PRAGMA synchronous=OFF');
  open.set(db,path);
  return db;
}
