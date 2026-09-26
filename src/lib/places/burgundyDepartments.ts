// Records often give a département as the region. Each is compatible with the
// subregions it holds, plus appellations filed outside them (Maranges lies in
// Saône-et-Loire but belongs to the Côte de Beaune; the Grand Auxerrois
// villages sit directly under Burgundy). Anything else still conflicts. This is
// geography for region checks only, not a place in the hierarchy.
export const departmentRegions:Record<string,string[]>={
 'cote dor':['france/burgundy/cote-de-nuits','france/burgundy/cote-de-beaune'],
 'saone et loire':['france/burgundy/cote-chalonnaise','france/burgundy/maconnais'],
 'yonne':['france/burgundy/chablis'],
};
export const departmentAppellations:Record<string,string[]>={
 'saone et loire':['Maranges'],
 'yonne':['Irancy','Saint-Bris','Vézelay','Bourgogne Vézelay'],
};
