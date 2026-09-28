// Download only the pinned public inputs. No arbitrary ZIP paths are extracted.
/* global fetch */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {Buffer} from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import {URL} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';

const root=new URL('../',import.meta.url);
const named=JSON.parse(await readFile(new URL('scripts/echezeaux-named-plots.json',root),'utf8'));
const parcels=JSON.parse(await readFile(new URL('scripts/echezeaux-parcels.json',root),'utf8'));
const output=resolve(process.argv[2]??'.tmp/echezeaux-sources');
await mkdir(output,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function cached(name,sha){
 try{return hash(await readFile(resolve(output,name)))===sha}catch(error){if(error.code==='ENOENT')return false;throw error}
}
async function save(name,bytes,sha){
 if(hash(bytes)!==sha)throw new Error(`Changed source; review before updating hash: ${name}`);
 await writeFile(resolve(output,name),bytes);
 console.log(`${name}: ${bytes.length} bytes, SHA-256 verified`);
}
async function download(name,url,sha){
 if(await cached(name,sha))return;
 const response=await fetch(url);
 if(!response.ok)throw new Error(`Source HTTP ${response.status}: ${name}`);
 await save(name,Buffer.from(await response.arrayBuffer()),sha);
}
await download('lieux-dits-21267.json.gz',named.cadastreUrl,named.cadastreSha256);
await download('parcelles-21267.json.gz',parcels.cadastreUrl,parcels.cadastreSha256);
await download('dgfip-2025-description.odt',parcels.schemaUrl,parcels.schemaSha256);
if(!await cached(parcels.rightsMember,parcels.rightsMemberSha256)){
 async function bytes(range){
  const response=await fetch(parcels.rightsUrl,{headers:{Range:range,'Accept-Encoding':'identity'}});
  if(response.status!==206)throw new Error(`Range request not honoured: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
 }
 const tail=await bytes('bytes=-65557');
 let end=tail.length-22;
 while(end>=0&&tail.readUInt32LE(end)!==0x06054b50)end--;
 if(end<0)throw new Error('ZIP end record missing');
 const cdSize=tail.readUInt32LE(end+12),cdOffset=tail.readUInt32LE(end+16);
 const central=await bytes(`bytes=${cdOffset}-${cdOffset+cdSize-1}`);
 const entries=[];
 for(let p=0;p<central.length;){
  if(central.readUInt32LE(p)!==0x02014b50)throw new Error('Invalid central directory');
  const nameLength=central.readUInt16LE(p+28),extraLength=central.readUInt16LE(p+30),commentLength=central.readUInt16LE(p+32);
  entries.push({name:central.subarray(p+46,p+46+nameLength).toString(),method:central.readUInt16LE(p+10),compressed:central.readUInt32LE(p+20),size:central.readUInt32LE(p+24),offset:central.readUInt32LE(p+42),crc32:central.readUInt32LE(p+16)});
  p+=46+nameLength+extraLength+commentLength;
 }
 const matching=entries.filter(e=>e.name.split('/').at(-1)===parcels.rightsMember);
 if(matching.length!==1)throw new Error('Missing or ambiguous rights member');
 const entry=matching[0];
 if(entry.method!==8||entry.crc32!==parcels.rightsMemberCrc32)throw new Error('Changed ZIP member');
 const header=await bytes(`bytes=${entry.offset}-${entry.offset+29}`);
 if(header.readUInt32LE(0)!==0x04034b50)throw new Error('Invalid local header');
 const start=entry.offset+30+header.readUInt16LE(26)+header.readUInt16LE(28);
 const file=inflateRawSync(await bytes(`bytes=${start}-${start+entry.compressed-1}`),{maxOutputLength:entry.size});
 if(file.length!==entry.size)throw new Error('Member size mismatch');
 await save(parcels.rightsMember,file,parcels.rightsMemberSha256);
}
