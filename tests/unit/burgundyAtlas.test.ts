import { describe,expect,it } from 'vitest';
import { burgundyAtlasPlace,burgundyAtlasWinePlace } from '../../src/lib/places/burgundyAtlas';
import mapping from '../../src/lib/places/burgundyAtlasLinks.json';
import { atlasCollections,getAchievementDefinition } from '../../src/features/achievements/curatedLaunch';

describe('Burgundy Atlas destinations',()=>{
  // Curation, not the raw definition list: `definitions` still carries the
  // Burgundy checklists `curatedLaunch` removed, so asserting against it would
  // vouch for links on pages the app never serves.
  //
  // Named rather than counted, so a row that stops linking has to be admitted
  // here rather than absorbed into a tally. A producer collection earns its
  // place by the matcher withholding these, not by every row resolving.
  const unlinkedRows:Record<string,string[]>={'domaine-romanee-conti':['Cuvée Duvault-Blochet']};

  it('links every row of every collection it claims, apart from named exceptions',()=>{
    for(const id of atlasCollections){
      const collection=getAchievementDefinition(id);
      expect(collection,`${id} is not a curated collection`).not.toBeNull();
      expect(collection!.items.filter(item=>!burgundyAtlasPlace(item.label)).map(item=>item.label),id)
        .toEqual(unlinkedRows[id]??[]);
    }
  });

  it('sends a producer row to the appellation, not to a parcel or the estate',()=>{
    const drc=getAchievementDefinition('domaine-romanee-conti')!;
    expect(drc.items.map(item=>burgundyAtlasPlace(item.label)?.placeId??null)).toEqual([
      'france/burgundy/cote-de-nuits/romanee-conti','france/burgundy/cote-de-nuits/la-tache',
      'france/burgundy/cote-de-nuits/richebourg','france/burgundy/cote-de-nuits/romanee-saint-vivant',
      'france/burgundy/cote-de-nuits/grands-echezeaux','france/burgundy/cote-de-nuits/echezeaux',
      'france/burgundy/cote-de-beaune/montrachet','france/burgundy/cote-de-beaune/corton',
      'france/burgundy/cote-de-beaune/corton-charlemagne',null
    ]);
    // The Domaine owns Romanée-Conti outright and farms a slice of Échezeaux.
    // Either way the row resolves to the appellation every grower shares, so
    // the estate's own checklist and the 33-cru one agree on the destination.
    const explorer=getAchievementDefinition('burgundy-33-grand-crus')!;
    for(const label of ['Romanée-Conti','Échezeaux','Montrachet'])
      expect(burgundyAtlasPlace(label)?.url,label)
        .toBe(burgundyAtlasPlace(explorer.items.find(item=>item.label===label)!.label)?.url);
    expect(drc.items.some(item=>/domaine|drc/i.test(item.label))).toBe(false);
  });

  it('covers every appellation in the existing 33 Grand Cru collection with a distinct canonical link',()=>{
    const collection=getAchievementDefinition('burgundy-33-grand-crus')!;
    const places=collection.items.map(item=>burgundyAtlasPlace(item.label));
    expect(places).toHaveLength(33);
    expect(places.every(Boolean)).toBe(true);
    expect(new Set(places.map(place=>place?.url)).size).toBe(33);
    for(const place of places){
      const url=new URL(place!.url);
      expect(url.origin).toBe('https://burgundyatlas.com');
      expect(url.pathname).toMatch(/^\/place\/ba_(?:designation|appellation)_[a-z0-9]+\/[a-z-]+$/);
      expect(url.search).toBe('');
    }
  });

  it('uses the Grand Cru La Romanée rather than its Premier Cru namesakes',()=>{
    expect(burgundyAtlasPlace('La Romanée')?.url).toContain('ba_designation_z4rwjlfbbel4n3rsdrx5iazjca');
  });

  it('keeps Chablis Grand Cru at appellation scope rather than inventing a climat',()=>{
    expect(burgundyAtlasPlace('Chablis Grand Cru')?.url).toContain('/ba_appellation_');
    expect(burgundyAtlasPlace('Chablis')).toBeNull();
    expect(burgundyAtlasPlace('Chablis Grand Cru Les Clos')).toBeNull();
    expect(mapping.entries.filter(entry=>entry.kind==='designation')).toHaveLength(32);
  });

  it.each(['ÉCHEZEAUX','Echezeaux Grand Cru','Grand Cru Échezeaux',' Échezeaux AOC ','AOP Échezeaux'])('accepts an unambiguous spelling: %s',name=>{
    expect(burgundyAtlasPlace(name)?.name).toBe('Échezeaux');
  });

  it('supports explicit aliases without collapsing neighbouring appellations',()=>{
    expect(burgundyAtlasPlace('Clos Vougeot')?.name).toBe('Clos de Vougeot');
    expect(burgundyAtlasPlace('Romanée St Vivant')?.name).toBe('Romanée-Saint-Vivant');
    expect(burgundyAtlasPlace('Grands Échezeaux')?.url).not.toBe(burgundyAtlasPlace('Échezeaux')?.url);
    expect(burgundyAtlasPlace('Bâtard-Montrachet')?.url).not.toBe(burgundyAtlasPlace('Montrachet')?.url);
  });

  it.each(['Montrachet blend','Chambertin / Charmes-Chambertin','Gevrey-Chambertin Premier Cru','Saint-Émilion Grand Cru','',null])('withholds ambiguous or unsupported places: %s',name=>{
    expect(burgundyAtlasPlace(name)).toBeNull();
  });
});

describe('wine context',()=>{
  const wine={appellation:'Chambertin',country:'France',region:'Bourgogne',classification:'grand_cru'};
  it('accepts an exact appellation with absent broader fields or a Burgundy subregion',()=>{
    expect(burgundyAtlasWinePlace({appellation:'Chambertin'})?.name).toBe('Chambertin');
    expect(burgundyAtlasWinePlace({...wine,region:'Côte de Nuits'})?.name).toBe('Chambertin');
  });
  it.each([{country:'United States'},{region:'Bordeaux'},{region:'Côte de Beaune'},{region:'Unknown'},{classification:'premier_cru'},{classification:'village'},{identityMatchStatus:'conflict'}])('withholds contradictory or disputed identity: %j',overrides=>{
    expect(burgundyAtlasWinePlace({...wine,...overrides})).toBeNull();
  });
  it('does not infer the Grand Cru from a La Romanée namesake in another village',()=>{
    expect(burgundyAtlasWinePlace({appellation:'La Romanée',region:'Gevrey-Chambertin'})).toBeNull();
  });
});
