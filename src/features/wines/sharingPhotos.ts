import { apiFetch,authHeaders } from '../../lib/auth/client';
import { prepareRecognitionImage } from '../uploads/prepareImage';
export async function prepareSharingPhotos(imageIds:string[]){
 for(const imageId of imageIds){
  const response=await apiFetch(`/api/images/${imageId}`,{headers:authHeaders()});if(!response.ok)throw new Error('Could not prepare a photo for sharing');
  const blob=await response.blob(),prepared=await prepareRecognitionImage(new File([blob],'wine.jpg',{type:blob.type}),1600,.8);
  const uploaded=await apiFetch(`/api/images/${imageId}/sharing-copy`,{method:'PUT',headers:authHeaders(),body:prepared.file});if(!uploaded.ok)throw new Error((await uploaded.json() as {error?:string}).error||'Could not save sharing photo');
 }
}
