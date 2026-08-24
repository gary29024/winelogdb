import { describe,expect,it } from 'vitest';
import { buildAchievementProgress } from '../../src/features/achievements/engine';
import { customAchievementInputSchema,materializeCatalogueAchievementItems,materializeCustomAchievementDefinition } from '../../src/features/achievements/customCollections';
import type { AchievementCatalogueOptions,AchievementIdentityRegistry,AchievementWine } from '../../src/features/achievements/types';

const options:AchievementCatalogueOptions={
  producers:[
    {id:'p-dujac',name:'Domaine Dujac',country:'France',region:'Burgundy',catalogCount:2},
    {id:'p-roumier',name:'Domaine Georges Roumier',country:'France',region:'Burgundy',catalogCount:1},
    {id:'p-empty',name:'No Catalogue Estate',country:'France',region:'Burgundy',catalogCount:0}
  ],
  cuvees:[
    {id:'c-dujac-cm',producerId:'p-dujac',producerName:'Domaine Dujac',name:'Charmes-Chambertin',appellation:'Charmes-Chambertin',wineStyle:'red',catalogBacked:true},
    {id:'c-dujac-msd',producerId:'p-dujac',producerName:'Domaine Dujac',name:'Morey-Saint-Denis',appellation:'Morey-Saint-Denis',wineStyle:'red',catalogBacked:true},
    {id:'c-roumier-cm',producerId:'p-roumier',producerName:'Domaine Georges Roumier',name:'Charmes-Chambertin',appellation:'Charmes-Chambertin',wineStyle:'red',catalogBacked:true},
    {id:'c-journal',producerId:'p-dujac',producerName:'Domaine Dujac',name:'Journal only',appellation:'Morey-Saint-Denis',wineStyle:'red',catalogBacked:false}
  ],
  appellations:[{name:'Charmes-Chambertin',producerCount:2,cuveeCount:2},{name:'Morey-Saint-Denis',producerCount:1,cuveeCount:1}],
  regions:[{name:'Burgundy',country:'France',producerCount:2}]
};

const registry:AchievementIdentityRegistry={
  producers:[{id:'p-dujac',canonicalName:'Dujac renamed',aliases:['Domaine Dujac']},{id:'p-roumier',canonicalName:'Domaine Georges Roumier'}],
  cuvees:[{id:'c-dujac-cm',producerId:'p-dujac',canonicalName:'Charmes-Chambertin renamed',aliases:['Charmes-Chambertin'],appellation:'Charmes-Chambertin'}]
};
const wines:AchievementWine[]=[{id:'w1',producerId:'p-dujac',cuveeId:'c-dujac-cm',producer:'Dujac renamed',wineName:'Charmes-Chambertin renamed',vintage:2021,appellation:'Charmes-Chambertin'}];

describe('editable achievement collections',()=>{
  it('requires at least one manual target or a live catalogue rule',()=>{
    expect(customAchievementInputSchema.safeParse({title:'Mine',subtitle:'',icon:'burgundy-grand-cru',mode:'manual',items:[]}).success).toBe(false);
    expect(customAchievementInputSchema.safeParse({title:'Mine',subtitle:'',icon:'burgundy-grand-cru',mode:'catalogue'}).success).toBe(false);
  });
  it('materializes fixed picks with stable ids so later display-name changes still count',()=>{
    const definition=materializeCustomAchievementDefinition({id:'mine',title:'Mine',subtitle:'',icon:'burgundy-grand-cru',mode:'manual',items:[{type:'cuvee',cuveeId:'c-dujac-cm'}],rule:null},options);
    expect(definition).toMatchObject({origin:'custom',editable:true});
    expect(definition.items[0].selector).toMatchObject({type:'cuvee',producerId:'p-dujac',cuveeId:'c-dujac-cm'});
    expect(buildAchievementProgress(definition,registry,wines).completed).toBe(1);
  });
  it('regenerates a producer-range checklist from current catalogue-backed cuvees',()=>{
    const rule={type:'producer_cuvees' as const,producerId:'p-dujac',producerName:'Domaine Dujac'};
    expect(materializeCatalogueAchievementItems(rule,options).map(item=>item.id)).toEqual(['cuvee:c-dujac-cm','cuvee:c-dujac-msd']);
    const expanded={...options,cuvees:[...options.cuvees,{id:'c-new',producerId:'p-dujac',producerName:'Domaine Dujac',name:'Clos Saint-Denis',appellation:'Clos Saint-Denis',wineStyle:'red',catalogBacked:true}]};
    expect(materializeCatalogueAchievementItems(rule,expanded)).toHaveLength(3);
  });
  it('deduplicates producers for appellation smart collections',()=>{
    const items=materializeCatalogueAchievementItems({type:'appellation_producers',appellation:'Charmes-Chambertin'},options);
    expect(items.map(item=>item.id)).toEqual(['producer:p-dujac','producer:p-roumier']);
  });
  it('uses only producers with catalogue-backed identities for region smart collections',()=>{
    const items=materializeCatalogueAchievementItems({type:'region_producers',region:'Burgundy',country:'France'},options);
    expect(items.map(item=>item.id)).toEqual(['producer:p-dujac','producer:p-roumier']);
    expect(items.some(item=>item.id==='producer:p-empty')).toBe(false);
  });
});
