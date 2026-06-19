import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { AuthService } from '@/lib/auth-service';
import crypto from 'node:crypto';

/**
 * INSTITUTIONAL AUTH GATEWAY (v14.3)
 * Custom Identity Engine - Bypasses internal Supabase Auth Database errors.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    console.log('[REGISTRATION-HUB]: Starting Custom Identity Provisioning');

    try {
        const body = await req.json();
        const { bankName, taxNumber, vatNumber, email, password } = body;

        // 1. Validation Shield
        if (!bankName || !taxNumber || !email || !password) {
            return NextResponse.json({ error: 'Incomplete Identity', details: 'All fields are required.' }, { status: 400 });
        }

        // 2. Supremacy Check
        const { data: existingOrg } = await supabaseAdmin
            .from('organizations')
            .select('id')
            .eq('tax_number', taxNumber)
            .maybeSingle();

        if (existingOrg) {
            return NextResponse.json({ error: 'Registration Conflict', details: 'This Tax ID (TIN) is already registered.' }, { status: 409 });
        }

        // 3. Provision the Institutional Entity
        const { data: org, error: orgError } = await supabaseAdmin
            .from('organizations')
            .insert({
                name: bankName,
                tax_number: taxNumber,
                vat_number: vatNumber || taxNumber,
                status: 'onboarding'
            })
            .select()
            .single();

        if (orgError) throw new Error(`Vault Insertion Failed: ${orgError.message}`);

        // 4. Provision the Admin (Local JSON fallback / primary store to avoid missing table schema issue)
        const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
        
        const userId = crypto.randomUUID();
        const newUser = {
            id: userId,
            organization_id: org.id,
            email: email,
            password_hash: passwordHash,
            full_name: `${bankName} Administrator`,
            role: 'Admin',
            user_status: 'active',
            password_history: [passwordHash],
            password_changed_at: new Date().toISOString(),
            password_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date().toISOString()
        };

        try {
            const fs = require('node:fs/promises');
            const path = require('node:path');
            const usersFilePath = path.join(process.cwd(), 'zatca-users.json');
            
            let users = [];
            try {
                const fileData = await fs.readFile(usersFilePath, 'utf-8');
                users = JSON.parse(fileData);
            } catch (readError) {
                users = [];
            }
            
            // Double check email uniqueness in local store
            if (users.some((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
                await supabaseAdmin.from('organizations').delete().eq('id', org.id);
                return NextResponse.json({ error: 'Registration Conflict', details: 'This email is already registered.' }, { status: 409 });
            }
            
            users.push(newUser);
            await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
        } catch (fileError: any) {
            // Fallback: try inserting into bank_users table in case it was created
            const { error: userError } = await supabaseAdmin
                .from('bank_users')
                .insert({
                    organization_id: org.id,
                    email: email,
                    password_hash: passwordHash,
                    full_name: `${bankName} Administrator`,
                    role: 'Admin',
                    user_status: 'active',
                    password_history: [passwordHash],
                    password_changed_at: new Date().toISOString(),
                    password_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                });

            if (userError) {
                // Rollback Org
                await supabaseAdmin.from('organizations').delete().eq('id', org.id);
                throw new Error(`Bank User Registry Failed: Local file write failed (${fileError.message}) and Database table insertion failed (${userError.message}).`);
            }
        }

        // 5. Issue the Initial Master API Key
        const { rawKey } = await AuthService.generateAPIKey(org.id, 'Primary Master Key');

        return NextResponse.json({
            success: true,
            message: 'Institutional Identity Activated.',
            nodeRef: org.id,
            apiKey: rawKey
        });

    } catch (e: any) {
        console.error('[REGISTRATION-FATAL]:', e.message);
        return NextResponse.json({
            success: false,
            error: 'Institutional Onboarding Failure',
            details: e.message
        }, { status: 500 });
    }
}
