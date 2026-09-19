import { apiJson } from '../../lib/auth/api';

export type FriendTag={id:string;display_name:string;defaultShare?:boolean};

export const listFriendTags=()=>apiJson<{items:FriendTag[]}>('/api/friends');

export const getWineFriendTags=(wineId:string)=>
  apiJson<{recipientIds:string[]}>(`/api/wines/${wineId}/shares`);

export const setWineFriendTags=(wineId:string,recipientIds:string[])=>
  apiJson<{ok:true}>(`/api/wines/${wineId}/shares`,'PUT',{recipientIds});

export const setBulkWineFriendTags=(wineIds:string[],recipientIds:string[])=>
  apiJson<{ok:true;count:number}>('/api/wines/shares','PUT',{wineIds,recipientIds,mode:'add'});

export const getTastingFriendTags=(tastingId:string)=>
  apiJson<{recipientIds:string[]}>(`/api/tastings/${tastingId}/shares`);

export const setTastingFriendTags=(tastingId:string,recipientIds:string[])=>
  apiJson<{ok:true}>(`/api/tastings/${tastingId}/shares`,'PUT',{recipientIds});

export const setDefaultFriendShare=(friendId:string,enabled:boolean)=>
  apiJson<{ok:true}>(`/api/friends/${friendId}/default-share`,'PUT',{enabled});

export const shareAllExistingWines=(friendId:string)=>
  apiJson<{ok:true;count:number}>(`/api/friends/${friendId}/share-existing-wines`,'POST',{});
