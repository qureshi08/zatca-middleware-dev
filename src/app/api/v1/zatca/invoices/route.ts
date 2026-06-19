import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth-service';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * MASTER INVOICES API (Z3C Middleware)
 * 
 * GET  - List all invoices (Drafts, Pending, Cleared, Rejected)
 * POST - Create a new DRAFT invoice (No ZATCA contact yet)
 */

export async function GET(req: NextRequest) {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });

    const org = await AuthService.validateAPIKey(apiKey) as any;
    if (!org) return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 });

    const { data: invoices, error } = await supabaseAdmin
        .from('invoices')
        .select('*')
        .eq('organization_id', org.id)
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, invoices });
}

export async function POST(req: NextRequest) {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });

    const org = await AuthService.validateAPIKey(apiKey) as any;
    if (!org) return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 });

    try {
        const body = await req.json();

        // 1. Validate mandatory fields (middleware level)
        if (!body.invoiceId || !body.type || !body.items?.length) {
            return NextResponse.json({ error: 'Missing required fields: invoiceId, type, items' }, { status: 400 });
        }

        // 2. Persist as DRAFT
        const { data: invoice, error } = await supabaseAdmin
            .from('invoices')
            .insert({
                organization_id: org.id,
                invoice_number: body.invoiceId,
                invoice_type: body.type,
                document_type: body.documentType || '388',
                payload: body,
                status: 'draft'
            })
            .select()
            .single();

        if (error) {
            console.error(`[DRAFT-ERROR] Failed for Org ${org.id}:`, error.message);
            if (error.code === '23505') return NextResponse.json({ error: 'Invoice number already exists' }, { status: 409 });
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log(`[DRAFT-CREATED] ID: ${invoice.id} for Org: ${org.id}`);

        return NextResponse.json({
            success: true,
            id: invoice.id,
            status: 'draft',
            createdAt: invoice.created_at,
            message: 'Invoice draft created successfully. Use /invoices/{id}/submit to go live.'
        }, { status: 201 });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
