import { createClient } from '@supabase/supabase-js';

// UNIVERSAL FAULT-TOLERANT SUPABASE CONNECTOR (Z3C v9.8)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://MISSING.supabase.co';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'MISSING';
const role = process.env.SUPABASE_SERVICE_ROLE_KEY || 'MISSING';

// Used for client-side interactions (Browser) - Lazy initialized
export const supabase = createClient(url, anon);

// Used for server-side operations (Admin/Auth/API Keys) - High Privilege
export const supabaseAdmin = createClient(url, role, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
