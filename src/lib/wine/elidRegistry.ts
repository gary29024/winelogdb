import { normalizeReferenceText } from './referenceCatalog';
import { isValidElid } from './referenceIdentity';

export const ELID_WINE_PATH=/^\/wine\/([A-Z]{2}-[A-Z]{3}-[A-Z0-9]{6})(?:-(\d{4}|XXXX|NVXX|N[A-Z0-9]{3})(?:\+[A-Z0-9]{3,4})?)?$/;
export const ELID_PRODUCER_PATH=/^\/producer\/([A-Z]{2}-[A-Z0-9]{4})$/;

const decode=(text:string)=>text.replace(/&(?:#(x[0-9a-f]+|\d+)|(amp|quot|apos|lt|gt|nbsp));/gi,(entity,numeric:string|undefined,named:string|undefined)=>{
 if(numeric){const code=Number.parseInt(numeric.replace(/^x/i,''),/^x/i.test(numeric)?16:10);return code>0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff)?String.fromCodePoint(code):entity}
 return ({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '} as Record<string,string>)[named!.toLowerCase()]??entity;
});
const plain=(html:string)=>decode(html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());

export function htmlLinks(html:string){
 const out:Array<{href:string;text:string}>=[],re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;let match:RegExpExecArray|null;
 while((match=re.exec(html)))out.push({href:decode(match[1]),text:plain(match[2])});
 return out;
}
export function heading(html:string,level=1){
 const match=html.match(new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`,'i'));return match?plain(match[1]):'';
}
/** Only same-origin registry URLs; ignore unrelated and malformed sitemap entries. */
export function sitemapPaths(xml:string){
 const paths:string[]=[];
 for(const match of xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)){
  try{const url=new URL(decode(match[1].trim()));if(url.origin==='https://elid.wine'&&!url.search&&!url.hash)paths.push(url.pathname)}catch{/* not a registry URL */}
 }
 return [...new Set(paths)];
}
export function elidParts(path:string){
 const match=path.match(ELID_WINE_PATH);if(!match)return null;
 return {baseElid:match[1],vintageCode:match[2]??'',elid:match[2]?path.slice('/wine/'.length):null};
}
export function producerKeyFromName(name:string){return normalizeReferenceText(name)}
export function validRegistryElid(value:string|null){return isValidElid(value)}

type RobotsRule={allow:boolean;pattern:string};
type RobotsGroup={agents:string[];rules:RobotsRule[]};
export function parseRobots(text:string):RobotsGroup[]{
 const groups:RobotsGroup[]=[];let group:RobotsGroup|null=null,seenRule=false;
 for(const raw of text.split(/\r?\n/)){
  const line=raw.replace(/#.*$/,'').trim();if(!line)continue;
  const split=line.indexOf(':');if(split<0)continue;
  const field=line.slice(0,split).trim().toLowerCase(),value=line.slice(split+1).trim();
  if(field==='user-agent'){
   if(!group||seenRule){group={agents:[],rules:[]};groups.push(group);seenRule=false}
   group.agents.push(value.toLowerCase());continue;
  }
  if((field==='allow'||field==='disallow')&&group){
   seenRule=true;if(value)group.rules.push({allow:field==='allow',pattern:value});
  }
 }
 return groups;
}
function ruleMatches(path:string,pattern:string){
 const escaped=pattern.replace(/[.+?^{}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*');
 const end=escaped.endsWith('$'),body=end?escaped.slice(0,-1):escaped;
 return new RegExp(`^${body}${end?'$':''}`).test(path);
}
export function robotsAllows(text:string,path:string,userAgent:string){
 const groups=parseRobots(text),ua=userAgent.toLowerCase();let best=-1,selected:RobotsGroup[]=[];
 for(const group of groups){
  const specificity=Math.max(...group.agents.map(agent=>agent==='*'?0:(ua.includes(agent)?agent.length:-1)));
  if(specificity<0)continue;
  if(specificity>best){best=specificity;selected=[group]}else if(specificity===best)selected.push(group);
 }
 if(best<0)return true;
 const matches=selected.flatMap(group=>group.rules).filter(rule=>ruleMatches(path,rule.pattern));
 if(!matches.length)return true;
 const longest=Math.max(...matches.map(rule=>rule.pattern.replace(/\$$/,'').length));
 return matches.filter(rule=>rule.pattern.replace(/\$$/,'').length===longest).some(rule=>rule.allow);
}
export function retryAfterMs(value:string|null,now=Date.now()){
 if(!value)return null;
 const seconds=Number(value);if(Number.isFinite(seconds)&&seconds>=0)return seconds*1000;
 const when=Date.parse(value);return Number.isFinite(when)?Math.max(0,when-now):null;
}
