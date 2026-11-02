import { inflateRawSync } from 'node:zlib';

const END_OF_DIRECTORY=0x06054b50,DIRECTORY_ENTRY=0x02014b50,LOCAL_ENTRY=0x04034b50,ZIP64=0xffffffff;

/**
 * One file out of a ZIP archive, read with zlib alone.
 *
 * GeoNames publishes its place lists only as .zip, and the import is run from
 * Windows as well, where no unzip command can be assumed. Sizes and offsets come
 * from the central directory, so entries written with a trailing data
 * descriptor read correctly; ZIP64 archives are refused rather than misread.
 */
export function zipEntry(archive:Uint8Array,name:string):Uint8Array{
  const view=new DataView(archive.buffer,archive.byteOffset,archive.byteLength);
  // The end record is the last 22 bytes, unless a trailing comment (at most 64 KiB) follows it.
  let end=-1;
  for(let at=archive.length-22;at>=Math.max(0,archive.length-22-0xffff);at--)if(view.getUint32(at,true)===END_OF_DIRECTORY){end=at;break}
  if(end<0)throw new Error('Not a ZIP archive');
  const entries=view.getUint16(end+10,true);let offset=view.getUint32(end+16,true);
  if(offset===ZIP64)throw new Error('ZIP64 archives are not supported');
  for(let index=0;index<entries;index++){
    if(view.getUint32(offset,true)!==DIRECTORY_ENTRY)throw new Error('The ZIP central directory is corrupt');
    const method=view.getUint16(offset+10,true),compressedSize=view.getUint32(offset+20,true);
    const nameLength=view.getUint16(offset+28,true),extraLength=view.getUint16(offset+30,true),commentLength=view.getUint16(offset+32,true),local=view.getUint32(offset+42,true);
    if(new TextDecoder().decode(archive.subarray(offset+46,offset+46+nameLength))===name){
      if(compressedSize===ZIP64||local===ZIP64)throw new Error('ZIP64 archives are not supported');
      if(view.getUint32(local,true)!==LOCAL_ENTRY)throw new Error(`The ZIP entry ${name} is corrupt`);
      const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true),data=archive.subarray(start,start+compressedSize);
      if(method===0)return data;
      if(method===8)return inflateRawSync(data);
      throw new Error(`The ZIP entry ${name} uses unsupported compression method ${method}`);
    }
    offset+=46+nameLength+extraLength+commentLength;
  }
  throw new Error(`${name} is not in the ZIP archive`);
}
