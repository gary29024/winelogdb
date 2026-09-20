import { describe,expect,it } from 'vitest';
import { isValidElid,normalizeLwinId,normalizeReferenceText,normalizedVintageKind,referenceIdentityStatements,referenceWineKey,vintageReferenceCode } from '../../src/lib/wine/referenceIdentity';
import { migratedSqliteD1 } from './support/sqliteD1';

describe('external wine identity helpers',()=>{
 it('normalizes LWIN values read as Excel numbers',()=>{
  expect(normalizeLwinId('1000131.0')).toBe('1000131');
  expect(normalizeLwinId('NA')).toBeNull();
  expect(normalizeLwinId('123')).toBeNull();
 });
 it('normalizes names without destroying non-Latin identity',()=>{
  expect(normalizeReferenceText('Domaine d’Auvenay')).toBe('domaine dauvenay');
  expect(normalizeReferenceText('勝沼醸造')).toBe('勝沼醸造');
 });
 it('uses an edition in the LWIN wine key without duplicating it',()=>{
  expect(referenceWineKey('Grande Cuvée','171ème Édition')).toBe('grande cuvee 171eme edition');
  expect(referenceWineKey('Grande Cuvée 171ème Édition','171ème Édition')).toBe('grande cuvee 171eme edition');
 });
 it('validates ELID syntax but does not generate an identifier',()=>{
  expect(isValidElid('FR-CMP-KRUG01-N171')).toBe(true);
  expect(isValidElid('FR-BGN-DUJA01-2019')).toBe(true);
  expect(isValidElid('FR-BGN-made-up-2019')).toBe(false);
 });
 it('skips the identity D1 write when reference lookup did not complete',()=>{
  const db={prepare:(sql:string)=>({bind:(...args:unknown[])=>({sql,args})})} as unknown as D1Database;
  const statements=referenceIdentityStatements(db,'owner','wine',{producer:'Krug',wineName:'Grande Cuvée',vintage:null},'2026-09-18T00:00:00.000Z',false);
  expect(statements).toHaveLength(1);
 });
 it('keeps future manual LWIN-only or ELID-only identities instead of discarding them',()=>{
  const db={prepare:(sql:string)=>({bind:(...args:unknown[])=>({sql,args})})} as unknown as D1Database;
  const lwin=referenceIdentityStatements(db,'owner','wine',{producer:'Krug',wineName:'Grande Cuvée',vintage:null,identityMatchStatus:'manual',lwin7:'1234567',referenceProductKey:'lwin:1234567'},'2026-09-18T00:00:00.000Z',false) as unknown as Array<{args:unknown[]}>;
  expect(lwin).toHaveLength(2);expect(lwin[1].args).toContain('1234567');
  const elid=referenceIdentityStatements(db,'owner','wine',{producer:'Krug',wineName:'Grande Cuvée',vintage:null,identityMatchStatus:'manual',elid:'FR-CMP-KRUG01-N171'},'2026-09-18T00:00:00.000Z',false) as unknown as Array<{args:unknown[]}>;
  expect(elid).toHaveLength(2);expect(elid[1].args).toContain('FR-CMP-KRUG01-N171');
 });
 it('keeps a stored automatic identity when an edit no longer resolves safely',async()=>{
  const state=migratedSqliteD1();
  try{
   state.sqlite.exec("INSERT INTO wines(id,owner_id,producer,wine_name,lwin7,elid,colour,product_type,identity_match_status,created_at,updated_at) VALUES('w','owner','Margaux','Chateau Margaux','1000001','FR-BDX-MARG01-2019','Red','Wine','matched','now','now')");
   await state.db.batch(referenceIdentityStatements(state.db,'owner','w',{producer:'Margaux',wineName:'Chateau Margaux',identityMatchStatus:'unmatched'},'2026-09-19T00:00:00.000Z',true));
   let row=state.sqlite.prepare("SELECT lwin7,elid,colour,product_type,identity_match_status FROM wines WHERE id='w'").get() as Record<string,unknown>;
   expect(row).toMatchObject({lwin7:'1000001',elid:'FR-BDX-MARG01-2019',colour:'Red',product_type:'Wine',identity_match_status:'conflict'});

   await state.db.batch(referenceIdentityStatements(state.db,'owner','w',{producer:'Margaux',wineName:'Chateau Margaux',identityMatchStatus:'matched',lwin7:'1000002',referenceProductKey:'lwin:1000002'},'2026-09-19T00:01:00.000Z',true));
   row=state.sqlite.prepare("SELECT lwin7,identity_match_status,identity_match_candidates_json FROM wines WHERE id='w'").get() as Record<string,unknown>;
   expect(row).toMatchObject({lwin7:'1000001',identity_match_status:'conflict'});expect(String(row.identity_match_candidates_json)).toContain('1000002');
  }finally{state.sqlite.close()}
 });
 it('does not confuse an unknown vintage with non-vintage',()=>{
  expect(normalizedVintageKind(null,null)).toBe('unknown');
  expect(normalizedVintageKind(null,'non_vintage')).toBe('non_vintage');
  expect(normalizedVintageKind(null,'vintage')).toBe('unknown');
  expect(vintageReferenceCode(2019,'vintage')).toBe('2019');
  expect(vintageReferenceCode(null,'non_vintage')).toBe('');
 });
});
