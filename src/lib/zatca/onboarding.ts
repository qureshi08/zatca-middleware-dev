'use server';

import {
    generateKeyPair,
    extractRawPublicKey,
    derToRawSignature,
    getCertificateHash,
    parseCertificate,
    getCertificateSignature,
    signInvoiceHash
} from './crypto/signing';
import { generateCSR } from './crypto/csr';
import crypto from 'crypto';
import { TEST_CSR_CONFIG, TEST_SELLER, TEST_BUYERS, TEST_INVOICE_ITEMS } from './test-data';
import {
    requestComplianceCSID,
    performComplianceCheck,
    requestProductionCSID,
    logToTrace
} from './api/client';
import { getOnboardingStatus, saveOnboardingStatus, OnboardingStatus } from './onboarding-storage';
import { buildAndGenerateXML, updateInvoiceWithSignature, formatDate, formatTime } from './xml/builder';
import { hashInvoiceForSubmission, generatePreviousInvoiceHash } from './crypto/hash';
import { generateCompleteQRCode } from './qr/generator';
import { generateZATCASignatureXML } from './xml/signature';
import { AuthService } from '../auth-service';

/**
 * Fetch all registered banks for the UI
 */
export async function getOrganizationsAction() {
    return await AuthService.getOrganizations();
}

/**
 * Step 1: Start Onboarding for an Organization with an OTP
 */
export async function startOnboarding(otp: string, orgId: string) {
    try {
        const { privateKey, publicKey } = generateKeyPair();

        // Request Compliance CSID
        let response;
        if (otp === '123456') {
            console.log(`[ZATCA-${orgId}] Using Sandbox Simulation Mode (OTP 123456)`);
            const dummyCert = 'MIICUjCCAdegAwIBAgIUL35Nbv/IbzjZUnhsbWlsecLbwjkwCgYIKoZIzj0EAwIwYzELMAkGA1UEBhMCU0ExJDAiBgNVBAoMG01heGltdW0gU3BlZWQgVGVjaCBTdXBwbHkgTFREMRYwFAYDVQQLDA1SaXlhZGggQnJhbmNoMRcwFQYDVQQDDA5UU1QtODg2NDMxMTQ1MB4XDTI0MDEwMTAwMDAwMFoXDTI2MDEwMTAwMDAwMFowYzELMAkGA1UEBhMCU0ExJDAiBgNVBAoMG01heGltdW0gU3BlZWQgVGVjaCBTdXBwbHkgTFREMRYwFAYDVQQLDA1SaXlhZGggQnJhbmNoMRcwFQYDVQQDDA5UU1QtODg2NDMxMTQ1MBkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEL9P6iXG+6oT7v9U2j9u8v7p/7zR/3y9u5iG2k1X2v8P6T0N3v8zX9Y7u4W8s5Y7I4R8C6z1yK2B6U9/4o2owczAJBgNVHRMEAjAAMAsGA1UdDwQEAwIHgDAKBggqhkjOPQQDAgNIADBFAiEA5YvCtzSjD5Zf6N8p5r8Wp8/7+g3+6Y7+p8v5r5+g3+6D/7zP9+y5T6Z6R7/T1v4+J2qwBf9zX9Y7u4W8s5Y7I4=';
            const simData = {
                requestID: 'SIM-REQ-' + Date.now(),
                binarySecurityToken: dummyCert,
                secret: 'SIM_SECRET_' + Math.random().toString(36).substring(7),
            };
            response = { success: true, data: simData };

            const { pem } = generateCSR(TEST_CSR_CONFIG, privateKey);
            logToTrace({
                endpoint: 'POST /compliance (SIMULATED)',
                request: { csr: Buffer.from(pem.trim()).toString('base64'), orgId },
                responseStatus: 200,
                responseBody: JSON.stringify({
                    requestID: simData.requestID,
                    binarySecurityToken: simData.binarySecurityToken,
                    status: "PASS"
                })
            });
        } else {
            console.log(`[ZATCA-${orgId}] Requesting Compliance CSID with OTP: ${otp}`);
            const { pem } = generateCSR(TEST_CSR_CONFIG, privateKey);
            const b64OfPem = Buffer.from(pem.trim()).toString('base64');
            response = await requestComplianceCSID(b64OfPem, otp);
        }

        if (!response.success) throw new Error(response.error);

        const status: Partial<OnboardingStatus> = {
            step: 'compliance_requested',
            complianceRequestId: String(response.data.requestID),
            complianceCSID: response.data.binarySecurityToken,
            complianceSecret: response.data.secret,
            privateKey,
            publicKey,
        };

        await saveOnboardingStatus(orgId, status);
        return { success: true, data: { requestID: response.data.requestID, binarySecurityToken: response.data.binarySecurityToken, secret: response.data.secret } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Step 2: Run Compliance Checks for an Organization
 */
export async function runComplianceChecks(orgId: string) {
    const status = await getOnboardingStatus(orgId);
    // Accept multiple valid step names that indicate CSR was already obtained
    const validSteps = ['compliance_requested', 'csr_generated', 'compliance_failed'];
    if (!validSteps.includes(status.step || '') || !status.complianceCSID) {
        return {
            success: false,
            error: `Cannot run compliance checks. Current step: '${status.step || 'none'}'. Complete Step 1 (CSR) first.`
        };
    }

    try {
        const results: any[] = [];
        for (let i = 0; i < 6; i++) {
            const type = i < 3 ? 'standard' : 'simplified';
            const subType = i % 3 === 0 ? 'invoice' : (i % 3 === 1 ? 'debit' : 'credit');
            const now = new Date(Date.now() - 4 * 3600 * 1000);
            let documentType: '388' | '383' | '381' = '388';
            if (subType === 'debit') documentType = '383';
            if (subType === 'credit') documentType = '381';

            const { xml, invoice } = buildAndGenerateXML({
                type,
                documentType,
                seller: TEST_SELLER,
                buyer: type === 'standard' ? TEST_BUYERS.CORPORATE_CLIENT : TEST_BUYERS.INDIVIDUAL_CUSTOMER,
                items: [TEST_INVOICE_ITEMS.ACCOUNT_FEE],
                invoiceCounter: i + 1,
                previousInvoiceHash: i === 0 ? undefined : (results.length > 0 ? results[i - 1].hash : undefined),
                issueDate: formatDate(now),
                issueTime: formatTime(now),
            });

            const hash = hashInvoiceForSubmission(xml);
            const derSignature = signInvoiceHash(hash, status.privateKey!);
            const certHash = getCertificateHash(status.complianceCSID!);
            const { issuerName, serialNumber } = parseCertificate(status.complianceCSID!);
            const certBody = status.complianceCSID!.replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s/g, '');
            const signingTime = new Date(now).toISOString().split('.')[0] + 'Z';

            const signatureXML = generateZATCASignatureXML({
                invoiceHash: hash,
                signatureValue: derSignature,
                certificate: certBody,
                signingTime: signingTime,
                certHash,
                certIssuer: issuerName,
                certSerialNumber: serialNumber
            });

            const { tlvData } = await generateCompleteQRCode({
                sellerName: TEST_SELLER.partyLegalEntity.registrationName,
                vatRegistrationNumber: TEST_SELLER.partyTaxScheme.companyID,
                timestamp: now,
                invoiceTotal: invoice.legalMonetaryTotal.taxInclusiveAmount,
                vatTotal: invoice.taxTotal[0].taxAmount,
                invoiceHash: hash,
                ecdsaSignature: derToRawSignature(Buffer.from(derSignature, 'base64')).toString('base64'),
                ecdsaPublicKey: extractRawPublicKey(status.publicKey!),
                certificateSignature: getCertificateSignature(status.complianceCSID!),
            });

            const signedXml = updateInvoiceWithSignature(xml, signatureXML, tlvData);
            const b64Xml = Buffer.from(signedXml).toString('base64');

            let res;
            if (status.complianceRequestId?.startsWith('SIM-')) {
                res = { success: true };
            } else {
                // Use the actual secret returned from ZATCA during CSR step
                const secret = status.complianceSecret || 'COM-SEC';
                res = await performComplianceCheck(b64Xml, hash, invoice.uuid, status.complianceCSID!, secret);
            }

            const hashHex = crypto.createHash('sha256').update(signedXml).digest('hex');
            results.push({ type: `${type}_${subType}`, success: res.success, error: res.error, hash: Buffer.from(hashHex).toString('base64') });
        }

        const allPassed = results.every(r => r.success);
        await saveOnboardingStatus(orgId, { step: allPassed ? 'compliance_complete' : 'compliance_failed' });

        return { success: allPassed, results };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Step 3: Finalize and get Production CSID for an Organization
 */
export async function finalizeOnboarding(orgId: string) {
    const status = await getOnboardingStatus(orgId);
    if (status.step !== 'compliance_complete') {
        return { success: false, error: 'Compliance checks not yet passed' };
    }

    try {
        let response;
        if (status.complianceRequestId?.startsWith('SIM-')) {
            response = {
                success: true,
                data: {
                    binarySecurityToken: 'PROD-CSID-' + orgId,
                    secret: 'PROD-SEC-' + orgId,
                }
            };
        } else {
            response = await requestProductionCSID(status.complianceRequestId!, status.complianceCSID!, 'COM-SEC');
        }

        if (!response.success) throw new Error(response.error);

        await saveOnboardingStatus(orgId, {
            step: 'production_received',
            productionCSID: response.data.binarySecurityToken,
            productionSecret: response.data.secret,
            isRegistered: true,
        });

        return { success: true, data: status };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
/**
 * Atomic Onboarding Wrapper (Convenience Shortcut for API)
 */
export async function completeOnboarding(otp: string, orgId: string) {
    try {
        const s1 = await startOnboarding(otp, orgId);
        if (!s1.success) return s1;
        const s2 = await runComplianceChecks(orgId);
        if (!s2.success) return s2;
        return await finalizeOnboarding(orgId);
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
