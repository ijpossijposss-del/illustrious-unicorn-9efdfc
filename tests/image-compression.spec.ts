import { expect, test } from '@playwright/test';

test('product images are compressed for Realtime Database storage', async ({ page }) => {
  await page.goto('/');
  const image = await page.evaluate(async () => {
    const { compressProductImage } = await import('/src/utils/compressProductImage.ts');
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable.');
    const pixels = context.createImageData(canvas.width, canvas.height);
    let seed = 123456789;
    for (let index = 0; index < pixels.data.length; index += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      pixels.data[index] = seed & 255;
      pixels.data[index + 1] = (seed >>> 8) & 255;
      pixels.data[index + 2] = (seed >>> 16) & 255;
      pixels.data[index + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    const source = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Source image creation failed.')), 'image/png');
    });
    return compressProductImage(new File([source], 'product.png', { type: 'image/png' }));
  });

  expect(image).toMatch(/^data:image\/jpeg;base64,/);
  const encoded = image.slice(image.indexOf(',') + 1);
  expect(Math.ceil(encoded.length * 0.75)).toBeLessThanOrEqual(100 * 1024);
});
