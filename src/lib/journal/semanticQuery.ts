export function shouldUseSemanticQuery(query:string){
  const clean=query.trim();
  if(!clean||/^\d{4}$/.test(clean))return false;
  const cjk=(clean.match(/[\u3400-\u9fff\uf900-\ufaff]/gu)??[]).length;
  if(cjk>=4)return true;
  const words=clean.split(/\s+/u).filter(Boolean);
  return words.length>=3;
}
