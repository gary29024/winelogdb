export type PreparedImage={file:File;width:number;height:number};

type EncodeAttempt={maxEdge:number;quality:number};
const DEFAULT_RECOGNITION_MAX_BYTES=Math.floor(2.5*1024*1024);

async function loadImage(file:File){
  const url=URL.createObjectURL(file);
  try{
    return await new Promise<HTMLImageElement>((resolve,reject)=>{
      const el=new Image();
      el.onload=()=>resolve(el);
      el.onerror=()=>reject(new Error(`${file.name}: could not read image`));
      el.src=url;
    });
  }finally{URL.revokeObjectURL(url)}
}

async function encodeJpeg(file:File,img:HTMLImageElement,maxEdge:number,quality:number){
  const scale=Math.min(1,maxEdge/Math.max(img.naturalWidth,img.naturalHeight));
  const targetWidth=Math.max(1,Math.round(img.naturalWidth*scale)),targetHeight=Math.max(1,Math.round(img.naturalHeight*scale));
  const canvas=document.createElement('canvas');canvas.width=targetWidth;canvas.height=targetHeight;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image resizing is not available in this browser');
  ctx.drawImage(img,0,0,targetWidth,targetHeight);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(x=>x?resolve(x):reject(new Error(`${file.name}: image resize failed`)),'image/jpeg',quality));
  return new File([blob],file.name.replace(/\.[^.]+$/,'.jpg'),{type:'image/jpeg',lastModified:file.lastModified});
}

function adaptiveAttempts(maxEdge:number,quality:number):EncodeAttempt[]{
  return [
    {maxEdge,quality},
    {maxEdge:Math.max(900,Math.round(maxEdge*.92)),quality:Math.min(quality,.78)},
    {maxEdge:Math.max(850,Math.round(maxEdge*.84)),quality:Math.min(quality,.72)},
    {maxEdge:Math.max(800,Math.round(maxEdge*.74)),quality:Math.min(quality,.66)},
    {maxEdge:Math.max(750,Math.round(maxEdge*.66)),quality:Math.min(quality,.60)},
    {maxEdge:Math.max(700,Math.round(maxEdge*.58)),quality:Math.min(quality,.54)},
    {maxEdge:700,quality:.48}
  ];
}

/**
 * The pixel size of a file, without re-encoding it.
 *
 * Saving a photo sends the original and its dimensions separately, so a screen
 * that stores a picture as-is - rather than preparing a smaller copy for
 * recognition - still has to measure it.
 */
export async function imageSize(file:File):Promise<{width:number;height:number}>{
  const img=await loadImage(file);
  return {width:img.naturalWidth,height:img.naturalHeight};
}

export async function prepareRecognitionImage(file:File,maxEdge=1800,quality=0.84):Promise<PreparedImage>{
  return prepareRecognitionImageWithinBytes(file,DEFAULT_RECOGNITION_MAX_BYTES,adaptiveAttempts(maxEdge,quality));
}

export async function prepareRecognitionImageWithinBytes(file:File,maxBytes:number,attempts:EncodeAttempt[]=[
  {maxEdge:2000,quality:.84},{maxEdge:1850,quality:.78},{maxEdge:1700,quality:.72},{maxEdge:1500,quality:.66},{maxEdge:1350,quality:.60},{maxEdge:1200,quality:.55},{maxEdge:1050,quality:.50},{maxEdge:900,quality:.46}
]):Promise<PreparedImage>{
  const img=await loadImage(file),width=img.naturalWidth,height=img.naturalHeight;
  if(!width||!height)throw new Error(`${file.name}: invalid image dimensions`);
  let smallest:File|null=null;
  for(const attempt of attempts){
    const encoded=await encodeJpeg(file,img,attempt.maxEdge,attempt.quality);
    if(!smallest||encoded.size<smallest.size)smallest=encoded;
    if(encoded.size<=maxBytes)return {file:encoded,width,height};
  }
  const sizeMb=((smallest?.size??0)/1048576).toFixed(1),limitMb=(maxBytes/1048576).toFixed(1);
  throw new Error(`${file.name}: could not prepare a recognition copy below ${limitMb} MB (smallest was ${sizeMb} MB)`);
}
