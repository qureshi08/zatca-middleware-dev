'use client';

import { Bell, User } from 'lucide-react';
import { useBankAuthStore } from '@/store/bankAuthStore';

export default function BankHeader() {
  const { userName, role, passwordExpiresAt } = useBankAuthStore();
  const passwordDueSoon = passwordExpiresAt
    ? new Date(passwordExpiresAt).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000
    : false;

  return (
    <header className="bank-header">
      <div className="flex items-center gap-2">
        <h2 className="text-[15px] font-bold text-gray-900 tracking-tight">Bank CBS Demo</h2>
        <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded uppercase tracking-widest">Core Banking</span>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell size={16} />
          {passwordDueSoon && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />}
        </button>
        <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
            <User size={14} />
          </div>
          <div className="flex flex-col">
            <span className="text-[12px] font-bold text-gray-800">{userName || 'User'}</span>
            <span className="text-[10px] text-gray-400 font-medium">{role || 'No role'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
