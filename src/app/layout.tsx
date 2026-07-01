import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import { AppProvider } from '@/context/AppContext';
import { getCurrentUser } from '@/lib/supabase/server';
import { isPlatformAdmin } from '@/lib/admin';

export const metadata: Metadata = {
  title: 'ZATCA Middleware – Phase 2 E-Invoicing Platform',
  description: 'ZATCA Phase 2 e-invoicing middleware. Connect Odoo or Zoho (or our API) and clear/report invoices automatically.',
  icons: { icon: '/favicon.ico' },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Show the app shell (sidebar) only when signed in; auth pages render standalone.
  const user = await getCurrentUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning>
        <AppProvider>
          {user ? (
            <div className="app-shell" style={{ display: "flex", minHeight: "100vh" }}>
              <Sidebar email={user.email ?? undefined} isAdmin={isPlatformAdmin(user.email)} />
              <div className="main-content" style={{ flex: 1, minWidth: 0 }}>{children}</div>
            </div>
          ) : (
            <div className="main-content">{children}</div>
          )}
        </AppProvider>
      </body>
    </html>
  );
}
