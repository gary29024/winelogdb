import { gps, parse } from 'exifr';

export type PhotoMetadata = {
  capturedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  source: 'exif' | 'file_fallback' | 'none';
};

function toIso(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'string') { const parsed = new Date(value); if (!Number.isNaN(parsed.getTime())) return parsed.toISOString(); }
  return null;
}

export async function extractPhotoMetadata(file: File): Promise<PhotoMetadata> {
  let capturedAt: string | null = null, latitude: number | null = null, longitude: number | null = null;
  let source: PhotoMetadata['source'] = 'none';
  try {
    const exif = await parse(file,{pick:['DateTimeOriginal','CreateDate','ModifyDate']}) as Record<string,unknown>|undefined;
    capturedAt = toIso(exif?.DateTimeOriginal) ?? toIso(exif?.CreateDate) ?? toIso(exif?.ModifyDate);
    if (capturedAt) source='exif';
  } catch {}
  try {
    const point=await gps(file);
    if(point&&Number.isFinite(point.latitude)&&Number.isFinite(point.longitude)){latitude=point.latitude;longitude=point.longitude;source='exif'}
  } catch {}
  if(!capturedAt&&file.lastModified>0){capturedAt=new Date(file.lastModified).toISOString();source='file_fallback'}
  return {capturedAt,latitude,longitude,source};
}
