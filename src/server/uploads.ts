import { EXT_BY_MIME } from '@/server/files';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

type Upload = { data: Buffer; ext: string };

export async function readImageUpload(
  form: FormData,
  field = 'file',
): Promise<Upload | { error: string }> {
  const file = form.get(field);
  if (!(file instanceof File)) return { error: `${field} is required` };
  const ext = EXT_BY_MIME[file.type];
  if (!ext) return { error: 'file must be png, jpeg, or webp' };
  if (file.size > MAX_UPLOAD_BYTES) return { error: 'file too large (max 8MB)' };
  return { data: Buffer.from(await file.arrayBuffer()), ext };
}

export function isUploadError(u: Upload | { error: string }): u is { error: string } {
  return 'error' in u;
}
