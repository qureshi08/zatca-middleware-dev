import { NextRequest, NextResponse } from 'next/server';
import { requireSession, listUsers, createUser } from '@/lib/bank/product-store';

export async function GET(req: NextRequest) {
  const session = await requireSession(req, ['Admin']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const users = await listUsers(session.organization.id);
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req, ['Admin']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!body.fullName || !body.email || !body.role || !body.password) {
    return NextResponse.json({ error: 'fullName, email, role, and password are required' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }
  if (!['Admin', 'Maker', 'Checker', 'Approver', 'Auditor'].includes(body.role)) {
    return NextResponse.json({ error: 'Role must be Admin, Maker, Checker, Approver, or Auditor' }, { status: 400 });
  }
  if (body.password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const result = await createUser(session.user, body);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
