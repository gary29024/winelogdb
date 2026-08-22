import type { GroupBoundingBox } from '../recognition/groupSchema';
import type { PhotoMetadata } from './photoMetadata';
import type { WinePhoto } from '../wines/api';

function loadImage(file:File){
  const url=URL.createObjectURL(file);
  return new Promise<{image:HTMLImageElement;url:string}>((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve({image,url});
    image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error(`${file.name}: could not read image`))};
    image.src=url;
  });
}

export function groupCropRegion(width:number,height:number,box:GroupBoundingBox){
  const marginX=Math.max(12,(box.xMax-box.xMin)*.08),marginY=Math.max(12,(box.yMax-box.yMin)*.08);
  const xMin=Math.max(0,box.xMin-marginX),yMin=Math.max(0,box.yMin-marginY),xMax=Math.min(1000,box.xMax+marginX),yMax=Math.min(1000,box.yMax+marginY);
  let sx=Math.max(0,Math.floor((xMin/1000)*width)),sy=Math.max(0,Math.floor((yMin/1000)*height));
  let sourceWidth=Math.max(1,Math.ceil(((xMax-xMin)/1000)*width)),sourceHeight=Math.max(1,Math.ceil(((yMax-yMin)/1000)*height));
  sourceWidth=Math.min(sourceWidth,width-sx);sourceHeight=Math.min(sourceHeight,height-sy);
  // Producer/Journal thumbnails are close to square. Expand the shorter axis around the
  // detected bottle when the source image has room, so cover thumbnails stay centred on
  // the bottle instead of clipping down to the neck or capsule.
  const side=Math.max(sourceWidth,sourceHeight);
  if(side<=width&&side<=height){
    const centerX=sx+sourceWidth/2,centerY=sy+sourceHeight/2;
    sx=Math.max(0,Math.min(width-side,Math.round(centerX-side/2)));
    sy=Math.max(0,Math.min(height-side,Math.round(centerY-side/2)));
    sourceWidth=side;sourceHeight=side;
  }
  return {sx,sy,sourceWidth,sourceHeight};
}

export async function cropGroupPhoto(file:File,box:GroupBoundingBox,metadata?:PhotoMetadata,maxEdge=1600):Promise<WinePhoto>{
  const {image,url}=await loadImage(file);
  try{
    const width=image.naturalWidth,height=image.naturalHeight;
    if(!width||!height)throw new Error(`${file.name}: invalid image dimensions`);
    const {sx,sy,sourceWidth,sourceHeight}=groupCropRegion(width,height,box);
    const scale=Math.min(1,maxEdge/Math.max(sourceWidth,sourceHeight));
    const targetWidth=Math.max(1,Math.round(sourceWidth*scale)),targetHeight=Math.max(1,Math.round(sourceHeight*scale));
    const canvas=document.createElement('canvas');canvas.width=targetWidth;canvas.height=targetHeight;
    const context=canvas.getContext('2d');if(!context)throw new Error('Image cropping is not available in this browser');
    context.drawImage(image,sx,sy,Math.min(sourceWidth,width-sx),Math.min(sourceHeight,height-sy),0,0,targetWidth,targetHeight);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error(`${file.name}: crop failed`)),'image/jpeg',.88));
    const base=file.name.replace(/\.[^.]+$/,'')||'group-photo';
    return {file:new File([blob],`${base}-wine.jpg`,{type:'image/jpeg',lastModified:file.lastModified}),metadata,width:targetWidth,height:targetHeight};
  }finally{URL.revokeObjectURL(url)}
}
