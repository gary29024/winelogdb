import { afterEach,describe,expect,it } from 'vitest';
import { migratedSqliteD1 } from './support/sqliteD1';
import { createCuveeCatalogLink,getProducerCuveeCatalogState } from '../../src/lib/cuvees/catalogLinks';
import { canonicalCatalogEntries,catalogChoicesForPresentation } from '../../src/lib/cuvees/catalogPresentation';
import { ensureCuveeEntity } from '../../src/lib/cuvees/entities';

const databases:Array<ReturnType<typeof migratedSqliteD1>>=[];
afterEach(()=>{for(const state of databases.splice(0))state.sqlite.close()});

// A range this account never saved: a friend's research or the imported LWIN range.
const friendRange=[
  {name:'Punta di Adine',category:'red',appellation:'Toscana IGT',classification:null},
  {name:'Volta di Bertinga',category:'red',appellation:'Toscana IGT',classification:null},
  {name:'La Porta di Vertine',category:'red',appellation:'Chianti Classico',classification:null},
  {name:'Vertine Rosso',category:'red',appellation:'Toscana IGT',classification:null}
];

async function setup(){
  const state=migratedSqliteD1();databases.push(state);
  state.sqlite.exec(`INSERT INTO producers(id,owner_id,canonical_name,match_key,catalog_json,created_at,updated_at)
    VALUES('p','reader','Vertine','vertine','[]','2026-01-01','2026-01-01')`);
  const tasted=await ensureCuveeEntity(state.db,'reader','p','Adine Punta','Toscana IGT','red',false);
  state.sqlite.prepare(`INSERT INTO wines(id,owner_id,producer,producer_id,cuvee_id,wine_name,vintage,wine_style,created_at,updated_at)
    VALUES('w1','reader','Vertine','p',?,'Adine Punta',2017,'red','2026-01-01','2026-01-01')`).run(tasted.id);
  return {...state,tasted};
}

describe('catalog links on a range shown in place of a saved one',()=>{
  it('lists every wine as needing repair when only the saved (empty) range seeds identities',async()=>{
    const {db}=await setup();
    const state=await getProducerCuveeCatalogState(db,'reader','p');
    const choices=catalogChoicesForPresentation(canonicalCatalogEntries(friendRange,['Vertine']),['Vertine'],state.catalogCuvees);
    expect(choices.filter(choice=>choice.id)).toHaveLength(0);
  });

  it('gives each wine of the displayed range an identity a tasting can be linked to',async()=>{
    const {db,tasted}=await setup();
    const state=await getProducerCuveeCatalogState(db,'reader','p',{aliases:['Vertine'],wines:[{id:'w1',cuvee_id:tasted.id,vintage:2017}],displayCatalog:friendRange});
    const choices=catalogChoicesForPresentation(canonicalCatalogEntries(friendRange,['Vertine']),['Vertine'],state.catalogCuvees);
    expect(choices).toHaveLength(4);
    expect(choices.every(choice=>choice.id)).toBe(true);
    const target=choices.find(choice=>choice.canonicalName==='Punta di Adine')!;
    await expect(createCuveeCatalogLink(db,'reader','p',tasted.id,target.id!)).resolves.toMatchObject({catalogCuveeId:target.id,existing:false});
  });
});
