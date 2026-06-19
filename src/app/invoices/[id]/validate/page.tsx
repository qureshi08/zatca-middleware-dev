'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { validateInvoiceAction } from '@/lib/zatca/actions';

export default function ValidationReportPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const [invoice, setInvoice] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [report, setReport] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            const invoices = JSON.parse(localStorage.getItem('invoices') || '[]');
            const found = invoices.find((inv: any) => inv.uuid === resolvedParams.id);
            setInvoice(found);

            if (found) {
                const result = await validateInvoiceAction(found.xml);
                if (result.success) {
                    setReport(result.data);
                }
            }
            setLoading(false);
        };
        fetchData();
    }, [resolvedParams.id]);

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--boj-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    if (!invoice) {
        return (
            <div style={{ padding: '4rem', textAlign: 'center' }}>
                <h2 className="boj-title">Registry Fault: Instrument Not Found</h2>
                <Link href="/invoices" className="boj-btn-secondary" style={{ marginTop: '2rem' }}>Back to Ledger</Link>
            </div>
        );
    }

    const isAllPassed = report?.overallStatus === 'PASSED';

    return (
        <div style={{ minHeight: '100vh', background: 'var(--boj-bg)', paddingBottom: '5rem' }}>
            {/* Premium Header */}
            <header className="boj-header">
                <div className="boj-container" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '42px',
                            height: '42px',
                            background: 'var(--boj-primary)',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <span style={{ color: 'white', fontSize: '20px', fontWeight: '800' }}>V</span>
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.25rem', marginBottom: '0' }}>Compliance Auditor</h1>
                            <p style={{ color: 'var(--boj-secondary)', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase' }}>ZATCA Phase 2 Protocol</p>
                        </div>
                    </div>
                    <Link href={`/invoices/${invoice.uuid}`} className="boj-btn-secondary">← Return to Instrument</Link>
                </div>
            </header>

            <main className="boj-container" style={{ paddingTop: '3rem' }}>
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>

                    {/* Verification Status Card */}
                    <div className="boj-card fade-in" style={{ padding: '3.5rem', textAlign: 'center', marginBottom: '2rem', borderTop: `6px solid ${isAllPassed ? '#10B981' : 'var(--boj-secondary)'}` }}>
                        <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }}>{isAllPassed ? '🛡️' : '🚨'}</div>
                        <h2 className="boj-title" style={{ fontSize: '2.25rem', marginBottom: '0.75rem' }}>
                            {isAllPassed ? 'Verification Certified' : 'Compliance Failure'}
                        </h2>
                        <div className="boj-badge" style={{ padding: '0.5rem 1.5rem', background: isAllPassed ? '#D1FAE5' : '#FEE2E2', color: isAllPassed ? '#065F46' : '#991B1B', borderRadius: '30px', fontWeight: '800', fontSize: '0.9rem' }}>
                            AUDIT RESULT: {isAllPassed ? 'FULLY COMPLIANT' : 'CRITICAL ERRORS FOUND'}
                        </div>
                        <p style={{ marginTop: '2rem', color: 'var(--boj-text-muted)', lineHeight: '1.6', fontSize: '1.05rem' }}>
                            Technical audit for instrument <span style={{ fontWeight: '700', color: 'var(--boj-primary)' }}>{invoice.id}</span> complete.
                            The cryptographic signatures and XML structure have been cross-referenced with ZATCA technical standards.
                        </p>
                    </div>

                    {/* Detailed Technical Audit Log */}
                    <div className="boj-card fade-in" style={{ padding: '0', overflow: 'hidden' }}>
                        <div style={{ padding: '1.5rem 2rem', background: '#F8FAFC', borderBottom: '1px solid var(--boj-border)' }}>
                            <h3 style={{ fontSize: '1rem' }}>Technical Audit Log</h3>
                        </div>
                        <div style={{ background: 'white' }}>
                            {report?.checks.map((check: any, i: number) => (
                                <div key={i} style={{
                                    padding: '2rem',
                                    borderBottom: i === report.checks.length - 1 ? 'none' : '1px solid var(--boj-border)',
                                    display: 'flex',
                                    gap: '1.5rem',
                                    transition: 'background 0.2s'
                                }} onMouseEnter={(e) => e.currentTarget.style.background = '#F9FBFF'} onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: check.status === 'PASSED' ? '#D1FAE5' : (check.status === 'FAILED' ? '#FEE2E2' : '#FEF3C7'),
                                        color: check.status === 'PASSED' ? '#059669' : (check.status === 'FAILED' ? '#DC2626' : '#D97706'),
                                        fontSize: '0.85rem',
                                        fontWeight: '800',
                                        flexShrink: 0
                                    }}>
                                        {check.status === 'PASSED' ? '✓' : (check.status === 'FAILED' ? '✗' : '!')}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                            <div style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--boj-primary)' }}>{check.name}</div>
                                            <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--boj-text-muted)', textTransform: 'uppercase' }}>{check.status}</div>
                                        </div>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--boj-text-muted)', lineHeight: '1.5' }}>{check.message}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginTop: '3rem', textAlign: 'center' }}>
                        <p style={{ color: 'var(--boj-text-muted)', fontSize: '0.8rem', marginBottom: '1.5rem', borderTop: '1px solid var(--boj-border)', paddingTop: '1.5rem' }}>
                            Note: This report is generated by our internal engine to simulate ZATCA SDK behavior.
                        </p>
                        <button onClick={() => window.print()} className="boj-btn-primary" style={{ padding: '0.8rem 3rem' }}>
                            Generate Audit Certificate
                        </button>
                    </div>

                </div>
            </main>
        </div>
    );
}
