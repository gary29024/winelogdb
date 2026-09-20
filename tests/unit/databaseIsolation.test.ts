import { expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import { migratedSqliteD1 } from './support/sqliteD1';

it('isolates rows and schema between simultaneous fixtures and later copies',()=>{
  const first=realD1(),second=migratedSqliteD1();
  try{
    first.sql.exec("INSERT INTO app_users(id,email,display_name,role) VALUES('fixture-user','fixture@example.com','Fixture','member'); CREATE TABLE fixture_only(id INTEGER)");
    expect(second.sqlite.prepare("SELECT id FROM app_users WHERE id='fixture-user'").get()).toBeUndefined();
    expect(()=>second.sqlite.prepare('SELECT * FROM fixture_only')).toThrow();
    const later=realD1();
    try{
      expect(later.sql.prepare("SELECT id FROM app_users WHERE id='fixture-user'").get()).toBeUndefined();
      expect(()=>later.sql.prepare('SELECT * FROM fixture_only')).toThrow();
    }finally{later.close()}
  }finally{first.close();second.sqlite.close()}
});

it.each(['counted','standard'])('preserves foreign keys and atomic rollback (%s adapter)',async adapter=>{
  const state=adapter==='counted'?realD1():migratedSqliteD1();
  const sqlite='sql' in state?state.sql:state.sqlite;
  try{
    expect(sqlite.prepare('PRAGMA foreign_keys').get()).toEqual({foreign_keys:1});
    sqlite.exec('CREATE TABLE fixture_parent(id INTEGER PRIMARY KEY); CREATE TABLE fixture_child(parent_id INTEGER REFERENCES fixture_parent(id))');
    await expect(state.db.batch([
      state.db.prepare('INSERT INTO fixture_parent VALUES(1)'),
      state.db.prepare('INSERT INTO fixture_child VALUES(2)'),
    ])).rejects.toThrow(/FOREIGN KEY/);
    expect(sqlite.prepare('SELECT * FROM fixture_parent').all()).toEqual([]);
    await state.db.batch([
      state.db.prepare('INSERT INTO fixture_parent VALUES(1)'),
      state.db.prepare('INSERT INTO fixture_child VALUES(1)'),
    ]);
    expect(sqlite.prepare('SELECT * FROM fixture_child').all()).toEqual([{parent_id:1}]);
  }finally{sqlite.close()}
});
