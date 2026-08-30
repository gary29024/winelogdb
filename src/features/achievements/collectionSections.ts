import { gravesClassifiedFor,saintEmilionPremierRank } from './expandedDefinitions';

export type AchievementChecklistHeading={section:string|null;subsection:string|null};

/**
 * The heading one checklist row sits under.
 *
 * Most collections answer from the position, because their lists are written in
 * rank order and a position is all the caller has ever needed. The two Bordeaux
 * collections whose heading is a fact about the estate rather than a place in a
 * list answer from the item id instead: the checklist is served from a
 * per-owner cache that can be a release behind, and a stale order turned a
 * position into a wrong claim about a real wine.
 */
export function achievementChecklistHeading(definitionId:string,index:number,itemId?:string):AchievementChecklistHeading{
  const byId=itemId?gravesClassifiedFor[itemId]??saintEmilionPremierRank[itemId]:undefined;
  if(byId)return {section:byId,subsection:null};
  if(definitionId==='bordeaux-1855-red-classified-growths'){
    if(index<5)return {section:'First Growths · Premiers Crus',subsection:null};
    if(index<19)return {section:'Second Growths · Deuxièmes Crus',subsection:null};
    if(index<33)return {section:'Third Growths · Troisièmes Crus',subsection:null};
    if(index<43)return {section:'Fourth Growths · Quatrièmes Crus',subsection:null};
    return {section:'Fifth Growths · Cinquièmes Crus',subsection:null};
  }
  // The sweet-wine half of 1855, which has three ranks rather than the reds'
  // five: Yquem alone at the top, then eleven Premiers and fifteen Seconds.
  // Yquem gets its own heading rather than sitting unremarked at the head of
  // the Premiers - being the only Premier Cru Supérieur ever awarded is the
  // single most quotable fact about the classification.
  if(definitionId==='sauternes-barsac-1855-all'){
    if(index===0)return {section:'Superior First Growth · Premier Cru Supérieur',subsection:null};
    if(index<12)return {section:'First Growths · Premiers Crus',subsection:null};
    return {section:'Second Growths · Seconds Crus',subsection:null};
  }
  // The Top Growths collection is Yquem plus the eleven Premiers, so it spans
  // two ranks too and reads the same way.
  if(definitionId==='sauternes-barsac-top-1855'){
    return index===0
      ?{section:'Superior First Growth · Premier Cru Supérieur',subsection:null}
      :{section:'First Growths · Premiers Crus',subsection:null};
  }
  // Graves and the Saint-Émilion Premiers are answered by id above. The lists
  // are still ordered by classification so each heading's estates sit together,
  // since the page heads consecutive runs - but the ordering only affects how
  // tidily they group, never which heading an estate gets.
  if(definitionId==='burgundy-33-grand-crus'){
    if(index===0)return {section:'Chablis',subsection:'Chablis Grand Cru'};
    if(index<=24){
      if(index<=9)return {section:'Côte de Nuits',subsection:'Gevrey-Chambertin'};
      if(index<=13)return {section:'Côte de Nuits',subsection:'Morey-Saint-Denis'};
      if(index===14)return {section:'Côte de Nuits',subsection:'Chambolle-Musigny / Morey-Saint-Denis'};
      if(index===15)return {section:'Côte de Nuits',subsection:'Chambolle-Musigny'};
      if(index===16)return {section:'Côte de Nuits',subsection:'Vougeot'};
      return {section:'Côte de Nuits',subsection:'Vosne-Romanée / Flagey-Échezeaux'};
    }
    if(index<=27)return {section:'Côte de Beaune',subsection:'Corton hill · Aloxe-Corton / Pernand-Vergelesses / Ladoix-Serrigny'};
    return {section:'Côte de Beaune',subsection:'Montrachet hill · Puligny-Montrachet / Chassagne-Montrachet'};
  }
  return {section:null,subsection:null};
}
