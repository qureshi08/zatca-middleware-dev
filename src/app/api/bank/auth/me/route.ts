import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/bank/product-store';

export async function GET(req: NextRequest) {
  const sessionToken = req.headers.get('x-session-token') || '';
  const session = await getSessionUser(sessionToken);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      id: session.user.id,
      fullName: session.user.fullName,
      email: session.user.email,
      role: session.user.role,
      passwordExpiresAt: session.user.passwordExpiresAt,
    },
    organization: session.organization,
  });
}
