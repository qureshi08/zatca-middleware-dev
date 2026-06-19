import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationSettings, requireSession } from '@/lib/bank/product-store';

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const integration = await getIntegrationSettings(session.user.organizationId);
    if (!integration.middlewareApiKey) {
      return NextResponse.json({
        connected: false,
        onboarding: { step: 'not_connected', isLive: false, canSubmitInvoices: false },
      });
    }

    const response = await fetch(`${integration.middlewareBaseUrl}/api/v1/zatca/status`, {
      headers: { 'x-api-key': integration.middlewareApiKey },
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json({ connected: response.ok, ...data }, { status: response.status });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to reach middleware status endpoint' },
      { status: 502 }
    );
  }
}
