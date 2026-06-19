/**
 * XML Generation Utilities
 * Helper functions for UBL 2.1 XML generation
 */

/**
 * Format decimal to 2 decimal places
 */
export function formatDecimal(value: number = 0): string {
    return (value || 0).toFixed(2);
}

/**
 * Format date to YYYY-MM-DD (Local Time to avoid BT-2 future date errors)
 */
export function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Format time to HH:MM:SS (Local Time)
 */
export function formatTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

/**
 * Format timestamp to ISO 8601
 */
export function formatTimestamp(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

/**
 * Generate UUID v4
 */
export function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Build invoice transaction code (KSA-2)
 * Format: NNPNESB (7 characters)
 */
export function buildTransactionCode(params: {
    subtype: '01' | '02'; // 01=Standard, 02=Simplified
    thirdParty?: boolean;
    nominal?: boolean;
    exports?: boolean;
    summary?: boolean;
    selfBilled?: boolean;
}): string {
    const {
        subtype,
        thirdParty = false,
        nominal = false,
        exports = false,
        summary = false,
        selfBilled = false,
    } = params;

    return (
        subtype +
        (thirdParty ? '1' : '0') +
        (nominal ? '1' : '0') +
        (exports ? '1' : '0') +
        (summary ? '1' : '0') +
        (selfBilled ? '1' : '0')
    );
}

/**
 * Calculate line totals
 */
export function calculateLineTotals(params: {
    quantity: number;
    unitPrice: number;
    vatRate: number;
    allowances?: number;
    charges?: number;
}) {
    const { quantity, unitPrice, vatRate, allowances = 0, charges = 0 } = params;

    const lineExtension = quantity * unitPrice;
    const lineExtensionWithAdjustments = lineExtension - allowances + charges;
    const vatAmount = (lineExtensionWithAdjustments * vatRate) / 100;
    const lineTotal = lineExtensionWithAdjustments + vatAmount;

    return {
        lineExtension: Number(lineExtension.toFixed(2)),
        lineExtensionWithAdjustments: Number(lineExtensionWithAdjustments.toFixed(2)),
        vatAmount: Number(vatAmount.toFixed(2)),
        lineTotal: Number(lineTotal.toFixed(2)),
    };
}

/**
 * Calculate invoice totals
 */
export function calculateInvoiceTotals(lines: Array<{
    lineExtension: number;
    vatAmount: number;
}>, params?: {
    documentAllowances?: number;
    documentCharges?: number;
    prepaidAmount?: number;
}) {
    const { documentAllowances = 0, documentCharges = 0, prepaidAmount = 0 } = params || {};

    const lineExtensionAmount = lines.reduce((sum, line) => sum + line.lineExtension, 0);
    const taxExclusiveAmount = lineExtensionAmount - documentAllowances + documentCharges;
    const totalVATAmount = lines.reduce((sum, line) => sum + line.vatAmount, 0);
    const taxInclusiveAmount = taxExclusiveAmount + totalVATAmount;
    const payableAmount = taxInclusiveAmount - prepaidAmount;

    return {
        lineExtensionAmount: Number(lineExtensionAmount.toFixed(2)),
        allowanceTotalAmount: documentAllowances > 0 ? Number(documentAllowances.toFixed(2)) : undefined,
        chargeTotalAmount: documentCharges > 0 ? Number(documentCharges.toFixed(2)) : undefined,
        taxExclusiveAmount: Number(taxExclusiveAmount.toFixed(2)),
        taxInclusiveAmount: Number(taxInclusiveAmount.toFixed(2)),
        prepaidAmount: prepaidAmount > 0 ? Number(prepaidAmount.toFixed(2)) : undefined,
        payableAmount: Number(payableAmount.toFixed(2)),
        totalVATAmount: Number(totalVATAmount.toFixed(2)),
    };
}

/**
 * Group VAT by category for tax breakdown
 */
export function groupVATByCategory(lines: Array<{
    vatCategory: string;
    vatRate: number;
    lineExtension: number;
    vatAmount: number;
}>) {
    const groups = new Map<string, {
        taxableAmount: number;
        taxAmount: number;
        percent: number;
    }>();

    lines.forEach((line) => {
        const key = `${line.vatCategory}-${line.vatRate}`;
        const existing = groups.get(key) || { taxableAmount: 0, taxAmount: 0, percent: line.vatRate };

        existing.taxableAmount += line.lineExtension;
        existing.taxAmount += line.vatAmount;

        groups.set(key, existing);
    });

    return Array.from(groups.entries()).map(([key, value]) => ({
        category: key.split('-')[0],
        percent: value.percent,
        taxableAmount: Number(value.taxableAmount.toFixed(2)),
        taxAmount: Number(value.taxAmount.toFixed(2)),
    }));
}

/**
 * Validate VAT number format (15 digits, starts and ends with 3)
 */
export function validateVATNumber(vat: string): boolean {
    return /^3\d{13}3$/.test(vat);
}

/**
 * Validate building number (4 digits)
 */
export function validateBuildingNumber(building: string): boolean {
    return /^\d{4}$/.test(building);
}

/**
 * Validate postal code (5 digits)
 */
export function validatePostalCode(postal: string): boolean {
    return /^\d{5}$/.test(postal);
}
