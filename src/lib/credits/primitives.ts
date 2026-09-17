/**
 * The few request primitives the credit layer needs on both sides of the
 * worker/src boundary.
 *
 * `src/lib` is bundled for the browser as well as the Worker, so the research
 * modules must not reach up into `worker/`. These live here and
 * `worker/multiUser/common.ts` re-exports them, so there is still one
 * implementation of each.
 */
export class ApiError extends Error { constructor(public status:number,message:string){super(message)} }
export const stamp=()=>new Date().toISOString();
export const seconds=()=>Math.floor(Date.now()/1000);
export async function hash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('')}
export async function boundedBytes(stream:ReadableStream<Uint8Array>|null,limit:number):Promise<Uint8Array>{
 if(!stream)return new Uint8Array();const reader=stream.getReader(),chunks:Uint8Array[]=[];let length=0;
 try{for(;;){const next=await reader.read();if(next.done)break;length+=next.value.byteLength;if(length>limit){await reader.cancel();throw new ApiError(413,'Request exceeds the upload limit')}chunks.push(next.value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return bytes;
}

/**
 * Hono's default handler turns any thrown error into a bare 500.
 *
 * A refusal to spend is not an internal failure: it is the answer, and the
 * status and reason have to reach the caller rather than being flattened into
 * "Internal Server Error". Registered on every Hono app in the legacy chain,
 * because each one handles its own routes and a parent's handler does not see
 * a child's throw.
 */
export const apiErrorHandler=(error:unknown)=>{
  if(error instanceof ApiError)return Response.json({error:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}});
  throw error;
};
