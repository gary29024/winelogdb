// Lossless transport only: copy canonical LF GeoJSON bytes into Brotli without
// parsing/re-serialising or changing any coordinates, metadata or source gates.
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {brotliCompressSync,brotliDecompressSync,gzipSync,gunzipSync,constants} from 'node:zlib';
import {fileURLToPath,URL} from 'node:url';
import {Buffer} from 'node:buffer';
import process from 'node:process';

const root=fileURLToPath(new URL('../',import.meta.url));
const selected=new Set([
 'chablis','cote-de-beaune-villages','petit-chablis','pouilly-fuisse',
 'meursault','santenay','marsannay','beaune','montagny','saint-aubin',
 'savigny-les-beaune','vire-clesse','givry','chassagne-montrachet',
]);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const readText=path=>Buffer.from(readFileSync(root+path,'utf8').replaceAll('\r\n','\n'));
const json=value=>JSON.stringify(value,null,2)+'\n';
const entries={},inventory=[],outputs=[];
for(const name of readdirSync(root+'src/lib/places').filter(n=>n.endsWith('MapCatalogue.json')).sort()){
 const catalogueBytes=readText('src/lib/places/'+name),catalogue=JSON.parse(catalogueBytes);
 if(catalogue.mapKind==='regional')continue;
 const source=readText('public'+catalogue.dataUrl),gzip=gzipSync(source,{level:9});
 gzip[9]=255; // Normalise the platform metadata byte; compressed data is intact.
 const baseline=gzip.length;
 const row={id:catalogue.id,name:catalogue.name,catalogue:name,dataUrl:catalogue.dataUrl,
  sourceSha256:sha(source),catalogueSha256:sha(catalogueBytes),sourceBytes:source.length,gzipEquivalentBytes:baseline};
 if(selected.has(catalogue.id)){
  const compressed=brotliCompressSync(source,{params:{[constants.BROTLI_PARAM_QUALITY]:11,[constants.BROTLI_PARAM_MODE]:constants.BROTLI_MODE_TEXT}});
  if(!brotliDecompressSync(compressed).equals(source))throw new Error(`Lossless round trip failed: ${catalogue.id}`);
  if(compressed.length>=baseline*.85||compressed.length>600000)throw new Error(`Insufficient saving: ${catalogue.id}`);
  const base=catalogue.dataUrl.replace('/maps/','/maps/lossless/');
  const digest=sha(compressed),url=base.replace(/\.geojson$/,`.lossless-${digest.slice(0,12)}.geojson.br`);
  const gzipSha256=sha(gzip),gzipUrl=base.replace(/\.geojson$/,`.lossless-${gzipSha256.slice(0,12)}.geojson.gz`);
  if(!gunzipSync(gzip).equals(source))throw new Error(`Gzip round trip failed: ${catalogue.id}`);
  entries[catalogue.id]={brotliJsonUrl:url,gzipJsonUrl:gzipUrl};
  Object.assign(row,{brotliJsonUrl:url,compressedSha256:digest,brotliBytes:compressed.length,gzipJsonUrl:gzipUrl,gzipSha256});
  outputs.push([root+'public'+url,compressed],[root+'public'+gzipUrl,gzip]);
 }
 inventory.push(row);
}
if(Object.keys(entries).length!==selected.size)throw new Error('A selected catalogue is missing');
mkdirSync(root+'public/maps/lossless',{recursive:true});
for(const [path,bytes] of outputs)writeFileSync(path,bytes);
writeFileSync(root+'src/lib/places/burgundyLosslessMapRegistry.json',json(entries));
writeFileSync(root+'scripts/burgundy-lossless-map-report.json',json({node:process.versions.node,brotli:process.versions.brotli,gzip:process.versions.zlib,maps:inventory}));
for(const row of inventory.filter(r=>r.brotliBytes))globalThis.console.log(`${row.name}: ${row.gzipEquivalentBytes} gzip-equivalent -> ${row.brotliBytes} Brotli bytes`);
