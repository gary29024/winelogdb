import { describe, expect, it } from 'vitest';
import { wineInputSchema } from '../../src/lib/db/schema';
import { createObjectKey } from '../../src/lib/r2/keys';
import { parseRecognition } from '../../src/features/recognition/schema';
import { validateBatch } from '../../src/features/uploads/validation';
import { shouldRetryRecognitionFailure } from '../../src/lib/recognition/retryPolicy';

describe('metadata validation', () => {
  it('rejects impossible wine data', () => {
    expect(
      wineInputSchema.safeParse({ producer: '', wineName: 'X', vintage: 20 }).success,
    ).toBe(false);
  });

  it('accepts normalized metadata', () => {
    expect(
      wineInputSchema.safeParse({
        producer: 'P',
        wineName: 'W',
        grapes: [],
        tags: [],
        tastingNotes: '',
        recognitionStatus: 'pending',
      }).success,
    ).toBe(true);
  });

  it('accepts modern vintages without relying on the runtime clock', () => {
    const parsed = wineInputSchema.parse({
      producer: 'P',
      wineName: 'W',
      vintage: 2021,
      grapes: [],
      tags: [],
      tastingNotes: '',
    });
    expect(parsed.vintage).toBe(2021);
  });

  it('removes a repeated producer prefix from wine name', () => {
    const parsed = wineInputSchema.parse({
      producer: 'Domaine Armand Rousseau',
      wineName: 'Domaine Armand Rousseau Gevrey-Chambertin',
      grapes: [],
      tags: [],
      tastingNotes: '',
    });
    expect(parsed.wineName).toBe('Gevrey-Chambertin');
  });
});

describe('R2 keys', () => {
  it('is scoped, safe and collision resistant', () => {
    const a = createObjectKey('u/1', 'image/jpeg', new Date('2026-01-02'), 'a');
    const b = createObjectKey('u/1', 'image/jpeg', new Date('2026-01-02'), 'b');
    expect(a).toBe('owners/u_1/2026-01-02/a.jpg');
    expect(a).not.toBe(b);
  });
});

describe('Gemini parsing', () => {
  it('validates structured JSON', () => {
    expect(
      parseRecognition('```json\n{"producer":"A","grapes":[],"confidence":0.8}\n```').confidence,
    ).toBe(0.8);
  });

  it('rejects extra untrusted fields', () => {
    expect(() =>
      parseRecognition('{"grapes":[],"confidence":1,"admin":true}'),
    ).toThrow();
  });
});

describe('recognition retry policy', () => {
  it('never duplicates a request after the hard timeout', () => {
    expect(shouldRetryRecognitionFailure({status:null,timedOut:true,networkError:true})).toBe(false);
  });

  it('allows one retry for explicit transient upstream failures', () => {
    expect(shouldRetryRecognitionFailure({status:503,timedOut:false,networkError:false})).toBe(true);
    expect(shouldRetryRecognitionFailure({status:429,timedOut:false,networkError:false})).toBe(true);
    expect(shouldRetryRecognitionFailure({status:400,timedOut:false,networkError:false})).toBe(false);
  });
});

describe('uploads', () => {
  it('enforces batch and type limits', () => {
    expect(() => validateBatch([])).toThrow();
    expect(() =>
      validateBatch([{ name: 'x.exe', type: 'x', size: 1 }] as File[]),
    ).toThrow();
    expect(() =>
      validateBatch(
        Array(13).fill({ name: 'x.jpg', type: 'image/jpeg', size: 1 }) as File[],
      ),
    ).toThrow();
  });
});