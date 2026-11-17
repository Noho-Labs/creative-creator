import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { campaigns } from '@/db/schema';
import { isUuid } from '@/lib/uuid';
import { saveCampaignAsset } from '@/server/files';
import { isUploadError, readImageUpload } from '@/server/uploads';

type Params = { params: Promise<{ campaignId: string }> };

const KINDS = ['icon', 'logo'] as const;
type Kind = (typeof KINDS)[number];

export async function POST(request: Request, { params }: Params) {
  const db = getDb();
  const { campaignId } = await params;
  if (!isUuid(campaignId)) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
  const campaign = await db.query.campaigns.findFirst({ where: eq(campaigns.id, campaignId) });
  if (!campaign) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return Response.json({ error: 'multipart form data required' }, { status: 400 });
  }
  const kind = form.get('kind');
  if (typeof kind !== 'string' || !KINDS.includes(kind as Kind)) {
    return Response.json({ error: 'kind must be icon or logo' }, { status: 400 });
  }
  const upload = await readImageUpload(form);
  if (isUploadError(upload)) {
    return Response.json({ error: upload.error }, { status: 400 });
  }

  const rel = await saveCampaignAsset(campaignId, kind as Kind, upload.ext, upload.data);
  const column = kind === 'icon' ? { appIconPath: rel } : { logoPath: rel };
  await db.update(campaigns).set(column).where(eq(campaigns.id, campaignId));
  return Response.json({ ok: true, kind, path: rel });
}
