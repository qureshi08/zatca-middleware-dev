/**
 * ZATCA Invoice XML Builder
 * Main entry point for generating UBL 2.1 compliant XML invoices
 */

import type { ZATCAInvoice, SellerParty, BuyerParty, InvoiceLine, TaxSubtotal } from '@/types/zatca';
import { generateStandardInvoiceXML } from './standard';
import { generateSimplifiedInvoiceXML } from './simplified';
import {
    generateUUID,
    formatDate,
    formatTime,
    buildTransactionCode,
    calculateLineTotals,
    calculateInvoiceTotals,
    groupVATByCategory,
} from './utils';
import { generatePreviousInvoiceHash } from '../crypto/hash';

/**
 * Simple invoice input (user-friendly format)
 */
export interface SimpleInvoiceInput {
    // Invoice details
    id?: string; // Auto-generated if not provided
    issueDate?: Date | string;
    issueTime?: string;
    type: 'standard' | 'simplified'; // B2B or B2C
    documentType?: '388' | '383' | '381' | '386'; // Invoice, Debit, Credit, Prepayment

    // Parties
    seller: SellerParty;
    buyer: BuyerParty;

    // Line items
    items: Array<{
        id?: string; // Auto-generated if not provided
        name: string;
        quantity: number;
        unitPrice: number;
        vatRate: number; // Percentage (e.g., 15 for 15%)
        vatCategory?: 'S' | 'Z' | 'E' | 'O'; // Defaults to 'S'
        exemptionCode?: string; // Required for E, Z, O
        exemptionReason?: string; // Required for E, Z, O
        unitCode?: string; // Defaults to 'PCE' (piece)
    }>;

    // Optional fields
    note?: string;
    currency?: string; // Defaults to 'SAR'
    previousInvoiceHash?: string; // For invoice chaining
    invoiceCounter?: number; // Sequential counter

    // For credit/debit notes
    originalInvoiceId?: string;
    creditReason?: string;
}

/**
 * Build complete ZATCA invoice from simple input
 */
export function buildInvoice(input: SimpleInvoiceInput): ZATCAInvoice {
    const now = new Date();
    const uuid = generateUUID();
    const invoiceId = input.id || `INV-${Date.now()}`;
    const issueDate = input.issueDate ? formatDate(input.issueDate) : formatDate(now);
    const issueTime = input.issueTime || formatTime(now);
    const currency = input.currency || 'SAR';
    const documentType = input.documentType || '388';

    // Build transaction code
    const transactionCode = buildTransactionCode({
        subtype: input.type === 'standard' ? '01' : '02',
    });

    // Process invoice lines
    const invoiceLines: InvoiceLine[] = input.items.map((item, index) => {
        const lineId = item.id || (index + 1).toString();
        const vatCategory = item.vatCategory || 'S';
        const unitCode = item.unitCode || 'PCE';

        const lineTotals = calculateLineTotals({
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
        });

        return {
            id: lineId,
            invoicedQuantity: item.quantity,
            invoicedQuantityUnitCode: unitCode,
            lineExtensionAmount: Number(lineTotals.lineExtension.toFixed(2)),
            item: {
                name: item.name,
                classifiedTaxCategory: {
                    id: vatCategory,
                    percent: item.vatRate,
                    taxScheme: {
                        id: 'VAT',
                    },
                },
            },
            price: {
                priceAmount: item.unitPrice,
            },
            taxTotal: {
                taxAmount: Number(lineTotals.vatAmount.toFixed(2)),
                roundingAmount: Number(lineTotals.lineTotal.toFixed(2)),
            },
        };
    });

    // Calculate totals (must be positive as per BR-KSA-F-04)
    const lineTotalsForCalc = invoiceLines.map((line) => ({
        lineExtension: line.lineExtensionAmount,
        vatAmount: line.taxTotal?.taxAmount || 0,
    }));
    const totals = calculateInvoiceTotals(lineTotalsForCalc);

    // Group VAT by category for tax breakdown
    const vatGroups = groupVATByCategory(
        input.items.map((item) => {
            const vatCategory = item.vatCategory || 'S';
            const lineTotals = calculateLineTotals({
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                vatRate: item.vatRate,
            });

            return {
                vatCategory,
                vatRate: item.vatRate,
                lineExtension: lineTotals.lineExtension,
                vatAmount: lineTotals.vatAmount,
            };
        })
    );

    const taxSubtotals: TaxSubtotal[] = vatGroups.map((group) => {
        const item = input.items.find((i) => (i.vatCategory || 'S') === group.category);

        return {
            taxableAmount: group.taxableAmount,
            taxAmount: group.taxAmount,
            taxCategory: {
                id: group.category as any,
                percent: group.percent,
                ...(item?.exemptionCode && { taxExemptionReasonCode: item.exemptionCode as any }),
                ...(item?.exemptionReason && { taxExemptionReason: item.exemptionReason }),
                taxScheme: {
                    id: 'VAT',
                },
            },
        };
    });

    // Build additional document references
    const additionalDocumentReference: ZATCAInvoice['additionalDocumentReference'] = [];

    // Add invoice counter (ICV)
    if (input.invoiceCounter !== undefined) {
        additionalDocumentReference.push({
            id: 'ICV',
            uuid: input.invoiceCounter.toString(),
        });
    }

    // Add previous invoice hash (PIH)
    // For first invoice, PIH is the ZATCA standard hash of '0'
    const pih = input.previousInvoiceHash || generatePreviousInvoiceHash(null);
    additionalDocumentReference.push({
        id: 'PIH',
        attachment: {
            embeddedDocumentBinaryObject: pih,
            mimeCode: 'text/plain',
        },
    });

    // QR code placeholder (will be added after signing)
    additionalDocumentReference.push({
        id: 'QR',
        attachment: {
            embeddedDocumentBinaryObject: 'QR_BASE64_PLACEHOLDER', // Temporary placeholder for regex
            mimeCode: 'text/plain',
        },
    });

    // Build the complete invoice
    const invoice: ZATCAInvoice = {
        id: invoiceId,
        uuid,
        issueDate,
        issueTime,
        invoiceTypeCode: documentType,
        invoiceTypeCodeName: transactionCode,
        documentCurrencyCode: currency,
        taxCurrencyCode: 'SAR',
        profileID: 'reporting:1.0',
        note: input.note || (input.creditReason ? `Reason for Adjustment: ${input.creditReason}` : undefined),

        // Billing reference for credit/debit notes
        ...(input.originalInvoiceId && {
            billingReference: {
                invoiceDocumentReference: {
                    id: input.originalInvoiceId,
                },
            },
        }),

        additionalDocumentReference,

        // Signature placeholder for simplified invoices
        ...(input.type === 'simplified' && {
            signature: [{
                id: 'urn:oasis:names:specification:ubl:signature:Invoice',
                signatureMethod: 'urn:oasis:names:specification:ubl:dsig:enveloped:xades',
            }],
        }),

        accountingSupplierParty: input.seller,
        accountingCustomerParty: input.buyer,

        // Delivery info (KSA-5 Supply Date) - MANDATORY for Standard Invoices
        delivery: {
            actualDeliveryDate: issueDate, // Usually same as issue date for banks
        },

        // Payment means for credit/debit notes
        ...(input.creditReason && {
            paymentMeans: {
                paymentMeansCode: '42', // Payment to bank account
                instructionNote: input.creditReason,
            },
        }),

        taxTotal: [{
            taxAmount: totals.totalVATAmount,
            taxSubtotal: taxSubtotals,
        }],

        legalMonetaryTotal: {
            lineExtensionAmount: totals.lineExtensionAmount,
            taxExclusiveAmount: totals.taxExclusiveAmount,
            taxInclusiveAmount: totals.taxInclusiveAmount,
            payableAmount: totals.payableAmount,
        },

        invoiceLine: invoiceLines,
    };

    return invoice;
}

/**
 * Generate XML from invoice data
 */
export function generateInvoiceXML(invoice: ZATCAInvoice): string {
    // Determine invoice type from transaction code
    const isSimplified = invoice.invoiceTypeCodeName.startsWith('02');

    if (isSimplified) {
        return generateSimplifiedInvoiceXML(invoice);
    } else {
        return generateStandardInvoiceXML(invoice);
    }
}

/**
 * Build and generate XML in one step
 */
export function buildAndGenerateXML(input: SimpleInvoiceInput): {
    invoice: ZATCAInvoice;
    xml: string;
} {
    const invoice = buildInvoice(input);
    const xml = generateInvoiceXML(invoice);

    return { invoice, xml };
}

/**
 * Update invoice with signature and QR code
 */
export function updateInvoiceWithSignature(
    xml: string,
    signatureXML: string,
    qrCode: string
): string {
    // Replace signature placeholder
    // We look for the ReferencedSignatureID and insert the signature block after it
    const sigAnchor = '</sbc:ReferencedSignatureID>';
    let updatedXML = xml.replace(
        sigAnchor,
        `${sigAnchor}${signatureXML}`
    );

    // Update QR code placeholder
    updatedXML = updatedXML.replace('QR_BASE64_PLACEHOLDER', qrCode);

    return updatedXML;
}

// Re-export utilities
export * from './utils';
export { generateStandardInvoiceXML } from './standard';
export { generateSimplifiedInvoiceXML } from './simplified';
