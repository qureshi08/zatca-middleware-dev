import { NextRequest, NextResponse } from 'next/server';
import { getActiveOrg } from '@/lib/org';
import { generateInvoiceAction } from '@/lib/zatca/actions';

/**
 * POST /api/playground
 * Session-authenticated in-app "Try it" runner for the API docs page. Runs the
 * SAME pipeline as /api/v1/zatca/invoices/submit and returns the identical
 * response shape — but authenticated by the logged-in session (not an API key)
 * so users can test from the UI without handling a key. Does NOT persist to the
 * invoices ledger (it's a dry run) — real submissions via the v1 endpoint do.
 */
export async function POST(req: NextRequest) {
    const org = await getActiveOrg();
    if (!org) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Request body is not valid JSON' }, { status: 400 }); }

    const isStandard = body.type === 'standard';
    if (!body.type || !body.invoiceId || !body.items?.length || (isStandard && !body.buyer)) {
        return NextResponse.json({ success: false, error: `Missing required fields: type, invoiceId, items${isStandard ? ', buyer' : ''}` }, { status: 400 });
    }

    const result = await generateInvoiceAction(body, org.id);
    if (!result.success) {
        return NextResponse.json({ success: false, error: result.error, validationMessages: (result as any).validationMessages || [] }, { status: 422 });
    }
    const d = result.data!;
    return NextResponse.json({
        success: true,
        invoiceId: d.id,
        uuid: d.uuid,
        zatcaStatus: d.status,
        validationMessages: d.validationMessages ?? [],
        qrCode: d.qrCode,
        invoiceHash: d.hash,
        signedXml: Buffer.from(d.xml).toString('base64'),
        timestamp: new Date().toISOString(),
    });
}

export const runtime = 'nodejs';
export const maxDuration = 60;
