import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateCropRectangle } from '../src/services/imageEngine.ts';

test('crop rectangle rounds valid coordinates and preserves requested dimensions', () => {
  assert.deepEqual(validateCropRectangle(10.4, 20.2, 30.4, 40.3, 100, 100), {
    x: 10,
    y: 20,
    width: 30,
    height: 40,
  });
});

test('crop rectangle rejects empty, negative, and out-of-bounds regions', () => {
  assert.throws(() => validateCropRectangle(0, 0, 0, 10, 100, 100), /fit within the image/);
  assert.throws(() => validateCropRectangle(-1, 0, 10, 10, 100, 100), /fit within the image/);
  assert.throws(() => validateCropRectangle(90, 0, 11, 10, 100, 100), /fit within the image/);
});
