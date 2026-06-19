import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth-service';
import { supabaseAdmin } from '@/lib/supabase';
import { generateInvoiceAction } from '@/lib/zatca/actions';

/**
 * ZATCA SUBMISSION GATEWAY (Go Live Event)
 * 
 * POST - Transition a DRAFT invoice to the ZATCA Clearance Hub
 */

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: invoiceId } = await params;
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });

    const org = await AuthService.validateAPIKey(apiKey) as any;
    if (!org) return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 });

    const idOrNumber = invoiceId.trim();
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrNumber);

    try {
        // 1. Fetch the draft for this organization
        const query = supabaseAdmin.from('invoices').select('*').eq('organization_id', org.id);
        if (isUUID) {
            query.eq('id', idOrNumber);
        } else {
            query.eq('invoice_number', idOrNumber);
        }
        const { data: invoice, error: fetchErr } = await query.maybeSingle();

        if (fetchErr || !invoice) return NextResponse.json({ error: 'Invoice not found or unauthorized' }, { status: 404 });
        if (invoice.status === 'cleared') return NextResponse.json({ error: 'Invoice already cleared. Modification forbidden (BR-06)' }, { status: 400 });

        // 2. Mark as PENDING during processing (Prevents race conditions)
        await supabaseAdmin.from('invoices').update({ status: 'pending_clearance' }).eq('id', invoiceId);

        // 3. GENERATE, SIGN, AND SUBMIT TO ZATCA (CORE ENGINE)
        const result = await generateInvoiceAction(invoice.payload, org.id);

        // 4. Record the outcome
        const updateQuery = supabaseAdmin
            .from('invoices')
            .update({
                status: result.success ? 'cleared' : 'rejected',
                invoice_hash: result.success ? (result.data?.hash || result.data?.uuid) : null,
                signed_xml: result.success ? result.data?.xml : null,
                qr_code: result.success ? result.data?.qrCode : null,
                zatca_response: result,
                updated_at: new Date().toISOString()
            });

        if (isUUID) { updateQuery.eq('id', idOrNumber); } else { updateQuery.eq('invoice_number', idOrNumber); }
        const { error: updateErr } = await updateQuery;

        if (updateErr) console.error(`[DB-COMMIT-ERROR]:`, updateErr.message);

        // 5. SECONDARY LOG (Audit Registry)
        await supabaseAdmin.from('transaction_logs').insert({
            organization_id: org.id,
            request_type: invoice.invoice_type === 'simplified' ? 'reporting' : 'clearance',
            invoice_number: invoice.invoice_number,
            status: result.success ? 'success' : 'failure',
            response_payload: result
        });

        if (!result.success) {
            return NextResponse.json({
                success: false,
                error: result.error,
                details: result.data?.validationMessages ?? []
            }, { status: 422 });
        }

        // 6. Return Final ZATCA Artifacts to the Bank
        const data = result.data!;
        return NextResponse.json({
            success: true,
            status: 'cleared',
            zatcaStatus: data.status,
            invoiceId: data.id,
            uuid: data.uuid,
            qrCode: data.qrCode,
            invoiceHash: data.hash,
            signedXml: Buffer.from(data.xml).toString('base64'),
            timestamp: new Date().toISOString()
        });

    } catch (e: any) {
        // Rollback status if crash occurs during generation
        const query = supabaseAdmin.from('invoices').update({ status: 'draft' }).eq('status', 'pending_clearance');
        if (isUUID) { query.eq('id', idOrNumber); } else { query.eq('invoice_number', idOrNumber); }
        await query;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
