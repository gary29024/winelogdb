export type AchievementChecklistHeading={section:string|null;subsection:string|null};

export function achievementChecklistHeading(definitionId:string,index:number):AchievementChecklistHeading{
  if(definitionId==='bordeaux-1855-red-classified-growths'){
    if(index<5)return {section:'First Growths · Premiers Crus',subsection:null};
    if(index<19)return {section:'Second Growths · Deuxièmes Crus',subsection:null};
    if(index<33)return {section:'Third Growths · Troisièmes Crus',subsection:null};
    if(index<43)return {section:'Fourth Growths · Quatrièmes Crus',subsection:null};
    return {section:'Fifth Growths · Cinquièmes Crus',subsection:null};
  }
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
