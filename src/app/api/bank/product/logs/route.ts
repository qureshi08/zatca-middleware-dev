import { NextRequest, NextResponse } from 'next/server';
import { requireSession, getAuditLogs } from '@/lib/bank/product-store';

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const logs = await getAuditLogs();
  return NextResponse.json({ logs });
}
