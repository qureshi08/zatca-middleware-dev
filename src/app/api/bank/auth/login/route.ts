import { NextRequest, NextResponse } from 'next/server';
import { authenticateAndCreateSession } from '@/lib/bank/product-store';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const result = await authenticateAndCreateSession(email, password);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  return NextResponse.json(result);
}
