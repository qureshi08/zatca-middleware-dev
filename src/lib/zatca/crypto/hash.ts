/**
 * ZATCA Invoice Hashing Module
 * Implements SHA-256 hashing as per ZATCA specifications
 */

import crypto from 'crypto';

/**
 * Generate SHA-256 hash of a string
 * @param data - String to hash
 * @returns Base64-encoded hash
 */
export function sha256Hash(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('base64');
}

/**
 * Generate SHA-256 hash and return as hex
 * @param data - String to hash
 * @returns Hex-encoded hash
 */
export function sha256HashHex(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Generate SHA-256 hash and return as binary buffer
 * @param data - String to hash
 * @returns Binary buffer
 */
export function sha256HashBuffer(data: string): Buffer {
    return crypto.createHash('sha256').update(data, 'utf8').digest();
}

/**
 * Hash invoice XML for ZATCA submission
 * Steps as per ZATCA specification:
 * 1. Remove UBLExtensions block
 * 2. Remove QR code AdditionalDocumentReference
 * 3. Remove Signature block
 * 4. Canonicalize using C14N
 * 5. Hash using SHA-256
 * 6. Base64 encode
 * 
 * @param invoiceXML - Complete invoice XML string
 * @returns Base64-encoded SHA-256 hash
 */
export function hashInvoiceForSubmission(invoiceXML: string): string {
    // 1. Initial cleanup: Remove XML declaration and any existing whitespace between tags
    // to make regex matching more predictable.
    let cleanedXML = invoiceXML
        .replace(/<\?xml[^?]*\?>/g, '')
        .replace(/>\s+</g, '><')
        .trim();

    // 2. Remove UBLExtensions block (it's where the signature goes, so it's not hashed)
    cleanedXML = cleanedXML.replace(/<ext:UBLExtensions>[\s\S]*?<\/ext:UBLExtensions>/g, '');

    // 3. Remove Signature block (cac:Signature)
    cleanedXML = cleanedXML.replace(/<cac:Signature>[\s\S]*?<\/cac:Signature>/g, '');

    // 4. Remove ONLY the AdditionalDocumentReference that contains ID=QR
    // This is the most sensitive part - we look for the ADR block that wraps the QR ID.
    cleanedXML = cleanedXML.replace(/<cac:AdditionalDocumentReference><cbc:ID>QR<\/cbc:ID>[\s\S]*?<\/cac:AdditionalDocumentReference>/g, '');

    // 5. Final canonicalization: ensure NO whitespace between tags remains
    cleanedXML = cleanedXML.replace(/>\s+</g, '><').trim();

    // 6. Hash using UTF-8 and Base64 encode the binary digest
    return crypto.createHash('sha256').update(cleanedXML, 'utf8').digest('base64');
}

/**
 * Generate the "Previous Invoice Hash" (PIH)
 * For the first invoice, use hash of "0"
 * For subsequent invoices, use hash of previous invoice
 * 
 * @param previousInvoiceXML - Previous invoice XML (or null for first invoice)
 * @returns Base64-encoded hash
 */
export function generatePreviousInvoiceHash(previousInvoiceXML: string | null): string {
    if (!previousInvoiceXML) {
        // First invoice seed hash: sha256("0") -> hex string -> base64
        // hex = 5fec... -> b64 = NWZlY2...
        return 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==';
    }

    // Step for ZATCA: Hash(xml) -> hex -> base64(hex_string)
    const hashHex = sha256HashHex(previousInvoiceXML);
    return Buffer.from(hashHex, 'utf8').toString('base64');
}

/**
 * Verify invoice hash
 * @param invoiceXML - Invoice XML
 * @param expectedHash - Expected hash value
 * @returns True if hash matches
 */
export function verifyInvoiceHash(invoiceXML: string, expectedHash: string): boolean {
    const calculatedHash = hashInvoiceForSubmission(invoiceXML);
    return calculatedHash === expectedHash;
}
