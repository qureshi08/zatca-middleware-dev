import { NextRequest, NextResponse } from 'next/server';
import { requireSession, addWorkflowComment } from '@/lib/bank/product-store';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (!body.comment || typeof body.comment !== 'string' || body.comment.trim().length === 0) {
    return NextResponse.json({ error: 'Comment is required' }, { status: 400 });
  }

  const result = await addWorkflowComment(session.user, id, body.comment.trim());
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
