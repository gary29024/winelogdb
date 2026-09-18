import { normalizeReferenceText,isValidElid } from './referenceIdentity';

export const ELID_WINE_PATH=/^\/wine\/([A-Z]{2}-[A-Z]{3}-[A-Z0-9]{6})(?:-(\d{4}|XXXX|NVXX|N[A-Z0-9]{3})(?:\+[A-Z0-9]{3,4})?)?$/;
export const ELID_PRODUCER_PATH=/^\/producer\/([A-Z]{2}-[A-Z0-9]{4})$/;

const decode=(text:string)=>text.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const plain=(html:string)=>decode(html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());

export function htmlLinks(html:string){
 const out:Array<{href:string;text:string}>=[],re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;let match:RegExpExecArray|null;
 while((match=re.exec(html)))out.push({href:decode(match[1]),text:plain(match[2])});
 return out;
}
export function heading(html:string,level=1){
 const match=html.match(new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`,'i'));return match?plain(match[1]):'';
}
export function elidParts(path:string){
 const match=path.match(ELID_WINE_PATH);if(!match)return null;
 return {baseElid:match[1],vintageCode:match[2]??'',elid:match[2]?`${match[1]}-${match[2]}`:match[1]};
}
export function producerKeyFromName(name:string){return normalizeReferenceText(name)}
export function validRegistryElid(value:string){return isValidElid(value)}
