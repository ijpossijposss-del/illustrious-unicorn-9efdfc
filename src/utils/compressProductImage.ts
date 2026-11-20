const MAX_SOURCE_FILE_SIZE = 20 * 1024 * 1024;
const MAX_IMAGE_BYTES = 100 * 1024;
const MAX_DIMENSION = 640;

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('The selected image could not be read.'));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error('The selected image could not be read.'));
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('The selected image could not be compressed.'));
        return;
      }
      resolve(blob);
    }, 'image/jpeg', quality);
  });
}

export async function compressProductImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a valid image file.');
  if (file.size > MAX_SOURCE_FILE_SIZE) throw new Error('Choose an image smaller than 20 MB.');

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    const imageLoaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('The selected image could not be opened.'));
    });
    image.src = imageUrl;
    await imageLoaded;

    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    let width = Math.max(1, Math.round(image.naturalWidth * scale));
    let height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is unavailable in this browser.');

    let quality = 0.78;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      canvas.width = width;
      canvas.height = height;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      const blob = await canvasToBlob(canvas, quality);
      if (blob.size <= MAX_IMAGE_BYTES) return readAsDataUrl(blob);

      if (attempt % 2 === 1 && Math.max(width, height) > 240) {
        width = Math.max(1, Math.round(width * 0.82));
        height = Math.max(1, Math.round(height * 0.82));
      } else {
        quality = Math.max(0.35, quality - 0.08);
      }
    }

    throw new Error('This image could not be compressed enough for the free database plan. Choose a smaller image.');
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}
