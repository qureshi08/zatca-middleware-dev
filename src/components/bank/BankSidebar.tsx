'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useBankAuthStore } from '@/store/bankAuthStore';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  LogOut,
  Receipt,
  FileCheck2,
  Users,
  Building2,
  Settings,
  ListRestart,
  Shield,
  Eye,
  CheckSquare,
  Stamp,
} from 'lucide-react';

export default function BankSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { bankName, role, sessionToken, logout } = useBankAuthStore();

  const handleLogout = async () => {
    if (sessionToken) {
      await fetch('/api/bank/auth/logout', {
        method: 'POST',
        headers: { 'x-session-token': sessionToken },
      }).catch(() => undefined);
    }
    logout();
    router.push('/bank/login');
  };

  const isActive = (href: string) => {
    if (href === '/bank/dashboard') return pathname === '/bank/dashboard';
    return pathname.startsWith(href);
  };

  const roleColor: Record<string, string> = {
    Admin: 'bg-purple-500/15 text-purple-400',
    Maker: 'bg-blue-500/15 text-blue-400',
    Checker: 'bg-amber-500/15 text-amber-400',
    Approver: 'bg-emerald-500/15 text-emerald-400',
    Auditor: 'bg-gray-500/15 text-gray-400',
  };

  const navSections = [
    {
      label: 'Overview',
      items: [
        { name: 'Dashboard', href: '/bank/dashboard', icon: LayoutDashboard },
        { name: 'Onboarding', href: '/bank/onboarding', icon: FileCheck2 },
      ],
    },
    {
      label: 'Workflow',
      items: [
        { name: 'All Invoices', href: '/bank/invoices', icon: Receipt },
        ...(role === 'Maker' || role === 'Admin' ? [{ name: 'Maker Queue', href: '/bank/invoices/maker', icon: FileText }] : []),
        ...(role === 'Checker' || role === 'Admin' ? [{ name: 'Checker Queue', href: '/bank/invoices/checker', icon: CheckSquare }] : []),
        ...(role === 'Approver' || role === 'Admin' ? [{ name: 'Approver Queue', href: '/bank/invoices/approver', icon: Stamp }] : []),
      ],
    },
    {
      label: 'Data',
      items: [
        { name: 'Customers', href: '/bank/customers', icon: Building2 },
        { name: 'Credit/Debit Notes', href: '/bank/notes', icon: Eye },
        { name: 'Audit Logs', href: '/bank/logs', icon: ListRestart },
      ],
    },
    ...(role === 'Admin'
      ? [
          {
            label: 'Admin',
            items: [
              { name: 'Users', href: '/bank/users', icon: Users },
              { name: 'Middleware Setup', href: '/bank/settings', icon: Settings },
            ],
          },
        ]
      : []),
  ];

  return (
    <aside className="bank-sidebar">
      <div className="bank-sidebar-header">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-[12px] font-black shadow-lg shadow-blue-600/20">
            CB
          </div>
          <div>
            <span className="text-[14px] font-extrabold tracking-tight text-white">
              Bank<span className="text-blue-400">.</span>CBS
            </span>
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest -mt-0.5">
              Core Banking Demo
            </p>
          </div>
        </div>
      </div>

      <div className="bank-sidebar-identity">
        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Active Tenant</p>
        <p className="text-[12px] font-bold text-gray-200 truncate">{bankName || 'Not Authenticated'}</p>
        <div className={`mt-1.5 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${roleColor[role || ''] || 'bg-gray-800 text-gray-400'}`}>
          <Shield size={10} />
          {role || 'No role'}
        </div>
      </div>

      <nav className="bank-sidebar-nav">
        {navSections.map((section) => (
          <div key={section.label} className="mb-4">
            <div className="bank-nav-label">{section.label}</div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`bank-nav-item ${active ? 'active' : ''}`}
                >
                  <Icon size={15} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="bank-sidebar-footer">
        <button onClick={handleLogout} className="bank-nav-item text-gray-500 hover:text-red-400 w-full">
          <LogOut size={15} />
          <span>Logout</span>
        </button>
        <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest mt-2 px-3">
          Bank Demo v1.0 · Middleware Integration
        </p>
      </div>
    </aside>
  );
}
