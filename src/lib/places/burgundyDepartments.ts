// Records often give the département as the region. Côte d'Or holds both the
// Côte de Nuits and the Côte de Beaune, so it is compatible with either; it
// still conflicts with Chablis, the Côte Chalonnaise and the Mâconnais. It is
// geography for region checks only, not a place in the hierarchy.
export const departmentRegions:Record<string,string[]>={
 'cote dor':['france/burgundy/cote-de-nuits','france/burgundy/cote-de-beaune'],
};
