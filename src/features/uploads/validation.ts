import { z } from 'zod';
export const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg','image/png','image/webp','image/heic']);
export const uploadLimits = { maxFiles: 12, maxBytes: 10 * 1024 * 1024, minDimension: 300, maxDimension: 12000 } as const;
export function validateBatch(files: Pick<File,'type'|'size'|'name'>[], limits = uploadLimits) {
  if (!files.length) throw new Error('Select at least one image');
  if (files.length > limits.maxFiles) throw new Error(`A batch may contain at most ${limits.maxFiles} images`);
  return files.map(file => {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error(`${file.name}: unsupported image type`);
    if (file.size > limits.maxBytes) throw new Error(`${file.name}: exceeds ${Math.round(limits.maxBytes/1048576)} MB`);
    return file;
  });
}
export const dimensionsSchema = z.object({ width:z.number().int().min(uploadLimits.minDimension).max(uploadLimits.maxDimension), height:z.number().int().min(uploadLimits.minDimension).max(uploadLimits.maxDimension) });
