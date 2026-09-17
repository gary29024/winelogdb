import { normalizeProducerAlias } from '../producers/entities';
import { missingTable } from '../db/ownerRevision';

/**
 * Producer names a friend has research for that look like this account's.
 *
 * Reuse matches on the exact normalized producer name, and alias corrections are
 * owner-scoped, so a member who writes "Ch Margaux" never meets a friend's
 * research filed under "Château Margaux" and pays for it again. Nothing can be
 * matched automatically - a wrong match would attach another producer's research
 * to this wine - so this only ever produces a suggestion for a person to confirm.
 *
 * Plain edit distance is the wrong tool for the motivating case: "ch margaux" to
 * "chateau margaux" is six edits, further apart than two genuinely different
 * producers often are. The three rules below are narrow and each says something
 * specific about how people actually write these names.
 */
export type ProducerNameSuggestion={name:string;reason:'abbreviation'|'spelling'|'prefix'};

const tokens=(key:string)=>key.split(' ').filter(Boolean);

/** Words that head a producer name without distinguishing it from its neighbours. */
const GENERIC=new Set(['domaine','chateau','maison','estate','winery','weingut','bodega','bodegas','tenuta','azienda','cantina','castello','quinta','clos']);

/**
 * Same words, one side abbreviated: "ch margaux" / "chateau margaux".
 * Every token must line up, and at least one must be a strict abbreviation, so
 * this cannot fire on two names that merely share a word.
 */
function abbreviates(a:string[],b:string[]){
  if(a.length!==b.length)return false;
  let shortened=false;
  for(let i=0;i<a.length;i++){
    const [x,y]=[a[i],b[i]];
    if(x===y)continue;
    const [short,long]=x.length<y.length?[x,y]:[y,x];
    // A single letter is too little to go on: "c margaux" could be anything.
    if(short.length<2||!long.startsWith(short))return false;
    shortened=true;
  }
  return shortened;
}

/** One generic head word present on one side only: "dujac" / "domaine dujac". */
function differsByGenericHead(a:string[],b:string[]){
  const [short,long]=a.length<b.length?[a,b]:[b,a];
  if(long.length!==short.length+1||!GENERIC.has(long[0]))return false;
  return long.slice(1).join(' ')===short.join(' ');
}

/** The name with a leading generic word removed: what actually distinguishes it. */
function distinctive(parts:string[]){
  const rest=parts.length>1&&GENERIC.has(parts[0])?parts.slice(1):parts;
  return rest.join(' ');
}

export function editDistance(a:string,b:string){
  let previous=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const current=[i];
    for(let j=1;j<=b.length;j++)current[j]=Math.min(previous[j]+1,current[j-1]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));
    previous=current;
  }
  return previous[b.length];
}

/** Bounded Levenshtein: stops as soon as the distance cannot come in under the limit. */
export function withinEditDistance(a:string,b:string,limit:number){
  if(Math.abs(a.length-b.length)>limit)return false;
  let previous=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const current=[i];let best=i;
    for(let j=1;j<=b.length;j++){
      const cost=a[i-1]===b[j-1]?0:1;
      current[j]=Math.min(previous[j]+1,current[j-1]+1,previous[j-1]+cost);
      if(current[j]<best)best=current[j];
    }
    if(best>limit)return false;
    previous=current;
  }
  return previous[b.length]<=limit;
}

export function suggestionFor(mine:string,theirs:string):ProducerNameSuggestion['reason']|null{
  if(!mine||!theirs||mine===theirs)return null;
  const a=tokens(mine),b=tokens(theirs);
  if(abbreviates(a,b))return 'abbreviation';
  if(differsByGenericHead(a,b))return 'prefix';
  // Typos, measured on the distinctive part only. Measuring whole names lets a
  // shared generic head word dilute the ratio until two different producers look
  // like a typo: "domaine dujac" and "domaine dugat" are two edits apart across
  // thirteen characters, and they are not the same estate. Stripping the head
  // word puts those two edits against five characters, where they belong.
  const [x,y]=[distinctive(a),distinctive(b)];
  const longest=Math.max(x.length,y.length);
  if(longest>=6&&withinEditDistance(x,y,2)&&editDistance(x,y)<=longest*0.15)return 'spelling';
  return null;
}

const MAX_SUGGESTIONS=3;

/**
 * Producer names among this account's friends' shared research that look like
 * the given producer. Reads the producer-scope keys only, which are short, and
 * takes a bounded slice of them: this runs on a page view.
 */
export async function similarFriendProducers(db:D1Database,owner:string,canonicalName:string):Promise<ProducerNameSuggestion[]>{
  const mine=normalizeProducerAlias(canonicalName);
  if(!mine)return [];
  try{
    const rows=await db.prepare(`SELECT DISTINCT r.subject_key FROM reusable_research r
      JOIN friendships f ON f.friend_id=r.contributor_id AND f.user_id=?
      JOIN app_users u ON u.id=r.contributor_id AND u.status='active'
      WHERE r.scope='producer' AND r.quality_version=1 LIMIT 200`).bind(owner).all<{subject_key:string}>();
    const seen=new Set<string>(),out:ProducerNameSuggestion[]=[];
    for(const row of rows.results??[]){
      let name='';
      // A producer key is [producer] or [producer,country]; only the name matters.
      try{const parsed=JSON.parse(row.subject_key) as unknown[];name=typeof parsed[0]==='string'?parsed[0]:''}catch{continue}
      if(!name||seen.has(name))continue;
      seen.add(name);
      const reason=suggestionFor(mine,name);
      if(reason)out.push({name,reason});
      if(out.length>=MAX_SUGGESTIONS)break;
    }
    return out;
  }catch(error){
    if(missingTable(error))return [];
    throw error;
  }
}
