import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth-service';
import { getOnboardingStatus } from '@/lib/zatca/onboarding-storage';

/**
 * GET /api/v1/zatca/status
 *
 * Returns the current ZATCA onboarding and operational status for the Bank.
 * Banks can call this at any time to check their registration state.
 *
 * Returns:
 * {
 *   onboardingStep: "pending" | "compliance_csid_issued" | "compliance_passed" | "production_active",
 *   isLive: true | false,
 *   canSubmitInvoices: true | false
 * }
 */
export async function GET(req: NextRequest) {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });

    const organization = await AuthService.validateAPIKey(apiKey) as any;
    if (!organization) return NextResponse.json({ error: 'Invalid or revoked API Key' }, { status: 401 });

    try {
        const status = await getOnboardingStatus(organization.id);

        const stepMap: Record<string, string> = {
            'initial': 'pending',
            'csr_generated': 'csr_generated',
            'compliance_csid_issued': 'compliance_csid_issued',
            'compliance_complete': 'compliance_passed',
            'compliance_failed': 'compliance_failed',
            'production_received': 'production_active',
        };

        const friendlyStep = stepMap[status.step || 'initial'] || status.step || 'pending';
        const isLive = status.step === 'production_received' && !!status.productionCSID;
        const hasComplianceCSID = !!status.complianceCSID;

        return NextResponse.json({
            success: true,
            organization: organization.name,
            onboarding: {
                step: friendlyStep,
                isLive,
                canSubmitInvoices: isLive,
                hasComplianceCSID,
                nextStep: !hasComplianceCSID
                    ? 'Call POST /api/v1/zatca/onboarding/csr with your ZATCA OTP'
                    : status.step !== 'compliance_complete' && status.step !== 'production_received'
                        ? 'Call POST /api/v1/zatca/onboarding/verify to run compliance checks'
                        : !isLive
                            ? 'Call POST /api/v1/zatca/onboarding/production to get your Production CSID'
                            : 'Ready! Submit invoices via POST /api/v1/zatca/invoices/submit'
            }
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
