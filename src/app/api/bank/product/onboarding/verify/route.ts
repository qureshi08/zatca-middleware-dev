import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationSettings, requireSession } from '@/lib/bank/product-store';

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req, ['Admin']);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const integration = await getIntegrationSettings(session.user.organizationId);
    if (!integration.middlewareApiKey) {
      return NextResponse.json({ error: 'Configure middleware API key first' }, { status: 400 });
    }

    const response = await fetch(`${integration.middlewareBaseUrl}/api/v1/zatca/onboarding/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': integration.middlewareApiKey,
      },
      body: JSON.stringify({}),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to reach middleware verify endpoint' },
      { status: 502 }
    );
  }
}
