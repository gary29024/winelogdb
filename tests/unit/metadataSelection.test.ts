import { describe,expect,it } from 'vitest';
import { selectRecognitionMetadata } from '../../src/lib/uploads/metadataSelection';

describe('recognition photo metadata selection',()=>{
  it('takes the EXIF timestamp and GPS from different photos when needed',()=>{
    const selected=selectRecognitionMetadata([
      {capturedAt:'2026-07-01T12:00:00.000Z',latitude:null,longitude:null,source:'exif'},
      {capturedAt:null,latitude:47.05291,longitude:4.83328,source:'exif'}
    ]);
    expect(selected.capturedAt).toBe('2026-07-01T12:00:00.000Z');
    expect(selected.latitude).toBe(47.05291);
    expect(selected.longitude).toBe(4.83328);
    expect(selected.timestampSource).toBe('exif');
    expect(selected.gpsSource).toBe('exif');
  });

  it('uses the first valid GPS fix in selected-photo order',()=>{
    const selected=selectRecognitionMetadata([
      {latitude:35.0116,longitude:135.7681,source:'exif'},
      {latitude:47.05291,longitude:4.83328,source:'exif'}
    ]);
    expect(selected.latitude).toBe(35.0116);
    expect(selected.longitude).toBe(135.7681);
  });

  it('prefers an EXIF timestamp over a file fallback timestamp',()=>{
    const selected=selectRecognitionMetadata([
      {capturedAt:'2026-08-18T03:00:00.000Z',source:'file_fallback'},
      {capturedAt:'2026-07-01T12:00:00.000Z',source:'exif'}
    ]);
    expect(selected.capturedAt).toBe('2026-07-01T12:00:00.000Z');
    expect(selected.timestampSource).toBe('exif');
  });

  it('rejects invalid coordinates',()=>{
    const selected=selectRecognitionMetadata([
      {latitude:95,longitude:181,source:'exif'}
    ]);
    expect(selected.latitude).toBeNull();
    expect(selected.longitude).toBeNull();
    expect(selected.gpsSource).toBe('none');
  });
});
