import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { buildPlaceNames,parseAdmin1Codes,parseCountryInfo,parseGeonamesCities,shardPlaces } from '../src/lib/places/geonamesImport';
import { REFERENCE_SHARDS,type ReferenceManifest } from '../src/lib/wine/referenceCatalog';
import { DEFAULT_REFERENCE_BUCKET,flag,option,recordSyncState,uploadReferenceFiles,writeShardFiles } from './referenceR2';
import { zipEntry } from './zipEntry';

// GeoNames' places of over 500 people, with its first-level division and country names.
const BASE='https://download.geonames.org/export/dump',CITIES='cities500';
const USER_AGENT='WineLogDB-Places-Import/1.0 (+https://github.com/gary29024/winelogdb)';
const folder=option('source');

/** A file from the --source folder, else a GeoNames download cached under .tmp/geonames (--fresh downloads again). */
async function sourceFile(name:string){
  if(folder){
    const path=resolve(folder,name);
    if(!existsSync(path))throw new Error(`${path} is missing. Download ${BASE}/${name} into that folder, or omit --source to download it.`);
    return readFile(path);
  }
  const cache=join('.tmp','geonames'),path=join(cache,name);
  if(existsSync(path)&&!flag('fresh'))return readFile(path);
  console.log(`Downloading ${BASE}/${name}`);
  const response=await fetch(`${BASE}/${name}`,{headers:{'User-Agent':USER_AGENT},signal:AbortSignal.timeout(300_000)});
  if(!response.ok)throw new Error(`GeoNames returned ${response.status} for ${name}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  await mkdir(cache,{recursive:true});await writeFile(path,bytes);
  return bytes;
}
/** An already extracted cities500.txt in --source is read as is; otherwise it comes out of the zip. */
async function citiesText(){
  const extracted=folder?resolve(folder,`${CITIES}.txt`):null;
  if(extracted&&existsSync(extracted))return readFile(extracted,'utf8');
  return new TextDecoder().decode(zipEntry(await sourceFile(`${CITIES}.zip`),`${CITIES}.txt`));
}

const [cities,admin1,countryInfo]=await Promise.all([citiesText(),sourceFile('admin1CodesASCII.txt').then(String),sourceFile('countryInfo.txt').then(String)]);
const {places,updatedAt}=parseGeonamesCities(cities);
if(!places.length)throw new Error(`No places were read from ${CITIES}`);
const names=buildPlaceNames(parseCountryInfo(countryInfo),parseAdmin1Codes(admin1));
const version=createHash('sha256').update(cities).update(admin1).update(countryInfo).digest('hex').slice(0,16);
const generatedAt=new Date().toISOString(),prefix=`reference/places/versions/${version}`,shards=shardPlaces(places);
const manifest:ReferenceManifest={provider:'places',version,prefix,shardCount:REFERENCE_SHARDS,rows:places.length,source:`GeoNames ${CITIES} (CC BY 4.0)`,sourceUpdatedAt:updatedAt,generatedAt,namesKey:`${prefix}/names.json`};
const built=await writeShardFiles('places',version,shards,manifest,{'names.json':names});
console.log(`Prepared ${places.length} places in ${shards.size} R2 shards, with ${Object.keys(names.regions).length} region and ${Object.keys(names.countries).length} country names. Version ${version}.`);
if(flag('dry-run')){console.log(`Dry run only. Files: ${built.dir}`);process.exit(0)}
const bucket=option('bucket')??DEFAULT_REFERENCE_BUCKET;
uploadReferenceFiles('places',version,built.files,built.manifestPath,bucket);
recordSyncState('places',manifest,{seen:places.length,written:places.length});
console.log(`Places ${version} are now current in R2 bucket ${bucket}.`);
