import type { ReactNode } from 'react';
import '../pageHeader.css';

/**
 * One page header, where there were four.
 *
 * The Journal had `.hero journal-hero`, a producer had `.producer-header`, a
 * wine had `.wine-identity` and the Passport had its own - four
 * implementations of eyebrow, title, subtitle and counts, each with its own
 * spacing and its own idea of how big a title is. Pages drifted apart because
 * nothing held them together, not because anyone chose differently.
 *
 * `media` is whatever sits beside the words: a bottle photograph, an estate
 * picture, a tinted tile. Laying it out beside the title rather than above it
 * is what buys back the top third of a phone screen.
 */
export function PageHeader({eyebrow,title,subtitle,stats,media,actions,children,className,titleId}:{
  eyebrow?:ReactNode;
  title:ReactNode;
  subtitle?:ReactNode;
  /** Short counts shown as one interpunct-separated line, e.g. 21 wines · 6 tasted. */
  stats?:(string|null|undefined|false)[];
  media?:ReactNode;
  actions?:ReactNode;
  children?:ReactNode;
  className?:string;
  titleId?:string;
}){
  const counts=(stats??[]).filter((entry):entry is string=>Boolean(entry));
  return <header className={`page-header${media?' has-media':''}${className?` ${className}`:''}`}>
    {media&&<div className="page-header-media">{media}</div>}
    <div className="page-header-body">
      {eyebrow&&<p className="eyebrow">{eyebrow}</p>}
      <h1 id={titleId}>{title}</h1>
      {subtitle&&<p className="page-header-subtitle">{subtitle}</p>}
      {counts.length>0&&<p className="page-header-stats">{counts.join(' · ')}</p>}
      {children}
    </div>
    {actions&&<div className="page-header-actions">{actions}</div>}
  </header>;
}
