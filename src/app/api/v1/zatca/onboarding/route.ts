import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth-service';
import { completeOnboarding } from '@/lib/zatca/onboarding';

/**
 * INSTITUTIONAL ONBOARDING GATEWAY (Z3C v11.0)
 * 
 * POST - Performs the full activation handshake using an OTP
 * from the Saudi Fatoora Portal.
 * 
 * HEADLESS MODE: Designed for Postman & Core Banking Integration.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });

    const org = await AuthService.validateAPIKey(apiKey) as any;
    if (!org) return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 });

    try {
        const body = await req.json();
        const { otp } = body;

        if (!otp || otp.length < 6) {
            return NextResponse.json({ error: 'Valid 6-digit ZATCA OTP is required' }, { status: 400 });
        }

        console.log(`[ONBOARDING-INIT] Headless Handshake for: ${org.name} (ID: ${org.id})`);

        // Execute the Master Handshake (CSR -> CCSID -> Compliance -> PCSID)
        const result = await completeOnboarding(otp, org.id);

        if (!result.success) {
            return NextResponse.json({
                error: 'Handshake Protocol Failure',
                details: result.error
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            status: 'production_received',
            message: 'EGS Unit successfully activated on ZATCA Production Network.',
            nodeRef: org.id
        });

    } catch (e: any) {
        console.error('[ONBOARDING-FATAL]:', e);
        return NextResponse.json({
            error: 'Public Gateway Error',
            details: e.message
        }, { status: 500 });
    }
}
