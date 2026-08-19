import { describe,expect,it } from 'vitest';
import { favoriteOnlyQuery,favoriteUpdateSchema } from '../../src/lib/journal/favorite';

describe('wine favorites',()=>{
  it('accepts only an explicit boolean favorite update',()=>{
    expect(favoriteUpdateSchema.safeParse({favorite:true}).success).toBe(true);
    expect(favoriteUpdateSchema.safeParse({favorite:false}).success).toBe(true);
    expect(favoriteUpdateSchema.safeParse({favorite:1}).success).toBe(false);
    expect(favoriteUpdateSchema.safeParse({favorite:true,other:'x'}).success).toBe(false);
  });

  it('enables the Favorites journal scope only for the canonical query value',()=>{
    expect(favoriteOnlyQuery('1')).toBe(true);
    expect(favoriteOnlyQuery(undefined)).toBe(false);
    expect(favoriteOnlyQuery('0')).toBe(false);
    expect(favoriteOnlyQuery('true')).toBe(false);
  });
});
