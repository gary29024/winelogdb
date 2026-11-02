import { afterEach,describe,expect,it,vi } from 'vitest';
import { photoPlaceName } from '../../src/lib/places/photoPlace';
import { geonamesRow,placesBucket } from './support/placesFixture';

afterEach(()=>vi.restoreAllMocks());

describe('the place a photo was taken',()=>{
  it('is the nearest place to its GPS, with that place’s region',async()=>{
    // The batch that reported this was photographed across Tokyo, and the label
    // model named its bottles "Yoichi, Hokkaido", "Hokkaido" and "Courmas".
    const {bucket}=placesBucket();
    expect(await photoPlaceName(bucket,35.608,139.672)).toBe('Jiyūgaoka, Tokyo');
    expect(await photoPlaceName(bucket,35.644,139.724)).toBe('Ebisu, Tokyo');
    expect(await photoPlaceName(bucket,35.67,139.773)).toBe('Chūō, Tokyo');
    expect(await photoPlaceName(bucket,35.548,139.768)).toBe('Haneda, Tokyo');
  });

  it('names the country when the region would only repeat the place',async()=>{
    const {bucket}=placesBucket();
    expect(await photoPlaceName(bucket,35.6895,139.6917)).toBe('Tokyo, Japan');
    expect(await photoPlaceName(bucket,22.2783,114.1747)).toBe('Hong Kong');
  });

  it('names a small country rather than its district',async()=>{
    expect(await photoPlaceName(placesBucket().bucket,22.28045,114.192275)).toBe('Tin Hau, Hong Kong');
  });

  it('finds a nearer place across the edge of a one-degree cell',async()=>{
    // 35.999 is in cell 35, and the place 220 m north is in cell 36.
    const cities=[geonamesRow(1,'Far Side',35.6,139.5,'PPL','JP','40',1000),geonamesRow(2,'Near Side',36.001,139.5,'PPL','JP','40',1000)].join('\n');
    expect(await photoPlaceName(placesBucket(cities).bucket,35.999,139.5)).toBe('Near Side, Tokyo');
  });

  it('finds a place across the antimeridian',async()=>{
    expect(await photoPlaceName(placesBucket(geonamesRow(3,'Waiyevo',-16.79,-179.98,'PPL','FJ','',1000)).bucket,-16.79,179.95)).toBe('Waiyevo');
  });

  it('names nothing more than 50 km from the nearest place',async()=>{
    const {bucket}=placesBucket();
    expect(await photoPlaceName(bucket,43.64389,140.77028)).toBe('Yoichi, Hokkaido');
    expect(await photoPlaceName(bucket,43.66389,140.77028)).toBeNull();
    expect(await photoPlaceName(bucket,30,-40)).toBeNull();
  });

  it('names nothing without GPS or imported places, and never fails the scan',async()=>{
    expect(await photoPlaceName(placesBucket().bucket,null,null)).toBeNull();
    expect(await photoPlaceName(undefined,35.608,139.672)).toBeNull();
    expect(await photoPlaceName({get:async()=>null} as unknown as R2Bucket,35.608,139.672)).toBeNull();
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
    expect(await photoPlaceName({get:async()=>{throw new Error('R2 unavailable')}} as unknown as R2Bucket,35.608,139.672)).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('photo-place-lookup-failed'));
  });

  it('reads one shard for a photo well inside its cell',async()=>{
    const {bucket,reads}=placesBucket();
    await photoPlaceName(bucket,35.608,139.672);
    expect(reads.filter(key=>key.includes('/shard-'))).toHaveLength(1);
  });
});
