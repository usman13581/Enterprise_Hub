import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * Normalize a local picker URI to a JPEG suitable for upload.
 * iPhone photos are often HEIC — browsers / PDF renderers cannot display them.
 */
export async function prepareUploadImage(uri: string): Promise<{
  uri: string;
  name: string;
  type: 'image/jpeg';
}> {
  const prepared = await manipulateAsync(
    uri,
    [{ resize: { width: 2000 } }],
    { compress: 0.85, format: SaveFormat.JPEG },
  );
  return {
    uri: prepared.uri,
    name: `photo-${Date.now()}.jpg`,
    type: 'image/jpeg',
  };
}
