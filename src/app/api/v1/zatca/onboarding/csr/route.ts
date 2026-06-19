import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth-service';
import { startOnboarding } from '@/lib/zatca/onboarding';

export async function POST(req: NextRequest) {
    const apiKey = req.headers.get('x-api-key');

    if (!apiKey) {
        return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });
    }

    // 1. Validate Bank API Key
    const organization = await AuthService.validateAPIKey(apiKey) as any;
    if (!organization) {
        return NextResponse.json({ error: 'Invalid or revoked API Key' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { otp } = body;

        if (!otp) {
            return NextResponse.json({ error: 'OTP is required to generate CSR and Compliance CSID' }, { status: 400 });
        }

        // 2. Start ZATCA Onboarding (Generates Keys, CSR, and Compliance Certificate)
        const result = await startOnboarding(otp, organization.id);

        if (!result.success) {
            return NextResponse.json(result, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            message: 'Cryptographic Identity initialized and Compliance CSID fetched.',
            data: {
                requestID: result.data?.requestID,
                binarySecurityToken: result.data?.binarySecurityToken, // Base64 CSID
                secret: result.data?.secret
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
