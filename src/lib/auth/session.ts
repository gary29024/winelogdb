import { jwtVerify, SignJWT } from 'jose';
export type Session = { userId: string };
const key = (secret:string) => new TextEncoder().encode(secret);
export async function createSession(userId:string, secret:string) { return new SignJWT({}).setProtectedHeader({alg:'HS256'}).setSubject(userId).setIssuedAt().setExpirationTime('7d').sign(key(secret)); }
export async function requireSession(header:string|undefined, secret:string): Promise<Session> { const token=header?.startsWith('Bearer ')?header.slice(7):undefined; if(!token) throw new Error('Unauthorized'); const {payload}=await jwtVerify(token,key(secret)); if(!payload.sub) throw new Error('Unauthorized'); return {userId:payload.sub}; }
