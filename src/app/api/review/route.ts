import { getViewer } from '@/server/auth';
import { nextReview } from '@/server/reviews';
import { kickQueue } from '@/server/queue';

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  kickQueue();
  return Response.json(await nextReview(viewer.email));
}
