import { NextRequest, NextResponse } from 'next/server';
import { requireSession, transitionInvoice } from '@/lib/bank/product-store';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession(req, ['Checker', 'Admin']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.approved === false ? 'checker_return' : 'checker_accept';
  const result = await transitionInvoice(session.user, id, action, body.comment);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
