import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { env } from '@/lib/env';

const DATA_DIR = path.resolve(env.DATA_DIR);

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

export function mimeForPath(rel: string): string {
  return MIME_BY_EXT[path.extname(rel).slice(1)] ?? 'application/octet-stream';
}

async function saveFile(rel: string, data: Buffer): Promise<string> {
  const abs = path.join(DATA_DIR, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, data);
  return rel; // DB stores the path relative to DATA_DIR
}

export function saveImage(creativeId: string, png: Buffer): Promise<string> {
  return saveFile(path.join('images', `${creativeId}.png`), png);
}

export function saveCampaignAsset(
  campaignId: string,
  kind: 'icon' | 'logo',
  ext: string,
  data: Buffer,
): Promise<string> {
  return saveFile(path.join('assets', campaignId, `${kind}.${ext}`), data);
}

export function saveScreenshot(creativeId: string, ext: string, data: Buffer): Promise<string> {
  return saveFile(path.join('screenshots', `${creativeId}.${ext}`), data);
}

export function readImage(rel: string): Promise<Buffer> {
  return readFile(path.join(DATA_DIR, rel));
}
