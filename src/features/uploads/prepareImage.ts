export type PreparedImage={file:File;width:number;height:number};

export async function prepareRecognitionImage(file:File,maxEdge=1800,quality=0.84):Promise<PreparedImage>{
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise<HTMLImageElement>((resolve,reject)=>{
      const el=new Image();
      el.onload=()=>resolve(el);
      el.onerror=()=>reject(new Error(`${file.name}: could not read image`));
      el.src=url;
    });
    const width=img.naturalWidth,height=img.naturalHeight;
    if(!width||!height)throw new Error(`${file.name}: invalid image dimensions`);
    const scale=Math.min(1,maxEdge/Math.max(width,height));
    const targetWidth=Math.max(1,Math.round(width*scale)),targetHeight=Math.max(1,Math.round(height*scale));
    const canvas=document.createElement('canvas');canvas.width=targetWidth;canvas.height=targetHeight;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image resizing is not available in this browser');
    ctx.drawImage(img,0,0,targetWidth,targetHeight);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(x=>x?resolve(x):reject(new Error(`${file.name}: image resize failed`)),'image/jpeg',quality));
    const recognitionFile=new File([blob],file.name.replace(/\.[^.]+$/,'.jpg'),{type:'image/jpeg',lastModified:file.lastModified});
    return {file:recognitionFile,width,height};
  }finally{URL.revokeObjectURL(url)}
}
