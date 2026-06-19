import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'node:crypto';

/**
 * INSTITUTIONAL LOGIN GATE (v15.1)
 * Custom Auth Engine - Securely validates bank admins against the bank_users registry.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json({ error: 'Missing Credentials' }, { status: 400 });
        }

        // 1. Fetch User from Registry (Check local JSON first, then fall back to Supabase bank_users table)
        let user: any = null;
        const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

        try {
            const fs = require('node:fs/promises');
            const path = require('node:path');
            const usersFilePath = path.join(process.cwd(), 'zatca-users.json');
            const fileData = await fs.readFile(usersFilePath, 'utf-8');
            const users = JSON.parse(fileData);
            const localUser = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
            
            if (localUser) {
                // Fetch the organization from Supabase
                const { data: org, error: orgError } = await supabaseAdmin
                    .from('organizations')
                    .select('*')
                    .eq('id', localUser.organization_id)
                    .single();
                
                if (org && !orgError) {
                    user = {
                        ...localUser,
                        organizations: org
                    };
                }
            }
        } catch (e) {
            console.log('[LOGIN]: Local JSON lookup bypassed or failed, trying database table');
        }

        if (!user) {
            // Fallback: Query bank_users table
            const { data: dbUser, error: userError } = await supabaseAdmin
                .from('bank_users')
                .select('*, organizations(*)')
                .eq('email', email)
                .single();

            if (userError || !dbUser) {
                return NextResponse.json({ error: 'Unauthorized', details: 'Invalid institutional credentials' }, { status: 401 });
            }
            user = dbUser;
        }

        // 2. Verify Hash
        if (user.password_hash !== passwordHash) {
            return NextResponse.json({ error: 'Unauthorized', details: 'Invalid institutional credentials' }, { status: 401 });
        }

        // 3. Successful Login - Return Session Data
        const stableKeySnippet = user.organizations.id.replace(/-/g, '').slice(0, 32);
        const apiKey = `sk_zatca_live_${stableKeySnippet}`;

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.full_name,
                organization_id: user.organization_id
            },
            organization: user.organizations,
            apiKey: apiKey
        });

    } catch (e: any) {
        return NextResponse.json({ error: 'Auth Protocol Fault', details: e.message }, { status: 500 });
    }
}
