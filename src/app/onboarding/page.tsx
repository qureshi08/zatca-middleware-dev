'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import {
    startOnboarding,
    runComplianceChecks,
    finalizeOnboarding
} from '@/lib/zatca/onboarding';
import { getOnboardingStatus, resetOnboardingStatus } from '@/lib/zatca/onboarding-storage';

export default function OnboardingPage() {
    const { activeBank, isLoading: contextLoading } = useApp();
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [otp, setOtp] = useState('123456');
    const [complianceResults, setComplianceResults] = useState<any[]>([]);

    useEffect(() => {
        if (activeBank) refreshStatus();
    }, [activeBank]);

    const refreshStatus = async () => {
        if (!activeBank) return;
        const s = await getOnboardingStatus(activeBank.id);
        setStatus(s);
    };

    const handleStart = async () => {
        if (!activeBank) return;
        setLoading(true);
        const res = await startOnboarding(otp, activeBank.id);
        if (res.success) await refreshStatus();
        else alert(res.error);
        setLoading(false);
    };

    const handleCompliance = async () => {
        if (!activeBank) return;
        setLoading(true);
        const res = await runComplianceChecks(activeBank.id);
        if (res.success && res.results) {
            setComplianceResults(res.results);
            await refreshStatus();
        } else alert(res.error);
        setLoading(false);
    };

    const handleFinalize = async () => {
        if (!activeBank) return;
        setLoading(true);
        const res = await finalizeOnboarding(activeBank.id);
        if (res.success) await refreshStatus();
        else alert(res.error);
        setLoading(false);
    };

    const handleReset = async () => {
        if (!activeBank) return;
        if (confirm('Are you sure? This will delete all certificates for this unit.')) {
            setLoading(true);
            await resetOnboardingStatus(activeBank.id);
            await refreshStatus();
            setComplianceResults([]);
            setLoading(false);
        }
    };

    if (contextLoading || !activeBank) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const currentStepNum = status?.step === 'none' ? 1 :
        status?.step === 'compliance_requested' ? 2 :
            status?.step === 'compliance_complete' ? 3 :
                status?.productionCSID ? 4 : 1;

    return (
        <div className="animate-in">
            <section className="section">
                <div className="container">
                    <header className="mb-14">
                        <h4 className="text-orange-600 font-bold uppercase tracking-widest text-[11px] mb-4">Lifecycle Management</h4>
                        <h1 className="h1">Unit Activation</h1>
                        <p className="body-text max-w-2xl">Acquire and activate mandatory ZATCA cryptographic identities for your electronic generation solution unit.</p>
                    </header>

                    <div className="flex flex-col lg:flex-row gap-12 items-start">
                        <div className="flex-1 space-y-12">
                            {/* Phase 1: CSR */}
                            <div className={`card p-10 border-none bg-white transition-all ${currentStepNum >= 1 ? 'shadow-2xl' : 'opacity-40 grayscale'}`}>
                                <div className="flex justify-between items-start mb-10">
                                    <div className="flex-1">
                                        <span className={`small-text font-black px-4 py-1 rounded-full mb-3 inline-block ${currentStepNum > 1 ? 'bg-green-100 text-green-700' : 'bg-orange-600 text-white shadow-xl shadow-orange-500/30'}`}>
                                            {currentStepNum > 1 ? '✓ Complete' : 'Active Phase'}
                                        </span>
                                        <h2 className="h2 mt-4">01. Cryptographic Handshake</h2>
                                        <p className="small-text font-semibold text-gray-400 mt-2">Generate raw keys and request a Compliance CSID.</p>
                                    </div>
                                </div>

                                {currentStepNum === 1 ? (
                                    <div className="space-y-6">
                                        <div className="p-10 bg-[#fbfbfd] rounded-[32px] shadow-inner border border-gray-50 flex flex-col items-center">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block mb-4">Simulation OTP</label>
                                            <input
                                                type="text"
                                                value={otp}
                                                onChange={e => setOtp(e.target.value)}
                                                className="form-input text-center text-2xl font-black tracking-widest text-orange-600 border-none shadow-2xl max-w-[300px]"
                                                placeholder="123456"
                                            />
                                            <p className="text-[10px] font-bold text-gray-400 mt-4 text-center">Open your FATOORA portal to retrieve the one-time activation code.</p>
                                        </div>
                                        <button onClick={handleStart} disabled={loading} className="button w-full py-5 text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-orange-500/20">
                                            {loading ? 'Initializing Protocol...' : 'Launch Registration Initializer'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-6 bg-green-50 p-8 rounded-[32px] border border-green-100/50 shadow-inner">
                                        <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white text-xl shadow-lg border-4 border-white">✓</div>
                                        <div className="flex-1">
                                            <p className="text-[11px] font-black text-green-700 uppercase tracking-widest">Compliance Request ID</p>
                                            <code className="text-sm font-mono font-black text-green-800 tracking-tighter mt-1 block truncate max-w-[300px]">{status?.complianceRequestId || 'ID-GRANTED-V1'}</code>
                                        </div>
                                        <button onClick={handleReset} className="small-text font-black uppercase text-red-500 bg-transparent border-none">Reset Unit</button>
                                    </div>
                                )}
                            </div>

                            {/* Phase 2: Compliance */}
                            <div className={`card p-10 border-none bg-white transition-all ${currentStepNum >= 2 ? 'shadow-2xl' : 'opacity-40 grayscale pointer-events-none'}`}>
                                <div className="flex justify-between items-start mb-10">
                                    <div className="flex-1">
                                        <span className={`small-text font-black px-4 py-1 rounded-full mb-3 inline-block ${currentStepNum > 2 ? 'bg-green-100 text-green-700' : currentStepNum === 2 ? 'bg-orange-600 text-white shadow-xl shadow-orange-500/30' : 'bg-gray-100 text-gray-400'}`}>
                                            {currentStepNum > 2 ? '✓ Cleared' : currentStepNum === 2 ? 'In Progress' : 'Locked'}
                                        </span>
                                        <h2 className="h2 mt-4">02. Laboratory Scenarios</h2>
                                        <p className="small-text font-semibold text-gray-400 mt-2">Submit mandatory document scenarios for ZATCA gateway validation.</p>
                                    </div>
                                </div>

                                {currentStepNum === 2 && (
                                    <div className="space-y-6">
                                        <div className="p-8 bg-gray-50/50 rounded-[32px] border border-dashed border-gray-200">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {['Standard Invoice', 'Simplified Invoice', 'B2B Debit Note', 'B2B Credit Note', 'Simplified Credit', 'Simplified Debit'].map(item => (
                                                    <div key={item} className="flex items-center gap-3 small-text font-black text-gray-400 uppercase tracking-tight">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                                        {item}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <button onClick={handleCompliance} disabled={loading} className="button w-full py-5 text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-orange-500/20">
                                            {loading ? 'Transmitting Suite...' : 'Transmit Test Portfolio'}
                                        </button>
                                    </div>
                                )}

                                {complianceResults.length > 0 && (
                                    <div className="mt-8 grid grid-cols-3 gap-4">
                                        {complianceResults.map((r, i) => (
                                            <div key={i} className={`flex flex-col items-center justify-center p-6 rounded-[24px] border ${r.success ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                                                <span className={`text-xl mb-2`}>{r.success ? '✅' : '❌'}</span>
                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-center leading-tight">{r.type.replace('_', ' ')}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Phase 3: Production */}
                            <div className={`card p-10 border-none bg-white transition-all ${currentStepNum >= 3 ? 'shadow-2xl' : 'opacity-40 grayscale pointer-events-none'}`}>
                                <div className="flex justify-between items-start mb-10">
                                    <div className="flex-1">
                                        <span className={`small-text font-black px-4 py-1 rounded-full mb-3 inline-block ${currentStepNum > 3 ? 'bg-green-500 text-white' : currentStepNum === 3 ? 'bg-orange-600 text-white shadow-xl shadow-orange-500/30' : 'bg-gray-100 text-gray-400'}`}>
                                            {currentStepNum > 3 ? 'LIVE' : currentStepNum === 3 ? 'Final State' : 'Locked'}
                                        </span>
                                        <h2 className="h2 mt-4">03. Production Release</h2>
                                        <p className="small-text font-semibold text-gray-400 mt-2">Acquire the Production CSID and graduate to live gateway submissions.</p>
                                    </div>
                                </div>

                                {currentStepNum === 3 && (
                                    <button onClick={handleFinalize} disabled={loading} className="button w-full py-5 text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-orange-500/20">
                                        {loading ? 'Finalizing...' : 'Request Production Certificates'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Aside Context */}
                        <aside className="w-full lg:w-[320px] space-y-6 lg:sticky lg:top-10 flex-shrink-0">
                            <div className="card bg-[#fbfbfd] border-none p-10 text-left">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-8">Asset Context</h4>
                                <div className="space-y-8">
                                    <div className="group">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 group-hover:text-orange-600">Gateway</p>
                                        <p className="text-sm font-black text-black">ZATCA SANDBOX V3</p>
                                    </div>
                                    <div className="group">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 group-hover:text-orange-600">Institution</p>
                                        <p className="text-sm font-black text-black">{activeBank.name}</p>
                                    </div>
                                    <div className="group">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 group-hover:text-orange-600">Unit ID</p>
                                        <code className="text-[11px] font-mono font-black text-orange-600 uppercase mt-1 block">{activeBank.id}</code>
                                    </div>
                                </div>
                                <div className="mt-12 pt-8 border-t border-gray-100">
                                    <p className="italic small-text text-gray-400 leading-relaxed">Multi-tenant identity is cryptographically bound to the EGS hardware signature.</p>
                                </div>
                            </div>

                            <Link href="/" className="card bg-black p-8 text-white hover:translate-y-[-2px] flex items-center justify-between group transition-all duration-300">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.1em] mb-1">Return to</p>
                                    <p className="text-lg font-black tracking-tighter group-hover:text-orange-400 transition-colors">Mission Dashboard</p>
                                </div>
                                <span className="text-2xl opacity-40 group-hover:translate-x-2 group-hover:opacity-100 transition-all">→</span>
                            </Link>
                        </aside>
                    </div>
                </div>
            </section>
        </div>
    );
}

