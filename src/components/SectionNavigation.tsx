export type SectionItem={id:string;label:string;count?:number};
export function SectionNavigation({items,selected,onSelect,label}:{items:SectionItem[];selected:string;onSelect:(id:string)=>void;label:string}){
 return <nav className="section-navigation" aria-label={label}>{items.map(item=><button type="button" key={item.id} aria-current={selected===item.id?'page':undefined} onClick={()=>onSelect(item.id)}>{item.label}{Boolean(item.count)&&<span className="section-count">{item.count}</span>}</button>)}</nav>;
}
