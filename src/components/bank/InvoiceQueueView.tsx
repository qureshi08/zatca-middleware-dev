'use client';

import { useEffect, useState } from 'react';
import { useBankAuthStore } from '@/store/bankAuthStore';
import Link from 'next/link';
import { Clock, Send, ShieldCheck, Stamp, AlertCircle, ArrowRight, Eye } from 'lucide-react';

interface InvoiceQueueViewProps {
  title: string;
  description: string;
  statusFilter: string[];
}

export default function InvoiceQueueView({ title, description, statusFilter }: InvoiceQueueViewProps) {
  const { sessionToken } = useBankAuthStore();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadInvoices = async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/bank/product/invoices', {
        headers: { 'x-session-token': sessionToken },
      });
      const data = await res.json();
      const all = data.invoices || [];
      setInvoices(all.filter((inv: any) => statusFilter.includes(inv.status)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [sessionToken]);

  const statusLabel: Record<string, { label: string; color: string; icon: any }> = {
    draft: { label: 'Created', color: 'bg-gray-100 text-gray-700', icon: Clock },
    returned_by_checker: { label: 'Fix Needed (Checker)', color: 'bg-red-50 text-red-600', icon: AlertCircle },
    returned_by_approver: { label: 'Fix Needed (Approver)', color: 'bg-red-50 text-red-600', icon: AlertCircle },
    submitted_for_check: { label: 'Awaiting Check', color: 'bg-blue-100 text-blue-700', icon: Send },
    checked: { label: 'Awaiting Approval', color: 'bg-indigo-100 text-indigo-700', icon: ShieldCheck },
    approved_for_submission: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700', icon: Stamp },
  };

  return (
    <div className="animate-pro">
      <div className="mb-6">
        <h1 className="h1">{title}</h1>
        <p className="text-small">{description}</p>
      </div>

      <div className="card-pro overflow-hidden">
        <table className="w-full text-left border-collapse border-separate border-spacing-0">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="p-3 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">Document</th>
              <th className="p-3 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer</th>
              <th className="p-3 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Amout</th>
              <th className="p-3 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Step</th>
              <th className="p-3 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={5} className="p-4"><div className="h-4 bg-gray-50 rounded w-full"></div></td>
                </tr>
              ))
            ) : invoices.length > 0 ? (
              invoices.map((inv) => {
                const s = statusLabel[inv.status] || { label: inv.status, color: 'bg-gray-100', icon: Clock };
                const Icon = s.icon;
                return (
                  <tr key={inv.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-3">
                      <div className="text-[12px] font-bold text-gray-900">{inv.invoiceNumber}</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-tighter">{inv.type} · {inv.documentType}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-[11px] font-medium text-gray-800">{inv.customerSnapshot?.registrationName}</div>
                      <div className="text-[9px] text-gray-400 leading-none">VAT: {inv.customerSnapshot?.vatNumber}</div>
                    </td>
                    <td className="p-3 text-right">
                      <div className="text-[12px] font-black text-gray-900">SAR {inv.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </td>
                    <td className="p-3 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${s.color}`}>
                        <Icon size={10} />
                        {s.label}
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <Link 
                        href={`/bank/invoices/${inv.id}`}
                        className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg bg-white border border-gray-100 text-[10px] font-black text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 shadow-sm transition-all uppercase tracking-widest"
                      >
                        <Eye size={12} />
                        Review
                      </Link>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="p-12 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gray-50 text-gray-300 mb-2">
                    <Clock size={24} />
                  </div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Queue is Empty</p>
                  <p className="text-[10px] text-gray-300">No invoices currently require your attention.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
