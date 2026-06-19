import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/bank/product-store';

export async function POST(req: NextRequest) {
  const session = await requireSession(req, ['Admin']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { middlewareBaseUrl, middlewareApiKey } = body;
  if (!middlewareBaseUrl || !middlewareApiKey) {
    return NextResponse.json(
      { error: 'middlewareBaseUrl and middlewareApiKey are required' },
      { status: 400 }
    );
  }

  let base = '';
  try {
    base = new URL(String(middlewareBaseUrl)).toString().replace(/\/$/, '');
  } catch {
    return NextResponse.json({ error: 'middlewareBaseUrl must be a valid URL' }, { status: 400 });
  }

  try {
    const response = await fetch(`${base}/api/v1/zatca/status`, {
      headers: { 'x-api-key': String(middlewareApiKey) },
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, status: response.status, error: data?.error || 'Middleware rejected connection' },
        { status: 200 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: response.status,
      onboarding: data?.onboarding || null,
      organization: data?.organization || null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, status: 502, error: e?.message || 'Unable to reach middleware URL' },
      { status: 200 }
    );
  }
}
