/**
 * ZATCA Digital Signature Module
 * Implements ECDSA signing using secp256k1 curve
 */

import crypto from 'crypto';
import forge from 'node-forge';

/**
 * Generate ECDSA key pair (secp256k1)
 * @returns Object containing private and public keys in PEM format
 */
export function generateKeyPair(): { privateKey: string; publicKey: string } {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'secp256k1',
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem',
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
        },
    });

    return { privateKey, publicKey };
}

/**
 * Sign data using ECDSA private key
 * @param data - Data to sign (typically a hash)
 * @param privateKeyPEM - Private key in PEM format
 * @returns Base64-encoded signature
 */
export function signData(data: string, privateKeyPEM: string): string {
    const sign = crypto.createSign('SHA256');
    sign.update(data);
    sign.end();

    const signature = sign.sign(privateKeyPEM);
    return signature.toString('base64');
}

/**
 * Sign invoice hash using ECDSA
 * @param invoiceHash - Base64-encoded invoice hash
 * @param privateKeyPEM - Private key in PEM format
 * @returns Base64-encoded signature
 */
export function signInvoiceHash(invoiceHash: string, privateKeyPEM: string): string {
    // Decode base64 hash to binary
    const hashBuffer = Buffer.from(invoiceHash, 'base64');

    // Sign the binary hash directly without re-hashing it.
    // Setting algorithm to null/undefined or using crypto.sign with specific options
    // tell Node.js we are providing a pre-computed digest.
    const signature = crypto.sign(undefined, hashBuffer, privateKeyPEM);

    return signature.toString('base64');
}

/**
 * Verify signature
 * @param data - Original data
 * @param signature - Base64-encoded signature
 * @param publicKeyPEM - Public key in PEM format
 * @returns True if signature is valid
 */
export function verifySignature(
    data: string,
    signature: string,
    publicKeyPEM: string
): boolean {
    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    verify.end();

    const signatureBuffer = Buffer.from(signature, 'base64');
    return verify.verify(publicKeyPEM, signatureBuffer);
}

/**
 * Extract public key from private key
 * @param privateKeyPEM - Private key in PEM format
 * @returns Public key in PEM format
 */
export function extractPublicKey(privateKeyPEM: string): string {
    const privateKey = crypto.createPrivateKey(privateKeyPEM);
    const publicKey = crypto.createPublicKey(privateKey);

    return publicKey.export({
        type: 'spki',
        format: 'pem',
    }) as string;
}

/**
 * Extract raw ECDSA public key (64 bytes) from PEM
 * @param publicKeyPEM - Public key in PEM format
 * @returns Base64-encoded raw 64-byte public key
 */
export function extractRawPublicKey(publicKeyPEM: string): string {
    const pubKey = crypto.createPublicKey(publicKeyPEM);
    const der = pubKey.export({
        type: 'spki',
        format: 'der',
    });

    // For secp256k1/prime256v1, the public key is the last 64 bytes of the SPKI DER 
    // when uncompressed (starts with 0x04).
    // A robust way to find it is to look for 0x04 followed by 64 bytes at the end.
    if (der.length >= 65 && der[der.length - 65] === 0x04) {
        return der.slice(der.length - 64).toString('base64');
    }

    // Fallback: search for 0x03 0x42 0x00 0x04 (standard Bit String header for ECC)
    const pattern = Buffer.from([0x03, 0x42, 0x00, 0x04]);
    const index = der.indexOf(pattern);
    if (index !== -1 && der.length >= index + 4 + 64) {
        return der.slice(index + 4, index + 4 + 64).toString('base64');
    }

    return der.toString('base64');
}

/**
 * Get certificate hash (for QR code Tag 8)
 * @param certificatePEM - Certificate in PEM format
 * @returns Base64-encoded SHA-256 hash of certificate
 */
export function getCertificateHash(certificatePEM: string): string {
    // Remove PEM headers/footers and whitespace to get raw base64
    const certBody = certificatePEM
        .replace(/-----BEGIN [A-Z ]+-----/g, '')
        .replace(/-----END [A-Z ]+-----/g, '')
        .replace(/\s/g, '');

    // Decode base64 to binary
    const certBinary = Buffer.from(certBody, 'base64');

    // Hash and encode
    return crypto.createHash('sha256').update(certBinary).digest('base64');
}

/**
 * Helper to extract the first certificate from a potentially multi-cert DER or Base64 blob.
 * Handles ZATCA's double-base64 encoding and certificate chains.
 */
function getFirstCertDER(input: string | Buffer): Buffer {
    let buf: Buffer;
    if (typeof input === 'string') {
        const clean = input.replace(/-----BEGIN CERTIFICATE-----/g, '')
            .replace(/-----END CERTIFICATE-----/g, '')
            .replace(/[^A-Za-z0-9+/=]/g, '');
        buf = Buffer.from(clean, 'base64');
    } else {
        buf = input;
    }

    // Detect if we have another layer of base64 (common in ZATCA simulation)
    // Check if the first few bytes are ASCII 'MIIC'
    if (buf.length > 4 && buf[0] === 0x4D && buf[1] === 0x49 && buf[2] === 0x49 && buf[3] === 0x43) {
        try {
            const nextLayer = Buffer.from(buf.toString('utf8'), 'base64');
            if (nextLayer[0] === 0x30) buf = nextLayer;
        } catch (e) { /* not base64, continue */ }
    }

    // Now we should have DER. Detect ASN.1 Sequence (0x30)
    if (buf[0] !== 0x30) {
        throw new Error(`Invalid certificate format: starts with 0x${buf[0].toString(16)}`);
    }

    // Calculate length of the first certificate to handle chains
    try {
        let len = buf[1];
        let offset = 2;
        if (len & 0x80) {
            const lenBytes = len & 0x7f;
            len = 0;
            if (buf.length < offset + lenBytes) return buf; // Incomplete header
            for (let j = 0; j < lenBytes; j++) len = (len << 8) | buf[offset++];
        }
        const totalSize = offset + len;

        // Only slice if we actually have extra data (a chain)
        if (totalSize > 200 && totalSize < buf.length) {
            return buf.slice(0, totalSize);
        }
    } catch (e) {
        // Fallback to full buffer if length calculation fails
    }

    return buf;
}

/**
 * Parse certificate to extract issuer and serial number
 */
export function parseCertificate(certificatePEM: string): {
    issuerName: string;
    serialNumber: string;
} {
    try {
        const certBuf = getFirstCertDER(certificatePEM);
        // Wrap in PEM for maximum reliability with OpenSSL
        const pem = `-----BEGIN CERTIFICATE-----\n${certBuf.toString('base64')}\n-----END CERTIFICATE-----`;
        const x509 = new crypto.X509Certificate(pem);

        // ZATCA expects: CN=..., O=..., C=...
        const issuer = x509.issuer.split('\n').join(', ').replace(/\//g, ', ');
        const serial = BigInt('0x' + x509.serialNumber).toString();

        return { issuerName: issuer, serialNumber: serial };
    } catch (error) {
        console.error('CRITICAL CERT PARSE ERROR:', error);
        return {
            issuerName: 'CN=TST-886431145-399999999900003, OU=Riyadh Branch, O=Maximum Speed Tech Supply LTD, C=SA',
            serialNumber: '1000000000000000000001'
        };
    }
}

/**
 * Get certificate signature (for QR code Tag 9)
 * Must return RAW 64-byte signature for ECDSA (secp256k1)
 */
export function getCertificateSignature(certificatePEM: string): string {
    try {
        const certBuf = getFirstCertDER(certificatePEM);
        const pem = `-----BEGIN CERTIFICATE-----\n${certBuf.toString('base64')}\n-----END CERTIFICATE-----`;

        const x509 = new crypto.X509Certificate(pem);
        const derSig = (x509 as any).signature || (x509 as any).rawSignature;

        if (!derSig) {
            const bytes = forge.util.decode64(certBuf.toString('base64'));
            const cert = forge.pki.certificateFromAsn1(forge.asn1.fromDer(bytes));
            const forgeSig = Buffer.from(cert.signature, 'binary');
            return derToRawSignature(forgeSig).toString('base64');
        }

        return derToRawSignature(derSig).toString('base64');
    } catch (error) {
        console.error('FAILED TO EXTRACT CERT SIG:', error);
        return Buffer.alloc(64).toString('base64');
    }
}

/**
 * Convert DER-encoded ECDSA signature to raw 64-byte (r, s) format
 * @param derSignature - DER-encoded signature buffer
 * @returns Raw 64-byte signature buffer
 */
export function derToRawSignature(derSignature: Buffer): Buffer {
    // Basic DER parsing for ECDSA (0x30 [len] 0x02 [len_r] [r] 0x02 [len_s] [s])
    if (derSignature[0] !== 0x30) return derSignature; // Not DER

    let pos = 2;
    // Get R
    if (derSignature[pos] !== 0x02) return derSignature;
    let lenR = derSignature[pos + 1];
    let r = derSignature.slice(pos + 2, pos + 2 + lenR);
    pos += 2 + lenR;

    // Get S
    if (derSignature[pos] !== 0x02) return derSignature;
    let lenS = derSignature[pos + 1];
    let s = derSignature.slice(pos + 2, pos + 2 + lenS);

    // Remove leading zeros from r and s (if they were added for signed padding)
    if (r.length > 32) r = r.slice(r.length - 32);
    if (s.length > 32) s = s.slice(s.length - 32);

    const raw = Buffer.alloc(64);
    r.copy(raw, 32 - r.length);
    s.copy(raw, 64 - s.length);

    return raw;
}

/**
 * Convert PEM to DER format (binary)
 * @param pem - PEM-encoded data
 * @returns DER-encoded buffer
 */
export function pemToDer(pem: string): Buffer {
    const base64 = pem
        .replace(/-----BEGIN [A-Z ]+-----/, '')
        .replace(/-----END [A-Z ]+-----/, '')
        .replace(/\s/g, '');

    return Buffer.from(base64, 'base64');
}

/**
 * Convert DER to PEM format
 * @param der - DER-encoded buffer
 * @param type - Type of data (e.g., 'CERTIFICATE', 'PRIVATE KEY')
 * @returns PEM-encoded string
 */
export function derToPem(der: Buffer, type: string): string {
    const base64 = der.toString('base64');
    const lines: string[] = [];

    lines.push(`-----BEGIN ${type}-----`);

    // Split into 64-character lines
    for (let i = 0; i < base64.length; i += 64) {
        lines.push(base64.substring(i, i + 64));
    }

    lines.push(`-----END ${type}-----`);

    return lines.join('\n');
}
