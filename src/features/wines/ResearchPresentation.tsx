import { useMemo,type ReactNode } from 'react';
import type { DeepSearchResult } from '../../lib/db/schema';
import { sourceHost,sourceLinkLabel } from './researchSections';

/**
 * How a Deep Search result reads, for anyone looking at it. Both wine detail
 * pages render research through these, so the shared copy matches the owner's.
 *
 * The owner-only diagnostics stay in DetailPage: claim evidence and quality
 * warnings answer "should I trust this run", which belongs to whoever paid for
 * it and can re-run it.
 */

export function ResearchText({text}:{text:string}){
 const nodes:ReactNode[]=[],lines=text.trim().split(/\r?\n/);let paragraph:string[]=[],bullets:string[]=[];
 const flushParagraph=()=>{if(paragraph.length){nodes.push(<p key={`p-${nodes.length}`}>{paragraph.join(' ')}</p>);paragraph=[]}},flushBullets=()=>{if(bullets.length){nodes.push(<ul key={`u-${nodes.length}`}>{bullets.map((item,index)=><li key={index}>{item}</li>)}</ul>);bullets=[]}};
 for(const raw of lines){const line=raw.trim();if(!line){flushParagraph();flushBullets();continue}const bullet=line.match(/^[-•]\s+(.*)$/);if(bullet){flushParagraph();bullets.push(bullet[1]);continue}flushBullets();paragraph.push(line)}flushParagraph();flushBullets();return <div className="research-text">{nodes}</div>;
}

export function DeepSources({sources}:{sources:DeepSearchResult['sources']}){
 const groups=useMemo(()=>{
  const map=new Map<string,typeof sources>();
  for(const source of sources){const host=sourceHost(source.url)||'other sources',list=map.get(host)??[];list.push(source);map.set(host,list)}
  return [...map.entries()].sort(([,a],[,b])=>b.length-a.length);
 },[sources]);
 if(!sources.length)return null;
 return <details className="deep-sources"><summary>{sources.length} source{sources.length===1?'':'s'} · {groups.length} site{groups.length===1?'':'s'}</summary>
  <div className="deep-sources-list">{groups.map(([host,items])=><div className="deep-source-group" key={host}><strong>{host}</strong>{items.map(item=><a key={item.url} href={item.url} target="_blank" rel="noreferrer">{sourceLinkLabel(item,host)}</a>)}</div>)}</div>
 </details>;
}
