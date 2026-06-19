import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth-service';
import { supabaseAdmin } from '@/lib/supabase';
import { generateInvoicePDF } from '@/lib/zatca/pdf/generator';

/**
 * PDF GENERATOR API (Z3C Middleware)
 * 
 * GET - Download a high-fidelity ZATCA-compliant PDF for a cleared invoice
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

    try {
        // 1. Fetch the invoice record
        const query = supabaseAdmin.from('invoices').select('*').eq('organization_id', org.id);
        if (isUUID) {
            query.eq('id', idOrNumber);
        } else {
            query.eq('invoice_number', idOrNumber);
        }
        const { data: invoice, error } = await query.maybeSingle();

        if (error || !invoice) return NextResponse.json({ error: 'Invoice not found or unauthorized' }, { status: 404 });

        // 2. CHECK COMPLIANCE RULE BR-18: PDF must be generated only after clearance
        if (invoice.status !== 'cleared') {
            return NextResponse.json({
                error: 'Compliance Violation (BR-18): PDF cannot be generated for un-cleared or draft invoices. Obtain ZATCA clearance first.',
                status: invoice.status
            }, { status: 400 });
        }

        // 3. GENERATE THE PDF BUFFER
        const pdfBuffer = await generateInvoicePDF({
            invoice,
            qrCode: invoice.qr_code,
            hash: invoice.invoice_hash
        });

        // 4. Return as a stream/file response
        const response = new NextResponse(pdfBuffer as any);

        response.headers.set('Content-Type', 'application/pdf');
        response.headers.set(
            'Content-Disposition',
            `attachment; filename="Invoice_${invoice.invoice_number}_ZATCA.pdf"`
        );

        return response;

    } catch (e: any) {
        console.error('[PDF-GEN-ERROR]:', e);
        return NextResponse.json({ error: 'Failed to generate PDF document', details: e.message }, { status: 500 });
    }
}
