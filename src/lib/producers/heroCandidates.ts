/**
 * Finding a producer's hero photograph in their own homepage.
 *
 * Reported as: a research run rarely comes back with a picture. The reading was
 * one meta tag - og:image - on one page, and an estate site that does not set
 * it, sets it to a logo, or is built by a shop platform that puts the picture
 * somewhere else came back with nothing at all.
 *
 * So the tag is now the first place looked at rather than the only one, and the
 * caller tries the candidates in order until one downloads as an image. Pure,
 * because the ordering is the whole rule and it is far easier to argue with in
 * a test than through a live estate website.
 *
 * Every source here is one the site *declares* as the page's own picture. The
 * page's <img> tags were read too for a while and it was a mistake: reported
 * back as meaningless photographs, because the largest picture on a homepage is
 * as often a stock close-up of grapes as it is the estate. A site that declares
 * nothing has said nothing, and no picture is better than that one.
 */
export const htmlAttribute=(tag:string,name:string)=>tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,'i'))?.slice(1).find(Boolean)??null;

/** Whatever the platform calls its furniture. None of it is the estate. */
const FURNITURE=/logo|icon|favicon|sprite|placeholder|spacer|pixel|avatar|badge|banner-ad|loading|1x1|blank/i;
/** Meta names, best first: the estate's own choice of picture beats a guess. */
const META_KEYS=['og:image','og:image:secure_url','twitter:image','twitter:image:src'];
/** Four downloads is a bounded search; a fifth candidate is guesswork anyway. */
const MAX_CANDIDATES=4;

const decode=(value:string)=>value.replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,code:string)=>String.fromCharCode(Number(code))).trim();

/**
 * Every JSON-LD `image`, which is where Shopify, Squarespace and most winery
 * templates put the estate photograph whether or not they also set og:image.
 */
function jsonLdImages(html:string){
  const found:string[]=[];
  for(const block of html.match(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)??[]){
    const body=block.replace(/^[\s\S]*?>/,'').replace(/<\/script>$/i,'');
    // Walked rather than typed: the shape is @graph, arrays, and objects that
    // carry the url one level down, and any of them can hold the picture.
    const walk=(value:unknown,depth:number):void=>{
      if(depth>6||!value)return;
      if(Array.isArray(value)){for(const entry of value)walk(entry,depth+1);return}
      if(typeof value!=='object')return;
      for(const [key,entry] of Object.entries(value as Record<string,unknown>)){
        if(key==='image'){
          if(typeof entry==='string')found.push(entry);
          else if(Array.isArray(entry))for(const item of entry){if(typeof item==='string')found.push(item);else if(item&&typeof item==='object'&&typeof (item as {url?:unknown}).url==='string')found.push((item as {url:string}).url)}
          else if(entry&&typeof entry==='object'&&typeof (entry as {url?:unknown}).url==='string')found.push((entry as {url:string}).url);
        }
        walk(entry,depth+1);
      }
    };
    try{walk(JSON.parse(body),0)}catch{/* a template that ships broken JSON-LD is common and not our problem */}
  }
  return found;
}

/**
 * The pictures worth trying, best first and without duplicates.
 *
 * Raw strings, resolved against the page by the caller: relative paths, //cdn
 * hosts and the http version of an https site all appear here, and only the
 * caller knows which base to resolve them against.
 */
export function heroImageCandidates(html:string,limit=MAX_CANDIDATES){
  const found:string[]=[];
  const add=(value:string|null|undefined)=>{
    const cleaned=value?decode(value):'';
    if(cleaned&&!FURNITURE.test(cleaned)&&!found.includes(cleaned))found.push(cleaned);
  };

  const metas=html.match(/<meta\b[^>]*>/gi)??[];
  for(const key of META_KEYS)
    for(const tag of metas)
      if(String(htmlAttribute(tag,'property')||htmlAttribute(tag,'name')||'').toLowerCase()===key)add(htmlAttribute(tag,'content'));

  for(const tag of html.match(/<link\b[^>]*>/gi)??[])
    if(String(htmlAttribute(tag,'rel')||'').toLowerCase()==='image_src')add(htmlAttribute(tag,'href'));

  for(const image of jsonLdImages(html))add(image);
  return found.slice(0,limit);
}
