import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth-service';
import { generateInvoiceAction } from '@/lib/zatca/actions';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
    const apiKey = req.headers.get('x-api-key');

    if (!apiKey) {
        return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });
    }

    // 1. Validate API Key
    const organization = await AuthService.validateAPIKey(apiKey) as any;
    if (!organization) {
        return NextResponse.json({ error: 'Invalid or revoked API Key' }, { status: 401 });
    }

    try {
        const body = await req.json();

        // 2. Process Invoice (Refactoring generateInvoiceAction would be ideal here)
        // For now, we will pass the orgId to the action (I will refactor the action next)
        const result = await generateInvoiceAction(body, organization.id);

        // 3. Log the transaction to Supabase
        await supabaseAdmin.from('transaction_logs').insert({
            organization_id: organization.id,
            request_type: 'invoice_signing',
            invoice_number: result.success ? result.data?.id : null,
            status: result.success ? 'success' : 'failure',
            response_payload: result
        });

        if (!result.success) {
            return NextResponse.json(result, { status: 400 });
        }

        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
