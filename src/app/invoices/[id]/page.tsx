'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { generateInvoicePDF } from '@/lib/pdf-generator';
import { reportInvoiceAction } from '@/lib/zatca/actions';
import { useApp } from '@/context/AppContext';

export default function InvoiceDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const { activeBank } = useApp();
    const sellerName = activeBank?.name || 'Issuing Bank';
    const [invoice, setInvoice] = useState<any>(null);
    const [exporting, setExporting] = useState(false);
    const [reporting, setReporting] = useState(false);
    const [activeTab, setActiveTab] = useState<'DOCUMENT' | 'XML' | 'AUDIT'>('DOCUMENT');

    useEffect(() => {
        const invoices = JSON.parse(localStorage.getItem('invoices') || '[]');
        const found = invoices.find((inv: any) => inv.uuid === resolvedParams.id);
        setInvoice(found);
    }, [resolvedParams.id]);

    const handleReport = async () => {
        if (!invoice || reporting) return;
        setReporting(true);
        try {
            const type = invoice.type || 'standard';
            const res = await reportInvoiceAction(
                invoice.xml,
                type,
                invoice.id,
                invoice.uuid,
                'BOJ-ORG-1001'
            );

            if (res.success) {
                // Pull ALL fields from result — including validation messages
                const result = res.data!; // data is always populated when success=true
                const updatedInvoice = {
                    ...invoice,
                    zatcaStatus: result?.status,
                    clearedXml: result?.clearedXml,
                    validationMessages: result?.validationMessages || [],
                    zatcaError: null,
                    zatcaRejected: false,
                };

                const invoices = JSON.parse(localStorage.getItem('invoices') || '[]');
                const idx = invoices.findIndex((inv: any) => inv.uuid === invoice.uuid);
                if (idx !== -1) {
                    invoices[idx] = updatedInvoice;
                    localStorage.setItem('invoices', JSON.stringify(invoices));
                }
                setInvoice(updatedInvoice);

                const msgs = result?.validationMessages || [];
                const warningNote = msgs.length > 0
                    ? `\n⚠️ ${msgs.length} validation message(s) returned. See sidebar.`
                    : '';
                alert(`✅ ZATCA ${result?.status}\n${warningNote}`);
            } else {
                // Persist the rejection + messages so they're visible in UI
                const updatedInvoice = {
                    ...invoice,
                    zatcaStatus: 'REJECTED',
                    zatcaError: res.error,
                    zatcaRejected: true,
                    validationMessages: res.details || [],
                };
                const invoices = JSON.parse(localStorage.getItem('invoices') || '[]');
                const idx = invoices.findIndex((inv: any) => inv.uuid === invoice.uuid);
                if (idx !== -1) {
                    invoices[idx] = updatedInvoice;
                    localStorage.setItem('invoices', JSON.stringify(invoices));
                }
                setInvoice(updatedInvoice);
                alert(`❌ ZATCA REJECTED\n${res.error}\n\nSee the sidebar for validation details.`);
            }
        } catch (e: any) {
            alert('Transmission Error: ' + e.message);
        } finally {
            setReporting(false);
        }
    };

    const handleExportPDF = async () => {
        if (!invoice) return;
        setExporting(true);
        // Ensure UI is stable before capture
        await new Promise(r => setTimeout(r, 200));
        try {
            await generateInvoicePDF('doc-frame', `BOJ-TAX-INV-${invoice.id}.pdf`);
        } finally {
            setExporting(false);
        }
    };

    if (!invoice) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: '20px', height: '20px', border: '2px solid #EEE', borderTopColor: 'var(--boj-navy)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div></div>;

    const currentXml = invoice.clearedXml || invoice.xml;
    const isCleared = ['CLEARED', 'REPORTED', 'WARNING'].includes(invoice.zatcaStatus);

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-page)', paddingBottom: '3rem' }}>
            {/* Context Navigation */}
            <nav className="no-print" style={{ background: 'var(--bg-topbar)', borderBottom: '1px solid var(--border)', height: '56px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 40 }}>
                <div className="container" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Link href="/invoices" className="btn-secondary btn-sm">← Registry</Link>
                        <code style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: '"JetBrains Mono", monospace' }}>{invoice.uuid.substring(0, 20)}…</code>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {!isCleared && (
                            <button onClick={handleReport} disabled={reporting} className="btn-primary btn-sm">
                                {reporting ? 'Transmitting…' : 'Submit for Clearance'}
                            </button>
                        )}
                        <button onClick={() => window.print()} className="btn-secondary btn-sm">Print</button>
                        <button onClick={handleExportPDF} disabled={exporting} className="btn-secondary btn-sm">
                            {exporting ? 'Generating…' : 'Download PDF'}
                        </button>
                    </div>
                </div>
            </nav>

            <main className="container" style={{ padding: '2rem 0' }}>

                {/* Technical Inspector Tabs */}
                <div className="no-print" style={{ marginBottom: '20px', display: 'flex', gap: '0', borderBottom: '1px solid var(--border)', background: 'var(--bg-alt)', borderRadius: '8px 8px 0 0', padding: '0 16px' }}>
                    {(['DOCUMENT', 'XML', 'AUDIT'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setActiveTab(t)}
                            style={{
                                padding: '12px 16px',
                                fontSize: '12px', fontWeight: 500,
                                border: 'none', background: 'transparent',
                                cursor: 'pointer', fontFamily: 'inherit',
                                color: activeTab === t ? 'var(--primary)' : 'var(--text-tertiary)',
                                borderBottom: activeTab === t ? '2px solid var(--primary)' : '2px solid transparent',
                                marginBottom: '-1px',
                            }}
                        >
                            {t}{t === 'XML' && invoice.clearedXml ? ' (Cleared)' : ''}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'DOCUMENT' ? '1fr' : 'minmax(0, 1fr) 280px', gap: '2rem', alignItems: 'start' }}>

                    <div style={{ margin: activeTab === 'DOCUMENT' ? '0 auto' : '0' }}>
                        {activeTab === 'DOCUMENT' && (
                            <div className="card" style={{ background: 'white', borderRadius: '0', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                                <div id="doc-frame" style={{ width: '210mm', minHeight: '297mm', background: 'white', margin: '0 auto' }}>
                                    <div style={{ padding: '40mm 20mm 20mm 20mm', position: 'relative' }}>

                                        {/* ZATCA STATUS STAMP (Visual Only) */}
                                        {isCleared && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '30mm',
                                                right: '20mm',
                                                border: '2px double #007A33',
                                                color: '#007A33',
                                                padding: '4px 12px',
                                                fontSize: '10px',
                                                fontWeight: '900',
                                                transform: 'rotate(-2deg)',
                                                background: 'rgba(0,122,51,0.05)'
                                            }}>
                                                ZATCA {invoice.zatcaStatus}
                                            </div>
                                        )}

                                        {/* Document Header */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem' }}>
                                            <div>
                                                <div style={{ background: 'var(--boj-navy)', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                                                    <span style={{ color: 'white', fontWeight: '900', fontSize: '22px' }}>B</span>
                                                </div>
                                                <h1 style={{ fontSize: '1.4rem', color: 'var(--boj-navy)', marginBottom: '0.2rem' }}>{sellerName}</h1>
                                                <p style={{ fontSize: '10px', color: '#64748B' }}>Corporate Finance & Settlement</p>
                                                <p style={{ fontSize: '10px', fontWeight: '800', marginTop: '0.5rem' }}>VAT: {activeBank?.vat_number || '—'}</p>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <h2 style={{ fontSize: '1.8rem', fontWeight: '900', color: 'var(--boj-navy)', marginBottom: '0.5rem' }}>
                                                    {currentXml?.includes('InvoiceTypeCode>381') ? 'Credit Note' :
                                                        currentXml?.includes('InvoiceTypeCode>383') ? 'Debit Note' :
                                                            'Tax Invoice'}
                                                </h2>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '0.5rem 1rem', fontSize: '11px', textAlign: 'left', marginLeft: 'auto', width: 'max-content' }}>
                                                    <span style={{ fontWeight: '700', color: '#64748B' }}>Invoice ID:</span>
                                                    <span style={{ fontWeight: '800' }}>#{invoice.id}</span>
                                                    <span style={{ fontWeight: '700', color: '#64748B' }}>Date:</span>
                                                    <span>{invoice.date || invoice.issueDate}</span>
                                                    <span style={{ fontWeight: '700', color: '#64748B' }}>Time:</span>
                                                    <span>{invoice.time || '10:00:00'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Correction Reference (BR-08) */
                                            (currentXml?.includes('InvoiceTypeCode>381') || currentXml?.includes('InvoiceTypeCode>383')) && (
                                                <div style={{ padding: '14px 18px', background: 'var(--status-warning-bg)', border: '1px solid var(--status-warning-bd)', borderRadius: '6px', marginBottom: '28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--status-warning)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>Billing Reference — Original Invoice</div>
                                                        <code style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: '"JetBrains Mono", monospace' }}>
                                                            {invoice.originalInvoiceId || currentXml?.match(/<cac:BillingReference>\s*<cac:InvoiceDocumentReference>\s*<cbc:ID>([^<]+)/)?.[1] || <span style={{ color: 'var(--status-error)', fontStyle: 'italic' }}>Not recorded</span>}
                                                        </code>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--status-warning)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>Reason for Adjustment</div>
                                                        <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                                                            {invoice.creditReason || currentXml?.match(/<cbc:InstructionNote>([^<]+)/)?.[1] || <em style={{ color: 'var(--text-tertiary)' }}>Not provided</em>}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                        {/* Parties */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', padding: '1.5rem 0', borderTop: '2px solid var(--border)', borderBottom: '2px solid var(--border)', marginBottom: '3rem' }}>
                                            <div>
                                                <h4 style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '0.75rem', letterSpacing: '0.5px', fontWeight: 600 }}>Seller</h4>
                                                <p style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-primary)' }}>{sellerName}</p>
                                                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Registered Address</p>
                                                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Saudi Arabia</p>
                                            </div>
                                            <div>
                                                <h4 style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '0.75rem', letterSpacing: '0.5px', fontWeight: 600 }}>Buyer</h4>
                                                <p style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-primary)' }}>{invoice.buyer}</p>
                                                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Registered Taxpayer Unit</p>
                                                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Verified Address Registry</p>
                                            </div>
                                        </div>

                                        {/* Line Items */}
                                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '3rem' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--bg-table-th)', borderBottom: '2px solid var(--primary)' }}>
                                                    <th style={{ textAlign: 'left', padding: '1rem', fontSize: '10px', fontWeight: '900' }}>DESCRIPTION of GOODS / SERVICES</th>
                                                    <th style={{ textAlign: 'center', padding: '1rem', fontSize: '10px', fontWeight: '900', width: '60px' }}>QTY</th>
                                                    <th style={{ textAlign: 'right', padding: '1rem', fontSize: '10px', fontWeight: '900', width: '100px' }}>UNIT PRICE</th>
                                                    <th style={{ textAlign: 'right', padding: '1rem', fontSize: '10px', fontWeight: '900', width: '140px' }}>SUBTOTAL (INC. VAT)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {invoice.items.map((item: any, i: number) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                                        <td style={{ padding: '1.25rem 1rem', fontSize: '12px', fontWeight: '600' }}>{item.name}</td>
                                                        <td style={{ textAlign: 'center', padding: '1.25rem 1rem', fontSize: '12px' }}>{item.quantity}</td>
                                                        <td style={{ textAlign: 'right', padding: '1.25rem 1rem', fontSize: '12px' }}>{item.unitPrice.toFixed(2)}</td>
                                                        <td style={{ textAlign: 'right', padding: '1.25rem 1rem', fontSize: '12px', fontWeight: '800' }}>{((item.unitPrice * item.quantity) * 1.15).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {/* Summary */}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6rem' }}>
                                            <div style={{ width: '280px', background: '#F8FAFC', padding: '1.5rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '11px', color: '#64748B' }}>
                                                    <span>Total (Exc. VAT)</span>
                                                    <span style={{ fontWeight: '700' }}>{invoice.subtotal.toFixed(2)} SAR</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '11px', color: '#64748B' }}>
                                                    <span>VAT Amount (15%)</span>
                                                    <span style={{ fontWeight: '700' }}>{invoice.vatAmount.toFixed(2)} SAR</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '2px solid var(--primary)' }}>
                                                    <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--primary)' }}>Total Payable</span>
                                                    <span style={{ fontWeight: '800', fontSize: '18px', color: 'var(--primary)', fontFamily: '"JetBrains Mono", monospace' }}>{invoice.total.toFixed(2)} <small style={{ fontSize: '10px', fontWeight: 400 }}>SAR</small></span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Cryptographic Proof */}
                                        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '2rem', display: 'flex', gap: '3rem' }}>
                                            <div style={{ flex: 1 }}>
                                                <h4 style={{ fontSize: '10px', fontWeight: 600, color: 'var(--primary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Electronic Signature Information</h4>
                                                <div style={{ padding: '10px', background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '10px' }}>
                                                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>SHA-256 Document Hash</label>
                                                    <code style={{ fontSize: '10px', wordBreak: 'break-all', color: 'var(--text-primary)', fontFamily: '"JetBrains Mono", monospace' }}>{invoice.hash}</code>
                                                </div>
                                                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                                                    This document is a certified tax instrument. The embedded hash and QR code verify its authenticity and compliance with ZATCA Phase 2 standards.
                                                </p>
                                            </div>
                                            <div style={{ textAlign: 'center', width: '120px' }}>
                                                <img src={invoice.qrCode} alt="ZATCA QR" style={{ width: '100px', height: '100px', border: '1px solid var(--border)', padding: '4px' }} />
                                                <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--status-success)', marginTop: '6px' }}>ZATCA Stamp</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'XML' && (
                            <div className="card" style={{ overflow: 'hidden' }}>
                                <div className="card-header">
                                    <span className="card-header-label">
                                        {invoice.clearedXml ? 'ZATCA Cleared XML — Official' : 'Local Signed XML — XAdES-EPES'}
                                    </span>
                                    <button
                                        onClick={() => {
                                            const blob = new Blob([currentXml], { type: 'application/xml' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url; a.download = `BOJ-INV-${invoice.id}${invoice.clearedXml ? '-cleared' : ''}.xml`; a.click();
                                        }}
                                        className="btn-secondary btn-sm"
                                    >
                                        ↓ Download XML
                                    </button>
                                </div>
                                <pre className="log-block" style={{ borderRadius: 0, border: 'none', maxHeight: '75vh', overflowY: 'auto', padding: '20px' }}>
                                    {currentXml}
                                </pre>
                            </div>
                        )}

                        {activeTab === 'AUDIT' && (
                            <div className="card">
                                <div className="card-header">
                                    <span className="card-header-label">Technical Audit Record</span>
                                    <span className="code-ref">Forensic</span>
                                </div>
                                <table className="data-table">
                                    <tbody>
                                        {[
                                            { label: 'Document UUID', value: invoice.uuid, mono: true },
                                            { label: 'ZATCA Status', value: invoice.zatcaStatus || 'PENDING', mono: false, isStatus: true },
                                            { label: 'Document Type', value: invoice.documentType === '381' ? 'Credit Note (381)' : invoice.documentType === '383' ? 'Debit Note (383)' : 'Tax Invoice (388)', mono: false },
                                            ...(invoice.originalInvoiceId ? [{ label: 'Original Invoice Ref', value: invoice.originalInvoiceId, mono: true }] : []),
                                            ...(invoice.creditReason ? [{ label: 'Adjustment Reason', value: invoice.creditReason, mono: false }] : []),
                                            { label: 'Rejection Details', value: invoice.zatcaError || '—', mono: false },
                                            { label: 'Environment', value: 'ZATCA Sandbox v2.1', mono: true },
                                            { label: 'Signature Algorithm', value: 'ECDSA secp256k1 · XAdES-EPES', mono: true },
                                            { label: 'Created At', value: invoice.createdAt, mono: true },
                                        ].map(item => (
                                            <tr key={item.label}>
                                                <td style={{ width: '200px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '12px' }}>{item.label}</td>
                                                <td style={{
                                                    fontFamily: (item as any).mono ? '"JetBrains Mono", monospace' : 'inherit',
                                                    fontSize: '12px', wordBreak: 'break-all',
                                                    color: (item as any).isStatus
                                                        ? invoice.zatcaStatus === 'REJECTED' ? 'var(--status-error)'
                                                            : invoice.zatcaStatus === 'WARNING' ? 'var(--status-warning)'
                                                                : isCleared ? 'var(--status-success)'
                                                                    : 'var(--text-tertiary)'
                                                        : 'var(--text-primary)'
                                                }}>{item.value}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {activeTab !== 'DOCUMENT' && (
                        <aside className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                            {/* ZATCA Status */}
                            <div className="card" style={{
                                borderLeftWidth: 3, borderLeftStyle: 'solid',
                                borderLeftColor: invoice.zatcaStatus === 'REJECTED' ? 'var(--status-error)'
                                    : invoice.zatcaStatus === 'WARNING' ? 'var(--status-warning)'
                                        : isCleared ? 'var(--status-success)'
                                            : 'var(--border-dark)'
                            }}>
                                <div className="card-header">
                                    <span className="card-header-label">ZATCA Status</span>
                                    <span className={`pill ${invoice.zatcaStatus === 'REJECTED' ? 'pill-error'
                                        : invoice.zatcaStatus === 'WARNING' ? 'pill-warning'
                                            : isCleared ? 'pill-success' : 'pill-neutral'
                                        }`}>{invoice.zatcaStatus || 'PENDING'}</span>
                                </div>
                                <div style={{ padding: '14px 16px' }}>
                                    {invoice.zatcaError && (
                                        <div style={{ padding: '10px', background: 'var(--status-error-bg)', border: '1px solid var(--status-error-bd)', borderRadius: '4px', marginBottom: '10px', fontSize: '12px', color: 'var(--status-error)', lineHeight: 1.5 }}>
                                            {invoice.zatcaError}
                                        </div>
                                    )}
                                    <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: isCleared ? 0 : '12px' }}>
                                        {invoice.zatcaStatus === 'REJECTED'
                                            ? 'ZATCA rejected this document. Review validation messages below.'
                                            : invoice.zatcaStatus === 'WARNING'
                                                ? 'Accepted with warnings. Review validation messages.'
                                                : isCleared
                                                    ? 'Successfully cleared by ZATCA. Officially issued.'
                                                    : 'Draft — not yet submitted to ZATCA gateway.'}
                                    </p>
                                    {!isCleared && (
                                        <button onClick={handleReport} disabled={reporting}
                                            className="btn-primary btn-full" style={{ marginTop: '4px' }}>
                                            {reporting ? 'Transmitting…' : 'Submit for Clearance'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Validation Messages */}
                            {invoice.validationMessages && invoice.validationMessages.length > 0 && (
                                <div className="card">
                                    <div className="card-header">
                                        <span className="card-header-label" style={{ color: invoice.zatcaStatus === 'REJECTED' ? 'var(--status-error)' : 'var(--status-warning)' }}>
                                            {invoice.zatcaStatus === 'REJECTED' ? 'Rejection Details' : 'Validation Feedback'}
                                        </span>
                                        <span className={`pill ${invoice.zatcaStatus === 'REJECTED' ? 'pill-error' : 'pill-warning'}`}>
                                            {invoice.validationMessages.length}
                                        </span>
                                    </div>
                                    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {invoice.validationMessages.map((msg: any, i: number) => (
                                            <div key={i} style={{
                                                padding: '10px 12px',
                                                background: msg.status === 'ERROR' ? 'var(--status-error-bg)' : 'var(--status-warning-bg)',
                                                border: `1px solid ${msg.status === 'ERROR' ? 'var(--status-error-bd)' : 'var(--status-warning-bd)'}`,
                                                borderRadius: '4px', lineHeight: 1.5,
                                            }}>
                                                <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '3px', color: msg.status === 'ERROR' ? 'var(--status-error)' : 'var(--status-warning)' }}>
                                                    [{msg.code}] {msg.category || ''}
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{msg.message}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="card">
                                <div className="card-header"><span className="card-header-label">Document Actions</span></div>
                                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <button onClick={handleExportPDF} disabled={exporting} className="btn-primary btn-full">
                                        {exporting ? 'Generating…' : '↓ Save as PDF'}
                                    </button>
                                    <button onClick={() => window.print()} className="btn-secondary btn-full">Print</button>
                                </div>
                            </div>
                        </aside>
                    )}

                </div>
            </main>
        </div>
    );
}

