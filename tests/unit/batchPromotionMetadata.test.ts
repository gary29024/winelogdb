import { describe,expect,it } from 'vitest';
import { mergeConfirmedWineIdentity,permanentBatchPhotoMetadata } from '../../worker/batchPromotion';

describe('Batch Scan permanent photo metadata',()=>{
  it('preserves and normalizes EXIF capture metadata',()=>{
    expect(permanentBatchPhotoMetadata({capturedAt:'2026-08-07T19:05:12+08:00',latitude:22.2819,longitude:114.158,source:'exif'},'Central')).toEqual({
      capturedAt:'2026-08-07T11:05:12.000Z',
      latitude:22.2819,
      longitude:114.158,
      locationName:'Central',
      metadataSource:'exif'
    });
  });

  it('keeps file fallback timestamps but rejects invalid coordinates',()=>{
    expect(permanentBatchPhotoMetadata({capturedAt:'2026-08-07T20:30:00+08:00',latitude:999,longitude:114.1,source:'file_fallback'},null)).toEqual({
      capturedAt:'2026-08-07T12:30:00.000Z',
      latitude:null,
      longitude:114.1,
      locationName:null,
      metadataSource:'file_fallback'
    });
  });

  it('falls back safely when a photo has no usable metadata',()=>{
    expect(permanentBatchPhotoMetadata({capturedAt:'not-a-date',source:'none'},null)).toEqual({
      capturedAt:null,
      latitude:null,
      longitude:null,
      locationName:null,
      metadataSource:'none'
    });
  });
});

describe('Batch Scan confirmed card identity',()=>{
  it('uses the final edited wine identity while preserving other recognition fields',()=>{
    const recognition={producer:'Old Producer',wineName:'Old Cuvee',vintage:2011,country:'United States',confidence:1};
    expect(mergeConfirmedWineIdentity(recognition,{producer:'Ayoub Wines',wine_name:'Ayoub Estate Pinot Noir',vintage:2011})).toEqual({
      producer:'Ayoub Wines',
      wineName:'Ayoub Estate Pinot Noir',
      vintage:2011,
      country:'United States',
      confidence:1
    });
  });
});
