import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth-service';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/v1/zatca/transactions
 *
 * Returns the Bank's full ZATCA transaction history from Supabase.
 * Banks can use this to sync their own systems and audit their cleared invoices.
 *
 * Query Parameters:
 *   ?limit=50          (default: 50, max: 200)
 *   ?status=CLEARED    (filter by ZATCA status: CLEARED, REPORTED, failure)
 *   ?from=2024-01-01   (ISO date filter, inclusive)
 *   ?to=2024-12-31     (ISO date filter, inclusive)
 */
export async function GET(req: NextRequest) {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });

    const organization = await AuthService.validateAPIKey(apiKey) as any;
    if (!organization) return NextResponse.json({ error: 'Invalid or revoked API Key' }, { status: 401 });

    try {
        const { searchParams } = new URL(req.url);
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
        const statusFilter = searchParams.get('status');
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        let query = supabaseAdmin
            .from('transaction_logs')
            .select('id, request_type, invoice_number, invoice_hash, status, created_at, response_payload')
            .eq('organization_id', organization.id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (from) query = query.gte('created_at', from);
        if (to) query = query.lte('created_at', to + 'T23:59:59Z');

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        // Optionally filter by ZATCA status (CLEARED/REPORTED are inside response_payload)
        let filtered = data || [];
        if (statusFilter) {
            filtered = filtered.filter(t =>
                t.response_payload?.zatcaStatus === statusFilter ||
                t.status === statusFilter
            );
        }

        return NextResponse.json({
            success: true,
            organization: organization.name,
            total: filtered.length,
            transactions: filtered.map(t => ({
                id: t.id,
                invoiceId: t.invoice_number,
                invoiceHash: t.invoice_hash,
                type: t.request_type,
                zatcaStatus: t.response_payload?.zatcaStatus || t.response_payload?.data?.status || t.status,
                timestamp: t.created_at,
            }))
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
