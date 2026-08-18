export function applyJournalVintageSearch(url:URL){
  const query=(url.searchParams.get('query')||'').trim();
  if(url.searchParams.has('vintage')||!/^\d{4}$/.test(query))return false;
  const vintage=Number(query);
  if(vintage<1000||vintage>2200)return false;
  url.searchParams.set('vintage',String(vintage));
  url.searchParams.delete('query');
  return true;
}
