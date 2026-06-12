import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { env } from '@/lib/env';

const DATA_DIR = path.resolve(env.DATA_DIR);

export async function saveImage(creativeId: string, png: Buffer): Promise<string> {
  const rel = path.join('images', `${creativeId}.png`);
  const abs = path.join(DATA_DIR, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, png);
  return rel; // DB stores the path relative to DATA_DIR
}

export function readImage(rel: string): Promise<Buffer> {
  return readFile(path.join(DATA_DIR, rel));
}
