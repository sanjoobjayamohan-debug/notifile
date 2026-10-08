/**
 * Utility functions for real browser-based image operations using HTML5 Canvas
 */
import { removeBackgroundWithRembg } from './backgroundRemovalApi';

export interface ImageDimensions {
  width: number;
  height: number;
}

export async function getImageDimensions(file: File): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/**
 * Compress an image file by adjusting format & quality
 */
export async function compressImage(
  file: File,
  quality: number = 0.75, // 0.1 to 1.0
  targetFormat: 'image/jpeg' | 'image/webp' | 'image/png' = 'image/jpeg'
): Promise<Blob> {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  // Fill white background for JPEGs (in case of PNG transparency)
  if (targetFormat === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      },
      targetFormat,
      targetFormat === 'image/png' ? undefined : quality
    );
  });
}

/**
 * Resize an image with custom dimensions
 */
export async function resizeImage(
  file: File,
  newWidth: number,
  newHeight: number,
  outputFormat: string = 'image/jpeg'
): Promise<Blob> {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(10, Math.round(newWidth));
  canvas.height = Math.max(10, Math.round(newHeight));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context error');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const format = ['image/jpeg', 'image/png', 'image/webp'].includes(outputFormat)
    ? outputFormat
    : 'image/png';
  if (format === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Resize failed'));
    }, format, format === 'image/jpeg' || format === 'image/webp' ? 0.92 : undefined);
  });
}

export function validateCropRectangle(
  x: number,
  y: number,
  width: number,
  height: number,
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number; width: number; height: number } {
  const rect = {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
  if (
    ![rect.x, rect.y, rect.width, rect.height, imageWidth, imageHeight].every(Number.isFinite) ||
    rect.x < 0 || rect.y < 0 || rect.width < 1 || rect.height < 1 ||
    rect.x + rect.width > imageWidth || rect.y + rect.height > imageHeight
  ) {
    throw new Error(`Crop area must fit within the image (${imageWidth} × ${imageHeight}px).`);
  }
  return rect;
}

export async function cropImage(
  file: File,
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<Blob> {
  const img = await loadImage(file);
  const rect = validateCropRectangle(x, y, width, height, img.naturalWidth, img.naturalHeight);

  const canvas = document.createElement('canvas');
  canvas.width = rect.width;
  canvas.height = rect.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create an image canvas.');
  context.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  const outputType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ? file.type : 'image/png';
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Could not encode the cropped image.')),
      outputType,
      outputType === 'image/jpeg' ? 0.95 : undefined,
    );
  });
}

/**
 * Convert Image format (JPG, PNG, WebP)
 */
export async function convertImageFormat(
  file: File,
  targetFormat: 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<Blob> {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context error');

  if (targetFormat === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Conversion failed'));
    }, targetFormat, 0.95);
  });
}

/**
 * Rotate & Flip Image
 */
export async function transformImage(
  file: File,
  angleDegrees: number = 90,
  flipH: boolean = false,
  flipV: boolean = false
): Promise<Blob> {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  const rad = (angleDegrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad)) < 1e-10 ? 0 : Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad)) < 1e-10 ? 0 : Math.abs(Math.sin(rad));
  canvas.width = Math.ceil(img.naturalWidth * cos + img.naturalHeight * sin - 1e-10);
  canvas.height = Math.ceil(img.naturalWidth * sin + img.naturalHeight * cos - 1e-10);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context error');

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

  const outputType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    ? file.type
    : 'image/png';
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Transform failed'));
    }, outputType);
  });
}

/**
 * Grayscale & Enhance Filters
 */
export async function applyImageFilter(
  file: File,
  filter: 'grayscale' | 'enhance'
): Promise<Blob> {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context error');

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  if (filter === 'grayscale') {
    for (let i = 0; i < data.length; i += 4) {
      const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = avg;
      data[i + 1] = avg;
      data[i + 2] = avg;
    }
  } else if (filter === 'enhance') {
    // Increase contrast & auto level
    const contrast = 1.35; // factor
    const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
    for (let i = 0; i < data.length; i += 4) {
      data[i] = factor * (data[i] - 128) + 128;
      data[i + 1] = factor * (data[i + 1] - 128) + 128;
      data[i + 2] = factor * (data[i + 2] - 128) + 128;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Filter failed'));
    }, 'image/jpeg', 0.92);
  });
}

/**
 * Uses the locally hosted rembg model and returns a transparent PNG cutout.
 */
export async function removeImageBackground(file: File): Promise<Blob> {
  return removeBackgroundWithRembg(file);
}
