import type { R2Bucket } from '@cloudflare/workers-types';
import { getBindings } from '@/server/bindings';

export const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

export function mimeForPath(key: string): string {
  return MIME_BY_EXT[key.split('.').pop() ?? ''] ?? 'application/octet-stream';
}

async function saveFile(key: string, data: Buffer, bucket: R2Bucket = getBindings().IMAGES): Promise<string> {
  await bucket.put(key, new Uint8Array(data), { httpMetadata: { contentType: mimeForPath(key) } });
  return key;
}

export function saveImage(creativeId: string, version: number, png: Buffer, bucket: R2Bucket): Promise<string> {
  return saveFile(`images/${creativeId}/v${version}-${crypto.randomUUID()}.png`, png, bucket);
}

export function saveCampaignAsset(campaignId: string, kind: 'icon' | 'logo', ext: string, data: Buffer): Promise<string> {
  return saveFile(`assets/${campaignId}/${kind}.${ext}`, data);
}

export function saveScreenshot(creativeId: string, ext: string, data: Buffer): Promise<string> {
  return saveFile(`screenshots/${creativeId}.${ext}`, data);
}

export async function getImage(key: string, bucket: R2Bucket = getBindings().IMAGES) {
  return bucket.get(key);
}

export async function readImage(key: string, bucket: R2Bucket = getBindings().IMAGES): Promise<Buffer> {
  const object = await getImage(key, bucket);
  if (!object) throw new Error('Image not found');
  return Buffer.from(await object.arrayBuffer());
}
