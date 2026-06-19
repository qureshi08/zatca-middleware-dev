import crypto from 'node:crypto';
import { supabaseAdmin } from './supabase';

export interface APIKeyResponse {
    rawKey: string;
    prefix: string;
}

export class AuthService {
    /**
     * Generates a new API Key for an organization
     * Format: sk_zatca_live_[RandomString]
     */
    static async generateAPIKey(orgId: string, name: string = 'Default Key'): Promise<APIKeyResponse> {
        const rawKey = `sk_zatca_live_${crypto.randomBytes(24).toString('hex')}`;
        const prefix = rawKey.substring(0, 12); // sk_zatca_liv
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

        const { error } = await supabaseAdmin
            .from('api_keys')
            .insert({
                organization_id: orgId,
                key_prefix: prefix,
                key_hash: keyHash,
                name: name,
                status: 'active'
            });

        if (error) throw new Error(`Failed to store API Key: ${error.message}`);

        return { rawKey, prefix };
    }

    /**
   * Validates an API Key and returns the associated organization
   */
    static async validateAPIKey(rawKey: string): Promise<any | null> {
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

        // 1. Check for standard random keys in the database
        let { data, error } = await supabaseAdmin
            .from('api_keys')
            .select('organization_id, organizations(*)')
            .eq('key_hash', keyHash)
            .eq('status', 'active')
            .maybeSingle();

        // 2. SUPPORT FOR STABLE INSTITUTIONAL KEYS (v23.2)
        // If not found, check if this is a stable key derived from an orgId
        if (!data && rawKey.startsWith('sk_zatca_live_')) {
            // Find the org where sk_zatca_live_ (orgId minus dashes) matches
            const { data: allOrgs } = await supabaseAdmin
                .from('organizations')
                .select('*');

            const matchingOrg = allOrgs?.find(o => {
                const stableKeySnippet = o.id.replace(/-/g, '').slice(0, 32);
                return rawKey === `sk_zatca_live_${stableKeySnippet}`;
            });

            if (matchingOrg) {
                return matchingOrg;
            }
        }

        if (error || !data) {
            return null;
        }

        return data.organizations;
    }

    /**
     * Registers a new Bank (Organization)
     */
    static async registerBank(name: string, taxNumber: string, vatNumber: string) {
        const { data, error } = await supabaseAdmin
            .from('organizations')
            .insert({
                name,
                tax_number: taxNumber,
                vat_number: vatNumber,
                status: 'onboarding'
            })
            .select()
            .single();

        if (error) throw new Error(`Failed to register bank: ${error.message}`);

        return data;
    }

    /**
   * Get all registered organizations
   */
    static async getOrganizations() {
        const { data, error } = await supabaseAdmin
            .from('organizations')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }
}
