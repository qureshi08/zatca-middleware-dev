import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth-service';
import { runComplianceChecks } from '@/lib/zatca/onboarding';

/**
 * POST /api/v1/zatca/onboarding/verify
 *
 * Bank submits this after getting their Compliance CSID.
 * We run the 6 mandatory ZATCA compliance scenarios automatically,
 * then fetch and store the Production CSID.
 *
 * Bank Sends: { otp } (same OTP used in /csr)
 * Returns: Production CSID confirmation and onboarding status
 */
export async function POST(req: NextRequest) {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });

    const organization = await AuthService.validateAPIKey(apiKey) as any;
    if (!organization) return NextResponse.json({ error: 'Invalid or revoked API Key' }, { status: 401 });

    try {
        // Run 6 ZATCA Compliance Scenarios + Get Production CSID
        const result = await runComplianceChecks(organization.id);

        if (!result.success) {
            return NextResponse.json({
                success: false,
                error: 'One or more ZATCA compliance checks failed.',
                details: result.results
            }, { status: 422 });
        }

        return NextResponse.json({
            success: true,
            message: 'All 6 ZATCA compliance scenarios passed. Your organization is now ZATCA-certified.',
            complianceResults: result.results
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
