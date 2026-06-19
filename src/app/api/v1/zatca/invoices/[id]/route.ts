import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth-service';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * INVOICE INSPECTOR API
 * 
 * GET - Retrieve detailed status, XML, and QR for a specific invoice
 * DELETE - Remove a DRAFT invoice (Allowed only if Status = Draft)
 */

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });

    const org = await AuthService.validateAPIKey(apiKey) as any;
    if (!org) return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 });

    const idOrNumber = id.trim();
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrNumber);

    console.log(`[GET-INVOICE] Resolving Identifier: ${idOrNumber} for Org: ${org.id}`);

    const query = supabaseAdmin.from('invoices').select('*').eq('organization_id', org.id);
    if (isUUID) {
        query.eq('id', idOrNumber);
    } else {
        query.eq('invoice_number', idOrNumber);
    }
    const { data: invoice, error } = await query.maybeSingle();

    if (error) {
        console.error(`[DB-QUERY-ERROR]:`, error.message);
        return NextResponse.json({ error: 'Database query failure', details: error.message }, { status: 500 });
    }

    if (!invoice) {
        console.warn(`[NOT-FOUND] Invoice ${id} does not exist for this org.`);
        return NextResponse.json({ error: 'Invoice not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({
        success: true,
        invoice: {
            id: invoice.id,
            invoiceNumber: invoice.invoice_number,
            type: invoice.invoice_type,
            status: invoice.status,
            createdAt: invoice.created_at,
            updatedAt: invoice.updated_at,
            zatcaStatus: invoice.zatca_response?.status,
            qrCode: invoice.qr_code,
            hash: invoice.invoice_hash,
            signedXml: invoice.signed_xml ? Buffer.from(invoice.signed_xml).toString('base64') : null,
            validationMessages: invoice.zatca_response?.validationMessages || []
        }
    });
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });

    const org = await AuthService.validateAPIKey(apiKey) as any;
    if (!org) return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 });

    // 1. Fetch current status
    const { data: invoice } = await supabaseAdmin
        .from('invoices')
        .select('status')
        .eq('id', id)
        .eq('organization_id', org.id)
        .single();

    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    // 2. ONLY DRAFTS CAN BE DELETED (BR-06)
    if (invoice.status !== 'draft') {
        return NextResponse.json({
            error: 'Forbidden: Only DRAFT invoices can be deleted. Cleared or Rejected transactions must be retained for audit (KSA-BT-1).'
        }, { status: 403 });
    }

    const { error } = await supabaseAdmin
        .from('invoices')
        .delete()
        .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: 'Draft invoice deleted' });
}
