import { describe,expect,it } from 'vitest';
import { lwinUpsertSql,parseLwinReference,validateLwinHeaders,LWIN_HEADERS } from '../../src/lib/wine/lwinImport';
\nfunction sample(over:Record<string,unknown>={}){
 const base:Record<string,unknown>={LWIN:'1000131.0',STATUS:'Combined',DISPLAY_NAME:'Trimbach, Clos St Hune Grand Cru',PRODUCER_TITLE:'Domaine',PRODUCER_NAME:'Trimbach',WINE:'Clos St Hune Grand Cru',COUNTRY:'France',REGION:'Alsace',SUB_REGION:'NA',SITE:'NA',PARCEL:'NA',COLOUR:'White',TYPE:'Wine',SUB_TYPE:'Still',DESIGNATION:'AOP',CLASSIFICATION:'NA',VINTAGE_CONFIG:'sequential',FIRST_VINTAGE:'1980.0',FINAL_VINTAGE:'NA',DATE_ADDED:'2020-01-01',DATE_UPDATED:'2026-09-16 17:02:13',REFERENCE:'1316384.0'};
 return {...base,...over};
}

describe('LWIN reference import',()=>{
 it('normalizes numeric Excel identifiers and preserves combined redirects',()=>{
  const parsed=parseLwinReference(sample(),'2026-09-18T00:00:00.000Z');
  expect(parsed).toMatchObject({productKey:'lwin:1000131',lwin7:'1000131',status:'Combined',referenceLwin7:'1316384',producerKey:'trimbach',wineKey:'clos st hune grand cru',subRegion:null,firstVintage:1980,finalVintage:null});
 });
 it('rejects a combined row without a destination',()=>expect(()=>parseLwinReference(sample({REFERENCE:'NA'}))).toThrow(/no valid REFERENCE/));
 it('pins the official export header contract',()=>{
  expect(()=>validateLwinHeaders([...LWIN_HEADERS].filter(x=>x!=='REFERENCE'))).toThrow(/REFERENCE/);
 });
 it('emits idempotent product upserts',()=>{
  const sql=lwinUpsertSql([parseLwinReference(sample())]);
  expect(sql).toContain('ON CONFLICT(product_key) DO UPDATE');
  expect(sql).toContain("'lwin:1000131'");
 });
});
