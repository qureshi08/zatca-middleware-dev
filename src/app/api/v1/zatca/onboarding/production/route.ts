import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth-service';
import { finalizeOnboarding } from '@/lib/zatca/onboarding';

/**
 * POST /api/v1/zatca/onboarding/production
 *
 * Bank calls this after compliance verification passes.
 * We finalize the ZATCA registration and issue a Production CSID.
 * After this, the bank is fully onboarded and can submit real invoices.
 *
 * Returns: Production CSID and confirmation of live status
 */
export async function POST(req: NextRequest) {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });

    const organization = await AuthService.validateAPIKey(apiKey) as any;
    if (!organization) return NextResponse.json({ error: 'Invalid or revoked API Key' }, { status: 401 });

    try {
        const result = await finalizeOnboarding(organization.id);

        if (!result.success) {
            return NextResponse.json({
                success: false,
                error: result.error || 'Failed to obtain Production CSID. Ensure compliance verification was completed first.',
            }, { status: 422 });
        }

        return NextResponse.json({
            success: true,
            message: 'Production CSID obtained. Your organization is now live on ZATCA. You can start submitting real invoices.',
            status: 'production_active'
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
