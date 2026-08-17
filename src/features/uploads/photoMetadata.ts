import { gps, parse } from 'exifr';

export type PhotoMetadata = {
  capturedAt: string | null;
  latitude: number | null;
  longitude: number | null;
};

function toIso(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

export async function extractPhotoMetadata(file: File): Promise<PhotoMetadata> {
  let capturedAt: string | null = null;
  let latitude: number | null = null;
  let longitude: number | null = null;

  try {
    const exif = await parse(file, {
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'],
      translateValues: false,
    }) as Record<string, unknown> | undefined;
    capturedAt = toIso(exif?.DateTimeOriginal) ?? toIso(exif?.CreateDate) ?? toIso(exif?.ModifyDate);
  } catch {
    // Some formats or privacy-stripped images have no readable EXIF timestamp.
  }

  try {
    const point = await gps(file);
    if (point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) {
      latitude = point.latitude;
      longitude = point.longitude;
    }
  } catch {
    // GPS metadata is optional and commonly stripped by messaging/social apps.
  }

  // File.lastModified is only a fallback because it can reflect download/copy time rather than capture time.
  if (!capturedAt && file.lastModified > 0) capturedAt = new Date(file.lastModified).toISOString();

  return { capturedAt, latitude, longitude };
}
