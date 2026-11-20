import { getDownloadURL, getStorage, ref, uploadString } from 'firebase/storage';
import { app } from './firebase';

const storage = getStorage(app);

export async function uploadProductImage(image: string, branchId: string, productId: string) {
  if (!image.startsWith('data:image/')) return image;
  const contentType = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/)?.[1];
  if (!contentType) throw new Error('The product image is not a valid image file.');
  const encodedImage = image.slice(image.indexOf(',') + 1);
  const imageSize = Math.ceil(encodedImage.length * 0.75);
  if (imageSize > 5 * 1024 * 1024) throw new Error('Product images must be smaller than 5 MB.');

  const imageRef = ref(storage, `product-images/${branchId}/${productId}`);
  await uploadString(imageRef, image, 'data_url', { contentType });
  return getDownloadURL(imageRef);
}
