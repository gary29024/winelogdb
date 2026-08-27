import { describe,expect,it } from 'vitest';
import { createD1Stub } from './support/d1Stub';
import { normalizeProducerAlias,producerMatchKey } from '../../src/lib/producers/entities';
import { normalizeCuveeAlias } from '../../src/lib/cuvees/entities';
import { repairIdentityKeys } from '../../src/lib/producers/identityRepair';

type Producer={id:string;canonical_name:string;match_key:string;home_country?:string|null};
type Alias={normalized_alias:string;producer_id:string;display_alias:string;created_at:string};
type Wine={id:string;producer:string;producer_id:string|null;cuvee_id:string|null;country:string|null};
type Cuvee={id:string;producer_id:string;canonical_name:string;signature_key:string;appellation:string|null;wine_style:string|null};
type CuveeAlias={producer_id:string;normalized_alias:string;appellation_key:string;cuvee_id:string;display_alias:string};
type Merge={destination_producer_id:string;source_canonical_name:string;source_aliases_json:string};

/**
 * The repair reads five tables and writes back to four, and what matters is the
 * state it leaves - which producer each wine ends up on - so the double keeps
 * rows rather than statements. Only the statements this path actually issues
 * are answered; anything else falls through and is a test failure by omission.
 */
function world(seed:{producers:Producer[];aliases:Alias[];wines:Wine[];cuvees?:Cuvee[];cuveeAliases?:CuveeAlias[];merges?:Merge[]}){
  const db={producers:seed.producers.map(row=>({...row})),aliases:seed.aliases.map(row=>({...row})),
    wines:seed.wines.map(row=>({...row})),cuvees:(seed.cuvees??[]).map(row=>({...row})),
    cuveeAliases:(seed.cuveeAliases??[]).map(row=>({...row})),merges:seed.merges??[]};
  const stub=createD1Stub((raw,args)=>{
    const sql=raw.replace(/\s+/g,' ').trim();
    if(/^SELECT id,canonical_name,match_key FROM producers/.test(sql))return {all:db.producers};
    if(/^SELECT normalized_alias,producer_id,display_alias,created_at FROM producer_aliases/.test(sql))return {all:db.aliases};
    if(/FROM producer_merges/.test(sql))return {all:db.merges};
    if(/^SELECT id,producer_id,canonical_name,signature_key/.test(sql))return {all:db.cuvees};
    if(/^SELECT producer_id,normalized_alias,appellation_key/.test(sql))return {all:db.cuveeAliases};
    if(/^SELECT id,producer,producer_id,cuvee_id,country FROM wines/.test(sql))return {all:db.wines.filter(row=>row.producer.trim())};
    if(/^UPDATE producers SET match_key=\?/.test(sql)){
      const row=db.producers.find(item=>item.id===args[3]);
      if(row){
        if(db.producers.some(item=>item.id!==row.id&&item.match_key===args[0]))throw new Error('UNIQUE constraint failed');
        row.match_key=String(args[0]);
      }
      return undefined;
    }
    if(/^DELETE FROM producer_aliases WHERE owner_id=\? AND normalized_alias=\?/.test(sql))
      {db.aliases=db.aliases.filter(row=>row.normalized_alias!==args[1]);return undefined}
    if(/^INSERT INTO producer_aliases/.test(sql)){
      const [,normalized,producerId,display,created]=args as string[];
      const existing=db.aliases.find(row=>row.normalized_alias===normalized);
      if(existing){
        // Only ensureProducerEntity's upsert rewrites an existing row; the
        // rebuild inserts with DO NOTHING.
        if(/DO UPDATE/.test(sql)){existing.producer_id=producerId;existing.display_alias=display}
      }else db.aliases.push({normalized_alias:normalized,producer_id:producerId,display_alias:display,created_at:created});
      return undefined;
    }
    if(/^UPDATE cuvees SET signature_key=\?/.test(sql)){
      const row=db.cuvees.find(item=>item.id===args[3]);
      if(row){
        if(db.cuvees.some(item=>item.id!==row.id&&item.producer_id===row.producer_id&&item.signature_key===args[0]))throw new Error('UNIQUE constraint failed');
        row.signature_key=String(args[0]);
      }
      return undefined;
    }
    if(/^DELETE FROM cuvee_aliases WHERE owner_id=\? AND producer_id=\? AND normalized_alias=\?/.test(sql))
      {db.cuveeAliases=db.cuveeAliases.filter(row=>!(row.producer_id===args[1]&&row.normalized_alias===args[2]&&row.appellation_key===args[3]));return undefined}
    if(/^INSERT INTO cuvee_aliases/.test(sql)){
      const [,producerId,normalized,appKey,cuveeId,display]=args as string[];
      if(!db.cuveeAliases.some(row=>row.producer_id===producerId&&row.normalized_alias===normalized&&row.appellation_key===appKey))
        db.cuveeAliases.push({producer_id:producerId,normalized_alias:normalized,appellation_key:appKey,cuvee_id:cuveeId,display_alias:display});
      return undefined;
    }
    // ensureProducerEntity's three lookups, in the order it tries them.
    if(/FROM producer_aliases a JOIN producers p/.test(sql)){
      const alias=db.aliases.find(row=>row.normalized_alias===args[1]);
      const producer=alias&&db.producers.find(row=>row.id===alias.producer_id);
      return {first:producer?{id:producer.id,canonical_name:producer.canonical_name}:null};
    }
    if(/^SELECT id,canonical_name FROM producers WHERE owner_id=\? AND match_key=\?/.test(sql)){
      const producer=db.producers.find(row=>row.match_key===args[1]);
      return {first:producer?{id:producer.id,canonical_name:producer.canonical_name}:null};
    }
    if(/lower\(trim\(canonical_name\)\)/.test(sql)){
      const producer=db.producers.find(row=>row.canonical_name.trim().toLowerCase()===String(args[1]).trim().toLowerCase());
      return {first:producer?{id:producer.id,canonical_name:producer.canonical_name}:null};
    }
    if(/^INSERT INTO producers/.test(sql))
      {db.producers.push({id:String(args[0]),canonical_name:String(args[2]),match_key:String(args[3]),home_country:null});return undefined}
    if(/^UPDATE producers SET home_country=\?/.test(sql)){
      const producer=db.producers.find(row=>row.id===args[3]);
      if(producer&&!producer.home_country){producer.home_country=String(args[0]);return {changes:1}}
      return {changes:0};
    }
    if(/^UPDATE wines SET producer_id=\?/.test(sql))
      {const wine=db.wines.find(row=>row.id===args[2]);if(wine)wine.producer_id=String(args[0]);return undefined}
    // linkWineCuvee and cleanupOrphanCuvee look the wine and cuvée up by id and
    // bow out when they are not found; cuvée relinking has its own tests.
    if(/FROM wines WHERE owner_id=\? AND id=\?/.test(sql))return {first:null};
    if(/^SELECT id,producer_id,catalog_backed FROM cuvees/.test(sql))return {first:null};
    return undefined;
  });
  return {db,stub};
}

const producerOf=(db:ReturnType<typeof world>['db'],wineId:string)=>{
  const wine=db.wines.find(row=>row.id===wineId)!;
  return db.producers.find(row=>row.id===wine.producer_id)?.canonical_name??null;
};

describe('producers fused by the ASCII-only identity key',()=>{
  // Both names normalized to '' under the old rule, and producers.match_key is
  // unique per owner - so 赤恋葡萄酒 claimed the empty key and the wine saved
  // under 联合丹麓酒庄 was silently linked to it.
  const fused=()=>world({
    producers:[{id:'p-red',canonical_name:'赤恋葡萄酒',match_key:''}],
    aliases:[{normalized_alias:'',producer_id:'p-red',display_alias:'联合丹麓酒庄',created_at:'2026-01-01T00:00:00.000Z'}],
    wines:[
      {id:'w-1',producer:'赤恋葡萄酒',producer_id:'p-red',cuvee_id:null,country:'China'},
      {id:'w-2',producer:'联合丹麓酒庄',producer_id:'p-red',cuvee_id:null,country:'China'}
    ]
  });

  it('splits them back apart, from the name each wine carries',async()=>{
    const {db,stub}=fused();
    const report=await repairIdentityKeys(stub.db,'owner');
    expect(producerOf(db,'w-1')).toBe('赤恋葡萄酒');
    expect(producerOf(db,'w-2')).toBe('联合丹麓酒庄');
    expect(db.producers).toHaveLength(2);
    expect(report.winesRelinked).toBe(1);
    expect(report.aliasesDropped).toBe(1);
  });

  it('gives every producer a key of its own and drops the empty one',async()=>{
    const {db,stub}=fused();
    await repairIdentityKeys(stub.db,'owner');
    const keys=db.producers.map(row=>row.match_key);
    expect(keys).toContain('赤恋葡萄酒');
    expect(keys).toContain('联合丹麓酒庄');
    expect(keys).not.toContain('');
    expect(db.aliases.map(row=>row.normalized_alias).sort()).toEqual(['联合丹麓酒庄','赤恋葡萄酒']);
  });

  it('is safe to run twice',async()=>{
    const {db,stub}=fused();
    await repairIdentityKeys(stub.db,'owner');
    const second=await repairIdentityKeys(stub.db,'owner');
    expect(second).toMatchObject({producersRekeyed:0,aliasesRekeyed:0,aliasesDropped:0,winesRelinked:0});
    expect(db.producers).toHaveLength(2);
  });
});

describe('what the repair must not disturb',()=>{
  it('leaves a Latin library completely alone',async()=>{
    const {db,stub}=world({
      producers:[{id:'p1',canonical_name:'Domaine Dujac',match_key:'domaine dujac'},
        {id:'p2',canonical_name:'Château Margaux',match_key:'chateau margaux'}],
      aliases:[{normalized_alias:'domaine dujac',producer_id:'p1',display_alias:'Domaine Dujac',created_at:'x'},
        {normalized_alias:'dujac',producer_id:'p1',display_alias:'Dujac',created_at:'x'},
        {normalized_alias:'chateau margaux',producer_id:'p2',display_alias:'Château Margaux',created_at:'x'}],
      wines:[{id:'w1',producer:'Dujac',producer_id:'p1',cuvee_id:null,country:'France'},
        {id:'w2',producer:'Château Margaux',producer_id:'p2',cuvee_id:null,country:'France'}]
    });
    const report=await repairIdentityKeys(stub.db,'owner');
    expect(report).toMatchObject({producersRekeyed:0,aliasesRekeyed:0,aliasesDropped:0,winesRelinked:0,cuveesRekeyed:0});
    expect(stub.writes()).toEqual([]);
    expect(db.aliases).toHaveLength(3);
  });

  it('does not undo a deliberate merge',async()=>{
    // The merged name has no alias row of its own left to justify it once the
    // collided row is rebuilt, so the merge record is what keeps it.
    const {db,stub}=world({
      producers:[{id:'p-red',canonical_name:'赤恋葡萄酒',match_key:''}],
      aliases:[{normalized_alias:'',producer_id:'p-red',display_alias:'赤恋酒庄',created_at:'x'}],
      wines:[{id:'w-1',producer:'赤恋酒庄',producer_id:'p-red',cuvee_id:null,country:'China'}],
      merges:[{destination_producer_id:'p-red',source_canonical_name:'赤恋酒庄',source_aliases_json:'[]'}]
    });
    const report=await repairIdentityKeys(stub.db,'owner');
    expect(producerOf(db,'w-1')).toBe('赤恋葡萄酒');
    expect(db.producers).toHaveLength(1);
    expect(report.winesRelinked).toBe(0);
    expect(db.aliases.find(row=>row.normalized_alias===normalizeProducerAlias('赤恋酒庄'))?.producer_id).toBe('p-red');
  });
});

describe('cuvée keys',()=>{
  it('are recomputed so two Chinese cuvées stop sharing one signature',async()=>{
    const {db,stub}=world({
      producers:[{id:'p1',canonical_name:'赤恋葡萄酒',match_key:''}],
      aliases:[],
      wines:[],
      cuvees:[{id:'c1',producer_id:'p1',canonical_name:'团梦',signature_key:'',appellation:null,wine_style:'red'},
        {id:'c2',producer_id:'p1',canonical_name:'风土',signature_key:'::style:red',appellation:null,wine_style:'red'}],
      cuveeAliases:[{producer_id:'p1',normalized_alias:'',appellation_key:'',cuvee_id:'c1',display_alias:'团梦'}]
    });
    const report=await repairIdentityKeys(stub.db,'owner');
    const signatures=db.cuvees.map(row=>row.signature_key);
    expect(new Set(signatures).size).toBe(2);
    expect(signatures.every(key=>key.startsWith('::style:'))).toBe(false);
    expect(report.cuveesRekeyed).toBe(2);
    expect(db.cuveeAliases[0].normalized_alias).toBe(normalizeCuveeAlias('团梦'));
  });
});

describe('the key itself',()=>{
  it('keeps names in any script apart',()=>{
    expect(producerMatchKey('赤恋葡萄酒')).not.toBe(producerMatchKey('联合丹麓酒庄'));
    expect(producerMatchKey('Домен Бойар')).not.toBe(producerMatchKey('Κτήμα Άλφα'));
    expect(producerMatchKey('丹麓 H1')).not.toBe(producerMatchKey('H1'));
    expect(normalizeProducerAlias('赤恋葡萄酒')).toBe('赤恋葡萄酒');
  });

  it('still writes Latin keys exactly as before',()=>{
    expect(producerMatchKey('Domaine Test Père & Fils')).toBe('domaine test pere and fils');
    expect(producerMatchKey("Ch. d'Yquem")).toBe('ch dyquem');
    expect(producerMatchKey('Weingut Müller-Catoir')).toBe('weingut muller catoir');
    expect(normalizeCuveeAlias('1er Cru Les Amoureuses')).toBe('premier cru les amoureuses');
  });

  it('never lets two different names share an empty key',()=>{
    expect(producerMatchKey('★')).not.toBe(producerMatchKey('☆'));
  });
});
