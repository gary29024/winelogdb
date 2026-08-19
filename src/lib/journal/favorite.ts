import { z } from 'zod';

export const favoriteUpdateSchema=z.object({favorite:z.boolean()}).strict();
export const favoriteOnlyQuery=(value:string|undefined)=>value==='1';
