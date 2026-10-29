/** Browser quoting and server reservation must use the same route inventory. */
export const champagneExtractionRoute=(path:string)=>path.match(/^\/api\/wines\/([^/]+)\/champagne-extraction$/);
export const batchSubmitRoute=(path:string)=>path.match(/^\/api\/batch-recognition\/sessions\/([^/]+)\/submit$/);

export function requiresAiReservation(path:string,method:string){
  return method==='POST'&&(
    path==='/api/recognition'||
    /^\/api\/tastings\/[^/]+\/sheet\/parse$/.test(path)||
    /^\/api\/wines\/[^/]+\/deep-search$/.test(path)||
    Boolean(champagneExtractionRoute(path))||
    /^\/api\/producers\/[^/]+\/research$/.test(path)||
    path==='/api/producers/research-batch'||
    Boolean(batchSubmitRoute(path))||
    path==='/api/maturity/vintage'
  );
}
