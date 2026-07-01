import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/postman
 * Returns a ready-to-import Postman collection (v2.1) for the ZATCA Middleware
 * headless API, pre-filled with the live base URL. The caller sets {{apiKey}}.
 * Public (no auth) — it's just a template, no secrets.
 */
export async function GET(req: NextRequest) {
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
    const baseUrl = `${proto}://${host}`;

    const raw = (obj: unknown) => JSON.stringify(obj, null, 2);

    const standardBody = {
        type: 'standard',
        documentType: '388',
        invoiceId: 'INV-1001',
        buyer: {
            partyIdentification: { id: '310175397400003', schemeID: 'TXID' },
            postalAddress: { streetName: 'King Fahd Road', buildingNumber: '1000', citySubdivisionName: 'Al Olaya', cityName: 'Riyadh', postalZone: '11564', country: 'SA' },
            partyTaxScheme: { companyID: '310175397400003' },
            partyLegalEntity: { registrationName: 'Al-Faisal Trading Co.' },
        },
        items: [{ name: 'Consulting services', quantity: 1, unitPrice: 1000, vatCategory: 'S', vatRate: 15 }],
    };
    const simplifiedBody = {
        type: 'simplified',
        documentType: '388',
        invoiceId: 'INV-2001',
        items: [{ name: 'Retail item', quantity: 2, unitPrice: 50, vatCategory: 'S', vatRate: 15 }],
    };
    const creditNoteBody = {
        type: 'standard',
        documentType: '381',
        invoiceId: 'CN-1001',
        originalInvoiceId: 'INV-1001',
        creditReason: 'Return of goods',
        buyer: standardBody.buyer,
        items: standardBody.items,
    };

    const jsonReq = (name: string, method: string, path: string, body?: unknown) => ({
        name,
        request: {
            method,
            header: [
                { key: 'x-api-key', value: '{{apiKey}}', type: 'text' },
                ...(body ? [{ key: 'Content-Type', value: 'application/json', type: 'text' }] : []),
            ],
            ...(body ? { body: { mode: 'raw', raw: raw(body), options: { raw: { language: 'json' } } } } : {}),
            url: { raw: `{{baseUrl}}${path}`, host: ['{{baseUrl}}'], path: path.replace(/^\//, '').split('/') },
        },
    });

    const collection = {
        info: {
            name: 'ZATCA Middleware API',
            description: 'Headless (Mode B) API for custom software. Set the `apiKey` variable to your integration key (Onboarding → Custom → Generate key). `baseUrl` is pre-filled. Submit an invoice and get back its ZATCA status, QR, and signed XML.',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        variable: [
            { key: 'baseUrl', value: baseUrl },
            { key: 'apiKey', value: 'sk_zatca_live_REPLACE_ME' },
        ],
        item: [
            jsonReq('Submit invoice — Standard (B2B, clearance)', 'POST', '/api/v1/zatca/invoices/submit', standardBody),
            jsonReq('Submit invoice — Simplified (B2C, reporting)', 'POST', '/api/v1/zatca/invoices/submit', simplifiedBody),
            jsonReq('Submit Credit Note (381)', 'POST', '/api/v1/zatca/invoices/submit', creditNoteBody),
            jsonReq('List invoices', 'GET', '/api/v1/zatca/invoices'),
            jsonReq('Summary / KPIs', 'GET', '/api/v1/zatca/summary'),
        ],
    };

    return new NextResponse(raw(collection), {
        headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': 'attachment; filename="ZATCA-Middleware.postman_collection.json"',
        },
    });
}
