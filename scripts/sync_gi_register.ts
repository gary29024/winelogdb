/**
 * Refresh the authoritative list of EU geographical indications from eAmbrosia,
 * the Commission's Union register, so the place tree's IGT and IGP zone names
 * are verified against the legal register rather than transcribed by hand.
 *
 * The register gives names, countries and GI type; it does not say which
 * administrative region a zone sits in, and the tree needs that to place a
 * node. So this script owns the names and the tree owns the placement, and
 * tests/unit/giRegisterDrift.test.ts fails when the two disagree - a zone the
 * register carries that the tree lacks, or a tree zone the register has never
 * heard of.
 *
 * Usage: npm run gi:sync
 *
 * Requires outbound access to webgate.ec.europa.eu. Where egress policy denies
 * that host the script exits non-zero and leaves the existing file untouched,
 * rather than writing a partial list that would read as authoritative.
 */
import { writeFileSync } from 'node:fs';

const ENDPOINT='https://webgate.ec.europa.eu/eambrosia-api/api/v1/geographical-indications';
const OUT='src/lib/places/giRegister.json';
const PAGE_SIZE=500;
/** A sync that returns fewer Italian wine PGIs than this has not really run. */
const MIN_ITALIAN_PGI=100;

type RegisterEntry={name:string;country:string;denomination:string};
type ApiRecord=Record<string,unknown>;

const text=(record:ApiRecord,...keys:string[])=>{
  for(const key of keys){const value=record[key];if(typeof value==='string'&&value.trim())return value.trim()}
  return '';
};

/**
 * The register spells the GI type several ways across product sectors - PGI,
 * IGP, "Protected Geographical Indication". Italian wine PGIs are labelled IGT
 * domestically and French ones IGP, which is what a label actually says, so the
 * country decides the term the tree stores.
 */
function denominationFor(country:string,giType:string){
  if(!/^(?:pgi|igp|igt|protected geographical indication)$/i.test(giType.trim()))return null;
  return country==='IT'?'IGT':'IGP';
}

async function fetchPage(offset:number):Promise<ApiRecord[]>{
  const url=`${ENDPOINT}?limit=${PAGE_SIZE}&offset=${offset}`;
  const response=await fetch(url,{headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error(`eAmbrosia returned ${response.status} for ${url}`);
  const body=await response.json() as unknown;
  const records=Array.isArray(body)?body:(body as {content?:unknown;items?:unknown;results?:unknown});
  for(const value of [records,(records as {content?:unknown}).content,(records as {items?:unknown}).items,(records as {results?:unknown}).results]){
    if(Array.isArray(value))return value as ApiRecord[];
  }
  throw new Error('eAmbrosia response did not contain a recognisable list of records');
}

async function main(){
  const wanted=new Set(['IT','FR']);
  const seen=new Map<string,RegisterEntry>();
  let offset=0,pages=0;
  for(;;){
    const page=await fetchPage(offset);
    if(!page.length)break;
    for(const record of page){
      const sector=text(record,'productCategory','category','sector','productClass');
      if(sector&&!/wine/i.test(sector))continue;
      const country=text(record,'country','countryCode','memberState').toUpperCase().slice(0,2);
      if(!wanted.has(country))continue;
      const denomination=denominationFor(country,text(record,'giType','type','registrationType','qualityScheme'));
      if(!denomination)continue;
      const name=text(record,'denominationName','name','title','giName');
      if(!name)continue;
      seen.set(`${country}:${name}`,{name,country,denomination});
    }
    offset+=page.length;pages+=1;
    if(page.length<PAGE_SIZE)break;
    if(pages>200)throw new Error('eAmbrosia pagination did not terminate');
  }

  const entries=[...seen.values()].sort((a,b)=>a.country.localeCompare(b.country)||a.name.localeCompare(b.name));
  const italian=entries.filter(entry=>entry.country==='IT').length;
  if(italian<MIN_ITALIAN_PGI)throw new Error(`Only ${italian} Italian wine PGIs came back; refusing to overwrite ${OUT} with a partial list`);

  writeFileSync(OUT,`${JSON.stringify({
    source:'eambrosia',
    endpoint:ENDPOINT,
    fetchedAt:new Date().toISOString(),
    counts:{IT:italian,FR:entries.length-italian},
    entries
  },null,2)}\n`);
  console.log(`Wrote ${entries.length} wine geographical indications to ${OUT} (${italian} IT, ${entries.length-italian} FR).`);
}

main().catch(error=>{
  console.error(`Geographical-indication sync failed: ${(error as Error).message}`);
  console.error(`${OUT} was left unchanged.`);
  process.exit(1);
});
