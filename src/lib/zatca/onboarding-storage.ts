'use server';

import { supabaseAdmin } from '../supabase';
import { encryptSecret, decryptSecret } from '../secrets';

/** Decrypt a stored secret, tolerating legacy plaintext rows (returns as-is if not ciphertext). */
function safeDecrypt(v?: string | null): string | undefined {
    if (!v) return v ?? undefined;
    try { return decryptSecret(v) ?? v; } catch { return v; }
}

export interface OnboardingStatus {
    isRegistered: boolean;
    step: string;
    complianceRequestId?: string;
    complianceCSID?: string;
    complianceSecret?: string;
    productionCSID?: string;
    productionSecret?: string;
    privateKey?: string;
    publicKey?: string;
    errors?: string[];
}

/**
 * Fetches the ZATCA onboarding status for a specific organization.
 * orgId is optional for backward compat (layout.tsx calls it with no args — now a no-op).
 */
export async function getOnboardingStatus(orgId?: string): Promise<OnboardingStatus> {
    if (!orgId) return { isRegistered: false, step: 'none' };

    try {
        const { data, error } = await supabaseAdmin
            .from('zatca_profiles')
            .select('*')
            .eq('organization_id', orgId)
            .single();

        if (error || !data) {
            return { isRegistered: false, step: 'none' };
        }

        return {
            isRegistered: !!data.production_csid,
            // Always read step directly from the persisted column — never reconstruct it
            step: data.onboarding_step || (data.production_csid ? 'production_received' : 'none'),
            complianceRequestId: data.compliance_request_id,
            complianceCSID: safeDecrypt(data.compliance_csid),
            complianceSecret: safeDecrypt(data.compliance_secret),
            productionCSID: safeDecrypt(data.production_csid),
            productionSecret: safeDecrypt(data.production_secret),
            privateKey: safeDecrypt(data.private_key_base64),
            publicKey: data.public_key_base64,
        };
    } catch {
        return { isRegistered: false, step: 'none' };
    }
}

/**
 * Saves or updates the ZATCA onboarding status for an organization.
 * Only fields that are explicitly provided will be written — undefined fields are ignored.
 */
export async function saveOnboardingStatus(orgId: string, status: Partial<OnboardingStatus>): Promise<void> {
    const updateData: Record<string, any> = {
        organization_id: orgId,
        updated_at: new Date().toISOString(),
    };

    // Secrets (private key, CSIDs, ZATCA secrets) are encrypted at rest; the
    // public key, request id, and step are not sensitive.
    if (status.step !== undefined) updateData.onboarding_step = status.step;
    if (status.privateKey !== undefined) updateData.private_key_base64 = encryptSecret(status.privateKey);
    if (status.publicKey !== undefined) updateData.public_key_base64 = status.publicKey;
    if (status.complianceCSID !== undefined) updateData.compliance_csid = encryptSecret(status.complianceCSID);
    if (status.complianceRequestId !== undefined) updateData.compliance_request_id = status.complianceRequestId;
    if (status.complianceSecret !== undefined) updateData.compliance_secret = encryptSecret(status.complianceSecret);
    if (status.productionCSID !== undefined) updateData.production_csid = encryptSecret(status.productionCSID);
    if (status.productionSecret !== undefined) updateData.production_secret = encryptSecret(status.productionSecret);

    const { data: existing } = await supabaseAdmin
        .from('zatca_profiles')
        .select('id')
        .eq('organization_id', orgId)
        .single();

    if (existing) {
        const { error } = await supabaseAdmin
            .from('zatca_profiles')
            .update(updateData)
            .eq('organization_id', orgId);
        if (error) throw new Error(`Failed to update status: ${error.message}`);
    } else {
        const { error } = await supabaseAdmin
            .from('zatca_profiles')
            .insert(updateData);
        if (error) throw new Error(`Failed to insert status: ${error.message}`);
    }
}

/**
 * Resets the ZATCA profile for an organization (used for re-onboarding).
 */
export async function resetOnboardingStatus(orgId: string): Promise<void> {
    const { error } = await supabaseAdmin
        .from('zatca_profiles')
        .delete()
        .eq('organization_id', orgId);
    if (error) throw new Error(`Failed to reset onboarding status: ${error.message}`);
}
