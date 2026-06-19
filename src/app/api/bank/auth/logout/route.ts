import { NextRequest, NextResponse } from 'next/server';
import { logoutSession } from '@/lib/bank/product-store';

export async function POST(req: NextRequest) {
  const sessionToken = req.headers.get('x-session-token') || '';
  if (sessionToken) {
    await logoutSession(sessionToken);
  }
  return NextResponse.json({ success: true });
}
