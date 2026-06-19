import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BankAuthState {
  sessionToken: string | null;
  bankName: string | null;
  role: 'Admin' | 'Maker' | 'Checker' | 'Approver' | 'Auditor' | null;
  userName: string | null;
  email: string | null;
  passwordExpiresAt: string | null;
  integrationConfigured: boolean;
  setAuth: (payload: {
    sessionToken: string;
    bankName: string;
    role: 'Admin' | 'Maker' | 'Checker' | 'Approver' | 'Auditor';
    userName: string;
    email: string;
    passwordExpiresAt: string | null;
    integrationConfigured: boolean;
  }) => void;
  setIntegrationConfigured: (configured: boolean) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useBankAuthStore = create<BankAuthState>()(
  persist(
    (set, get) => ({
      sessionToken: null,
      bankName: null,
      role: null,
      userName: null,
      email: null,
      passwordExpiresAt: null,
      integrationConfigured: false,
      setAuth: (payload) => set(payload),
      setIntegrationConfigured: (integrationConfigured) => set({ integrationConfigured }),
      logout: () =>
        set({
          sessionToken: null,
          bankName: null,
          role: null,
          userName: null,
          email: null,
          passwordExpiresAt: null,
          integrationConfigured: false,
        }),
      isAuthenticated: () => !!get().sessionToken,
    }),
    {
      name: 'z3c-bank-demo-auth',
    }
  )
);
