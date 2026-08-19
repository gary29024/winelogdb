import { describe,expect,it } from 'vitest';
import { catalogTargetForCuvee,changeCuveeCatalogLinkSchema,createCuveeCatalogLinkSchema,unlinkCuveeCatalogLinkSchema } from '../../src/lib/cuvees/catalogLinks';

describe('cuvee catalog links',()=>{
  it('uses a direct catalog identity before manual mappings',()=>{
    const catalog=new Set(['catalog-a','catalog-b']),links=new Map([['source-a','catalog-b']]);
    expect(catalogTargetForCuvee('catalog-a',catalog,links)).toBe('catalog-a');
    expect(catalogTargetForCuvee('source-a',catalog,links)).toBe('catalog-b');
    expect(catalogTargetForCuvee('unknown',catalog,links)).toBeNull();
    expect(catalogTargetForCuvee(null,catalog,links)).toBeNull();
  });

  it('requires explicit confirmation and different source/catalog identities',()=>{
    const source='11111111-1111-4111-8111-111111111111',catalog='22222222-2222-4222-8222-222222222222';
    expect(createCuveeCatalogLinkSchema.safeParse({confirmation:'LINK_CUVEE_TO_CATALOG',sourceCuveeId:source,catalogCuveeId:catalog}).success).toBe(true);
    expect(createCuveeCatalogLinkSchema.safeParse({confirmation:'LINK_CUVEE_TO_CATALOG',sourceCuveeId:source,catalogCuveeId:source}).success).toBe(false);
    expect(createCuveeCatalogLinkSchema.safeParse({confirmation:'YES',sourceCuveeId:source,catalogCuveeId:catalog}).success).toBe(false);
    expect(changeCuveeCatalogLinkSchema.safeParse({confirmation:'CHANGE_CUVEE_CATALOG_LINK',catalogCuveeId:catalog}).success).toBe(true);
    expect(unlinkCuveeCatalogLinkSchema.safeParse({confirmation:'UNLINK_CUVEE_FROM_CATALOG'}).success).toBe(true);
  });
});
