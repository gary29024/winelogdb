import { uploadLimits } from './validation';
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
  const sx=Math.max(0,Math.floor((xMin/1000)*width)),sy=Math.max(0,Math.floor((yMin/1000)*height));
  let sourceWidth=Math.max(1,Math.ceil(((xMax-xMin)/1000)*width)),sourceHeight=Math.max(1,Math.ceil(((yMax-yMin)/1000)*height));
  sourceWidth=Math.min(sourceWidth,width-sx);sourceHeight=Math.min(sourceHeight,height-sy);
  // The crop keeps the bottle's own shape. It used to be squared up to suit
  // near-square thumbnails, but a bottle is roughly one part wide to five tall,
  // so squaring a 141x531 detection produced a 531x531 crop that reached far
  // enough sideways to take in the bottle standing next to it - which is the
  // one thing a group photo exists to separate. Measured on the reported photo,
  // the squared crop overlapped its neighbour by 124px; this one by 5.
  return {sx,sy,sourceWidth,sourceHeight};
}

/**
 * How big the crop is written out.
 *
 * Reported as: ten bottles in one photograph, and saving any of them came back
 * as "width: Too small: expected number to be >=300". A crop is uploaded as a
 * wine photograph and the upload floor is 300px on both edges, but a tenth of a
 * frame is narrower than that - which only became true once the boxes were
 * tight enough to be worth having.
 *
 * The framing is the one thing all that box work was for, so the pixels stretch
 * to meet the floor rather than the frame widening to borrow the neighbouring
 * bottle back into shot. A soft thumbnail of the right bottle beats a sharp one
 * with somebody else's label in it, and beats a save that will not go through.
 */
export function cropOutputSize(sourceWidth:number,sourceHeight:number,maxEdge:number){
  const fit=Math.min(1,maxEdge/Math.max(sourceWidth,sourceHeight));
  const floor=uploadLimits.minDimension/Math.min(sourceWidth,sourceHeight);
  // Never past the far end of what an upload takes, however thin the strip.
  const ceiling=uploadLimits.maxDimension/Math.max(sourceWidth,sourceHeight);
  const scale=Math.min(Math.max(fit,floor),ceiling);
  return {targetWidth:Math.max(1,Math.ceil(sourceWidth*scale)),targetHeight:Math.max(1,Math.ceil(sourceHeight*scale))};
}

export async function cropGroupPhoto(file:File,box:GroupBoundingBox,metadata?:PhotoMetadata,maxEdge=1600):Promise<WinePhoto>{
  const {image,url}=await loadImage(file);
  try{
    const width=image.naturalWidth,height=image.naturalHeight;
    if(!width||!height)throw new Error(`${file.name}: invalid image dimensions`);
    const {sx,sy,sourceWidth,sourceHeight}=groupCropRegion(width,height,box);
    const {targetWidth,targetHeight}=cropOutputSize(sourceWidth,sourceHeight,maxEdge);
    const canvas=document.createElement('canvas');canvas.width=targetWidth;canvas.height=targetHeight;
    const context=canvas.getContext('2d');if(!context)throw new Error('Image cropping is not available in this browser');
    context.drawImage(image,sx,sy,Math.min(sourceWidth,width-sx),Math.min(sourceHeight,height-sy),0,0,targetWidth,targetHeight);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error(`${file.name}: crop failed`)),'image/jpeg',.88));
    const base=file.name.replace(/\.[^.]+$/,'')||'group-photo';
    return {file:new File([blob],`${base}-wine.jpg`,{type:'image/jpeg',lastModified:file.lastModified}),metadata,width:targetWidth,height:targetHeight};
  }finally{URL.revokeObjectURL(url)}
}
