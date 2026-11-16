import { NextResponse, type NextRequest } from 'next/server';
import { getViewer } from '@/server/auth';

export async function proxy(request: NextRequest) {
  const viewer = await getViewer(request.headers);
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const path = request.nextUrl.pathname;
  const reviewerRoute = path === '/review' || path === '/api/review' || path.startsWith('/api/review/') || path.startsWith('/api/images/');
  if (!viewer.isCreator && !reviewerRoute) {
    if (path.startsWith('/api/')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.redirect(new URL('/review', request.url));
  }
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
