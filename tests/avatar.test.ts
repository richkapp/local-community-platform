import { describe, expect, test } from 'bun:test';
import { calculateSquareCrop, validateAvatarFile } from '@/lib/avatar';

const mebibyte = 1024 * 1024;

function fakeFile(type: string, size: number) {
  return { type, size, name: 'avatar' } as File;
}

describe('native avatar preparation', () => {
  test('accepts supported source images at the 2 MB boundary', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(() => validateAvatarFile(fakeFile(type, 2 * mebibyte))).not.toThrow();
    }
  });

  test('rejects unsupported or oversized source images', () => {
    expect(() => validateAvatarFile(fakeFile('image/svg+xml', 1000))).toThrow('JPEG, PNG, or WebP');
    expect(() => validateAvatarFile(fakeFile('image/png', 2 * mebibyte + 1))).toThrow('2 MB or smaller');
  });

  test('centers landscape and portrait crops before resizing', () => {
    expect(calculateSquareCrop(1200, 800)).toEqual({ sourceX: 200, sourceY: 0, sourceSize: 800 });
    expect(calculateSquareCrop(800, 1200)).toEqual({ sourceX: 0, sourceY: 200, sourceSize: 800 });
    expect(calculateSquareCrop(640, 640)).toEqual({ sourceX: 0, sourceY: 0, sourceSize: 640 });
  });

  test('rejects images without usable dimensions', () => {
    expect(() => calculateSquareCrop(0, 100)).toThrow('valid dimensions');
    expect(() => calculateSquareCrop(Number.NaN, 100)).toThrow('valid dimensions');
  });

  test('rejects pathological image dimensions before drawing to canvas', () => {
    expect(() => calculateSquareCrop(12_001, 100)).toThrow('50 megapixels');
    expect(() => calculateSquareCrop(10_000, 10_000)).toThrow('50 megapixels');
  });
});
