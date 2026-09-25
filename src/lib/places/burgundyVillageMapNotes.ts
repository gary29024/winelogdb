/**
 * Reviewed notes for Gevrey designations whose INAO production areas overlap.
 *
 * The map paints each spot once: translucent fills stack, so painting both
 * sides of an overlap made Clos de Bèze and Charmes/Mazoyères read darker - as
 * if "more" Grand Cru - than their neighbours. `paintedBy` names the
 * designation whose fill already covers this one; it keeps its outline, its
 * highlight when selected, and is still reachable by click and in the list.
 *
 * The labelling rules are the reason these overlaps matter to a bottle: they
 * say which name on a label can hide which ground.
 */
export const villageMapNotes:Record<string,{note:string;paintedBy?:string}>={
  'inao-denom-447':{note:'Chambertin’s production area takes in Clos de Bèze, whose wine may also be labelled Chambertin - so a Chambertin can come from either.'},
  'inao-denom-448':{note:'Clos de Bèze lies inside Chambertin’s production area, and its wine may also be labelled Chambertin.',paintedBy:'inao-denom-447'},
  'inao-denom-477':{note:'Charmes-Chambertin and Mazoyères-Chambertin share one production area. Mazoyères wine may be labelled Charmes-Chambertin, but not the reverse - so a Charmes can come from either.'},
  'inao-denom-809':{note:'Mazoyères-Chambertin shares its production area with Charmes-Chambertin, and its wine may be labelled Charmes-Chambertin.',paintedBy:'inao-denom-477'}
};

/** Designations left unfilled because another fill already covers them. */
export const unpaintedVillageMapIds=Object.entries(villageMapNotes).filter(([,entry])=>entry.paintedBy).map(([id])=>id);
