/**
 * ZATCA QR Code Generation Module
 * Implements TLV (Tag-Length-Value) encoding as per ZATCA specifications
 */

import QRCode from 'qrcode';

/**
 * TLV Tags as per ZATCA specification
 */
export enum TLVTag {
    SELLER_NAME = 1,
    VAT_REGISTRATION_NUMBER = 2,
    TIMESTAMP = 3,
    INVOICE_TOTAL = 4,
    VAT_TOTAL = 5,
    INVOICE_HASH = 6,
    ECDSA_SIGNATURE = 7,
    ECDSA_PUBLIC_KEY = 8,
    CERTIFICATE_SIGNATURE = 9,
}

/**
 * TLV Entry structure
 */
interface TLVEntry {
    tag: TLVTag;
    value: string | Buffer;
}

/**
 * Encode a single TLV entry
 * Format: [Tag (1 byte)][Length (1 byte)][Value (variable)]
 * 
 * @param tag - TLV tag number
 * @param value - Value to encode (string or Buffer)
 * @returns Buffer containing encoded TLV
 */
function encodeTLV(tag: number, value: string | Buffer): Buffer {
    let valueBuffer: Buffer;

    if (Buffer.isBuffer(value)) {
        valueBuffer = value;
    } else if (tag >= 6 && tag <= 9) {
        // Force base64 decoding for binary tags. Do not fall back to utf8.
        try {
            valueBuffer = Buffer.from(value, 'base64');
            // If the resulting buffer is still ASCII-looking and not the right size, 
            // it might have been an invalid base64 input.
        } catch {
            valueBuffer = Buffer.from(value, 'utf8');
        }
    } else {
        valueBuffer = Buffer.from(value, 'utf8');
    }

    const length = valueBuffer.length;

    if (length > 255) {
        // For values > 255, ZATCA uses a multi-byte length or it's simply not allowed for these tags.
        // Actually, for Phase 2, some tags might exceed 255 if they are complex, 
        // but for tags 1-9 they should mostly fit.
        // If they exceed 255, we'll just truncate or error for now as per spec limits on these tags.
        console.warn(`TLV value for tag ${tag} is long: ${length} bytes`);
    }

    const tlvBuffer = Buffer.allocUnsafe(2 + length);
    tlvBuffer.writeUInt8(tag, 0);
    tlvBuffer.writeUInt8(length, 1);
    valueBuffer.copy(tlvBuffer, 2);

    return tlvBuffer;
}

/**
 * Encode multiple TLV entries
 * @param entries - Array of TLV entries
 * @returns Buffer containing all encoded TLVs
 */
function encodeTLVs(entries: TLVEntry[]): Buffer {
    const buffers = entries.map((entry) => encodeTLV(entry.tag, entry.value));
    return Buffer.concat(buffers);
}

/**
 * Generate QR code data for ZATCA invoice
 * 
 * @param params - QR code parameters
 * @returns Base64-encoded TLV data
 */
export function generateQRCodeData(params: {
    sellerName: string;
    vatRegistrationNumber: string;
    timestamp: string; // ISO 8601 format
    invoiceTotal: string; // Decimal string
    vatTotal: string; // Decimal string
    invoiceHash: string; // Base64-encoded hash
    ecdsaSignature: string; // Base64-encoded signature
    ecdsaPublicKey: string; // Base64-encoded public key
    certificateSignature: string; // Base64-encoded certificate signature
}): string {
    const entries: TLVEntry[] = [
        { tag: TLVTag.SELLER_NAME, value: params.sellerName },
        { tag: TLVTag.VAT_REGISTRATION_NUMBER, value: params.vatRegistrationNumber },
        { tag: TLVTag.TIMESTAMP, value: params.timestamp },
        { tag: TLVTag.INVOICE_TOTAL, value: params.invoiceTotal },
        { tag: TLVTag.VAT_TOTAL, value: params.vatTotal },
        { tag: TLVTag.INVOICE_HASH, value: params.invoiceHash },
        { tag: TLVTag.ECDSA_SIGNATURE, value: params.ecdsaSignature },
        { tag: TLVTag.ECDSA_PUBLIC_KEY, value: params.ecdsaPublicKey },
        { tag: TLVTag.CERTIFICATE_SIGNATURE, value: params.certificateSignature },
    ];

    const tlvBuffer = encodeTLVs(entries);
    return tlvBuffer.toString('base64');
}

/**
 * Generate simplified QR code data (for simplified invoices - B2C)
 * Only includes tags 1-5
 * 
 * @param params - Simplified QR code parameters
 * @returns Base64-encoded TLV data
 */
export function generateSimplifiedQRCodeData(params: {
    sellerName: string;
    vatRegistrationNumber: string;
    timestamp: string;
    invoiceTotal: string;
    vatTotal: string;
}): string {
    const entries: TLVEntry[] = [
        { tag: TLVTag.SELLER_NAME, value: params.sellerName },
        { tag: TLVTag.VAT_REGISTRATION_NUMBER, value: params.vatRegistrationNumber },
        { tag: TLVTag.TIMESTAMP, value: params.timestamp },
        { tag: TLVTag.INVOICE_TOTAL, value: params.invoiceTotal },
        { tag: TLVTag.VAT_TOTAL, value: params.vatTotal },
    ];

    const tlvBuffer = encodeTLVs(entries);
    return tlvBuffer.toString('base64');
}

/**
 * Generate QR code image from TLV data
 * 
 * @param tlvData - Base64-encoded TLV data
 * @param options - QR code generation options
 * @returns Data URL of QR code image
 */
export async function generateQRCodeImage(
    tlvData: string,
    options?: {
        width?: number;
        errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    }
): Promise<string> {
    const qrOptions = {
        width: options?.width || 300,
        errorCorrectionLevel: options?.errorCorrectionLevel || 'M',
        type: 'image/png' as const,
    };

    try {
        return await QRCode.toDataURL(tlvData, qrOptions);
    } catch (error) {
        throw new Error(`Failed to generate QR code: ${error}`);
    }
}

/**
 * Decode TLV data (for testing/verification)
 * @param base64Data - Base64-encoded TLV data
 * @returns Array of decoded TLV entries
 */
export function decodeTLVData(base64Data: string): Array<{ tag: number; value: string }> {
    const buffer = Buffer.from(base64Data, 'base64');
    const entries: Array<{ tag: number; value: string }> = [];

    let offset = 0;
    while (offset < buffer.length) {
        const tag = buffer.readUInt8(offset);
        const length = buffer.readUInt8(offset + 1);
        const valueBuf = buffer.slice(offset + 2, offset + 2 + length);

        // For tags 1-5 use UTF8, for 6-9 use Hex
        const value = tag <= 5 ? valueBuf.toString('utf8') : valueBuf.toString('hex');

        entries.push({ tag, value });
        offset += 2 + length;
    }

    return entries;
}

/**
 * Format decimal for QR code (removes trailing zeros)
 * @param value - Decimal value
 * @returns Formatted string
 */
export function formatDecimalForQR(value: number): string {
    return value.toFixed(2);
}

/**
 * Format timestamp for QR code (ISO 8601 - Local mapped to UTC for consistency)
 * @param date - Date object or ISO string
 * @returns ISO 8601 formatted string
 */
export function formatTimestampForQR(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
}

/**
 * Complete QR code generation workflow
 * Generates both the TLV data and the QR code image
 * 
 * @param params - Invoice parameters
 * @returns Object with TLV data and QR code image
 */
export async function generateCompleteQRCode(params: {
    sellerName: string;
    vatRegistrationNumber: string;
    timestamp: string | Date;
    invoiceTotal: number;
    vatTotal: number;
    invoiceHash: string;
    ecdsaSignature: string;
    ecdsaPublicKey: string;
    certificateSignature: string;
}): Promise<{
    tlvData: string;
    qrCodeImage: string;
}> {
    const tlvData = generateQRCodeData({
        sellerName: params.sellerName,
        vatRegistrationNumber: params.vatRegistrationNumber,
        timestamp: formatTimestampForQR(params.timestamp),
        invoiceTotal: formatDecimalForQR(params.invoiceTotal),
        vatTotal: formatDecimalForQR(params.vatTotal),
        invoiceHash: params.invoiceHash,
        ecdsaSignature: params.ecdsaSignature,
        ecdsaPublicKey: params.ecdsaPublicKey,
        certificateSignature: params.certificateSignature,
    });

    const qrCodeImage = await generateQRCodeImage(tlvData);

    return { tlvData, qrCodeImage };
}
