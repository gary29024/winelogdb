import { describe,expect,it } from 'vitest';
import { burgundyAtlasPlace,burgundyAtlasWinePlace } from '../../src/lib/places/burgundyAtlas';
import mapping from '../../src/lib/places/burgundyAtlasLinks.json';
import { getAchievementDefinition } from '../../src/features/achievements/definitions';

describe('Burgundy Atlas destinations',()=>{
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
