/**
 * ZATCA E-Invoicing TypeScript Definitions
 * Based on ZATCA Technical Guidelines v2.0 and Data Dictionary v1.2
 */

// ============================================================================
// INVOICE TYPES & CATEGORIES
// ============================================================================

/**
 * Invoice Type Code (BT-3)
 * UN/CEFACT code list 1001
 */
export type InvoiceTypeCode =
  | "388" // Tax Invoice / Simplified Tax Invoice
  | "383" // Debit Note
  | "381" // Credit Note
  | "386"; // Prepayment Invoice

/**
 * Invoice Subtype (KSA-2)
 * Position 1-2 of the transaction code
 */
export type InvoiceSubtype =
  | "01" // Tax Invoice (B2B)
  | "02"; // Simplified Tax Invoice (B2C)

/**
 * Invoice Transaction Code (KSA-2)
 * Format: NNPNESB (7 characters)
 * NN = Subtype (01 or 02)
 * P = Third Party (0 or 1)
 * N = Nominal (0 or 1)
 * E = Export (0 or 1)
 * S = Summary (0 or 1)
 * B = Self-Billed (0 or 1)
 */
export interface InvoiceTransactionCode {
  subtype: InvoiceSubtype;
  thirdParty: boolean;
  nominal: boolean;
  exports: boolean;
  summary: boolean;
  selfBilled: boolean;
}

/**
 * VAT Category Code (BT-118, BT-151)
 * UN/CEFACT code list 5305
 */
export type VATCategoryCode =
  | "S" // Standard rated
  | "Z" // Zero rated
  | "E" // Exempt from VAT
  | "O"; // Not subject to VAT / Services outside scope of tax

/**
 * VAT Exemption Reason Code (BT-121)
 * KSA-specific codes
 */
export type VATExemptionReasonCode =
  // Exempt from VAT (E)
  | "VATEX-SA-29" // Financial services
  | "VATEX-SA-29-7" // Life insurance
  | "VATEX-SA-30" // Real estate transactions
  // Zero rated (Z)
  | "VATEX-SA-32" // Export of goods
  | "VATEX-SA-33" // Export of services
  | "VATEX-SA-34-1" // International transport of goods
  | "VATEX-SA-34-2" // International transport of passengers
  | "VATEX-SA-34-3" // Services related to international passenger transport
  | "VATEX-SA-34-4" // Qualifying means of transport
  | "VATEX-SA-34-5" // Services relating to goods or passenger transportation
  | "VATEX-SA-35" // Medicines and medical equipment
  | "VATEX-SA-36" // Qualifying metals
  | "VATEX-SA-EDU" // Private education to citizens
  | "VATEX-SA-HEA" // Private healthcare to citizens
  | "VATEX-SA-MLTRY" // Qualified military goods
  // Not subject to VAT (O)
  | "VATEX-SA-OOS"; // Out of scope

// ============================================================================
// PARTY IDENTIFICATION
// ============================================================================

/**
 * Party Identification Scheme (BT-29-1, BT-46-1)
 */
export type PartyIdentificationScheme =
  | "TIN" // Tax Identification Number
  | "CRN" // Commercial Registration Number
  | "MOM" // MOMRAH License
  | "MLS" // MHRSD License
  | "700" // 700 Number
  | "SAG" // MISA License
  | "NAT" // National ID
  | "GCC" // GCC ID
  | "IQA" // Iqama Number
  | "PAS" // Passport ID
  | "OTH"; // Other ID

/**
 * Party Identification
 */
export interface PartyIdentification {
  id: string;
  schemeID: PartyIdentificationScheme;
}

// ============================================================================
// ADDRESS
// ============================================================================

/**
 * Postal Address (BG-5, BG-8)
 * Saudi National Address format
 */
export interface PostalAddress {
  /** Street name (BT-35, BT-50) */
  streetName: string;
  /** Additional street name (BT-36, BT-51) - Optional */
  additionalStreetName?: string;
  /** Building number (KSA-17, KSA-18) - 4 digits */
  buildingNumber: string;
  /** Additional number (KSA-23, KSA-24) - 4 digits, Optional */
  additionalNumber?: string;
  /** Plot identification (BT-39, BT-54) - Optional */
  plotIdentification?: string;
  /** City subdivision name / District (KSA-3, KSA-4) */
  citySubdivisionName: string;
  /** City name (BT-37, BT-52) */
  cityName: string;
  /** Postal zone / Postal code (BT-38, BT-53) - 5 digits */
  postalZone: string;
  /** Country subentity / Province (BT-39, BT-54) - Optional */
  countrySubentity?: string;
  /** Country code (BT-40, BT-55) - ISO 3166-1 alpha-2 */
  country: string;
}

// ============================================================================
// PARTY (SELLER / BUYER)
// ============================================================================

/**
 * Accounting Supplier Party (Seller) - BG-4
 */
export interface SellerParty {
  /** Party identification (BT-29) */
  partyIdentification: PartyIdentification;
  /** Postal address (BG-5) */
  postalAddress: PostalAddress;
  /** Party tax scheme */
  partyTaxScheme: {
    /** VAT registration number (BT-31) - 15 digits, starts and ends with '3' */
    companyID: string;
  };
  /** Party legal entity */
  partyLegalEntity: {
    /** Registration name (BT-27) */
    registrationName: string;
  };
}

/**
 * Accounting Customer Party (Buyer) - BG-7
 */
export interface BuyerParty {
  /** Party identification (BT-46) - Optional for B2C */
  partyIdentification?: PartyIdentification;
  /** Postal address (BG-8) */
  postalAddress: PostalAddress;
  /** Party tax scheme - Optional */
  partyTaxScheme?: {
    /** VAT registration number (BT-48) - 15 digits for non-export */
    companyID?: string;
  };
  /** Party legal entity */
  partyLegalEntity: {
    /** Registration name (BT-44) */
    registrationName: string;
  };
}

// ============================================================================
// LINE ITEMS
// ============================================================================

/**
 * Invoice Line Allowance/Charge (BG-27, BG-28)
 */
export interface LineAllowanceCharge {
  /** Charge indicator (true = charge, false = allowance) */
  chargeIndicator: boolean;
  /** Allowance/Charge reason code (BT-140, BT-145) */
  allowanceChargeReasonCode?: string;
  /** Allowance/Charge reason (BT-139, BT-144) */
  allowanceChargeReason?: string;
  /** Multiplier factor (percentage) (BT-138, BT-143) */
  multiplierFactorNumeric?: number;
  /** Amount (BT-136, BT-141) */
  amount: number;
  /** Base amount (BT-137, BT-142) - Optional */
  baseAmount?: number;
}

/**
 * Classified Tax Category (for line items)
 */
export interface ClassifiedTaxCategory {
  /** VAT category code (BT-151) */
  id: VATCategoryCode;
  /** VAT rate (BT-152) */
  percent: number;
  /** Tax scheme */
  taxScheme: {
    id: "VAT";
  };
}

/**
 * Item Information (BG-31)
 */
export interface Item {
  /** Item name (BT-153) */
  name: string;
  /** Buyer's item identification (BT-156) - Optional */
  buyersItemIdentification?: {
    id: string;
  };
  /** Seller's item identification (BT-155) - Optional */
  sellersItemIdentification?: {
    id: string;
  };
  /** Standard item identification (BT-157) - Optional */
  standardItemIdentification?: {
    id: string;
  };
  /** Classified tax category */
  classifiedTaxCategory: ClassifiedTaxCategory;
}

/**
 * Price Details (BG-29)
 */
export interface Price {
  /** Item net price (BT-146) */
  priceAmount: number;
  /** Item price base quantity (BT-149) - Optional, default 1 */
  baseQuantity?: number;
  /** Item price discount (BT-147) - Optional */
  allowanceCharge?: {
    chargeIndicator: false;
    amount: number;
    baseAmount: number; // Item gross price (BT-148)
  };
}

/**
 * Invoice Line (BG-25)
 */
export interface InvoiceLine {
  /** Invoice line identifier (BT-126) */
  id: string;
  /** Invoice line note (BT-127) - Optional */
  note?: string;
  /** Invoiced quantity (BT-129) */
  invoicedQuantity: number;
  /** Invoiced quantity unit code (BT-130) */
  invoicedQuantityUnitCode: string;
  /** Invoice line net amount (BT-131) */
  lineExtensionAmount: number;
  /** Invoice line allowances (BG-27) - Optional */
  allowanceCharges?: LineAllowanceCharge[];
  /** Item information (BG-31) */
  item: Item;
  /** Price details (BG-29) */
  price: Price;
  /** Line VAT amount (KSA-11) - Required for Tax Invoice */
  taxTotal?: {
    taxAmount: number;
    roundingAmount: number; // Line amount with VAT (KSA-12)
  };
}

// ============================================================================
// DOCUMENT LEVEL ALLOWANCES/CHARGES
// ============================================================================

/**
 * Document Level Allowance/Charge (BG-20, BG-21)
 */
export interface DocumentAllowanceCharge {
  /** Charge indicator (true = charge, false = allowance) */
  chargeIndicator: boolean;
  /** Allowance/Charge reason code (BT-98, BT-105) */
  allowanceChargeReasonCode: string;
  /** Allowance/Charge reason (BT-97, BT-104) */
  allowanceChargeReason: string;
  /** Multiplier factor (percentage) (BT-94, BT-101) - Optional */
  multiplierFactorNumeric?: number;
  /** Amount (BT-92, BT-99) */
  amount: number;
  /** Base amount (BT-93, BT-100) - Optional */
  baseAmount?: number;
  /** Tax category */
  taxCategory: {
    /** VAT category code (BT-95, BT-102) */
    id: VATCategoryCode;
    /** VAT rate (BT-96, BT-103) */
    percent: number;
    taxScheme: {
      id: "VAT";
    };
  };
}

// ============================================================================
// VAT BREAKDOWN
// ============================================================================

/**
 * VAT Breakdown (BG-23)
 */
export interface TaxSubtotal {
  /** VAT category taxable amount (BT-116) */
  taxableAmount: number;
  /** VAT category tax amount (BT-117) */
  taxAmount: number;
  /** Tax category */
  taxCategory: {
    /** VAT category code (BT-118) */
    id: VATCategoryCode;
    /** VAT category rate (BT-119) */
    percent: number;
    /** VAT exemption reason code (BT-121) - Required for E, Z, O */
    taxExemptionReasonCode?: VATExemptionReasonCode;
    /** VAT exemption reason text (BT-120) - Required for E, Z, O */
    taxExemptionReason?: string;
    taxScheme: {
      id: "VAT";
    };
  };
}

/**
 * Tax Total (BG-22)
 */
export interface TaxTotal {
  /** Invoice total VAT amount (BT-110) */
  taxAmount: number;
  /** VAT breakdown */
  taxSubtotal: TaxSubtotal[];
}

// ============================================================================
// DOCUMENT TOTALS
// ============================================================================

/**
 * Legal Monetary Total (BG-22)
 */
export interface LegalMonetaryTotal {
  /** Sum of invoice line net amount (BT-106) */
  lineExtensionAmount: number;
  /** Sum of allowances on document level (BT-107) - Optional */
  allowanceTotalAmount?: number;
  /** Sum of charges on document level (BT-108) - Optional */
  chargeTotalAmount?: number;
  /** Invoice total amount without VAT (BT-109) */
  taxExclusiveAmount: number;
  /** Invoice total amount with VAT (BT-112) */
  taxInclusiveAmount: number;
  /** Pre-paid amount (BT-113) - Optional */
  prepaidAmount?: number;
  /** Rounding amount (BT-114) - Optional */
  payableRoundingAmount?: number;
  /** Amount due for payment (BT-115) */
  payableAmount: number;
}

// ============================================================================
// PREPAYMENT
// ============================================================================

/**
 * Prepayment Document Reference (KSA-26 to KSA-34)
 */
export interface PrepaymentDocumentReference {
  /** Prepayment ID (KSA-26) - Invoice number of prepayment invoice */
  id: string;
  /** Prepayment issue date (KSA-28) */
  issueDate: string;
  /** Prepayment issue time (KSA-29) */
  issueTime: string;
  /** Prepayment document type code (KSA-30) - Must be '386' */
  documentTypeCode: "386";
}

/**
 * Prepayment Tax Subtotal (for invoice line)
 */
export interface PrepaymentTaxSubtotal {
  /** Prepayment VAT category taxable amount (KSA-31) */
  taxableAmount: number;
  /** Prepayment VAT category tax amount (KSA-32) */
  taxAmount: number;
  taxCategory: {
    /** Prepayment VAT category code (KSA-33) */
    id: VATCategoryCode;
    /** Prepayment VAT rate (KSA-34) */
    percent: number;
    taxScheme: {
      id: "VAT";
    };
  };
}

// ============================================================================
// MAIN INVOICE STRUCTURE
// ============================================================================

/**
 * Complete Invoice Structure
 * Based on UBL 2.1 and ZATCA requirements
 */
export interface ZATCAInvoice {
  /** Invoice number (BT-1) */
  id: string;
  /** UUID (KSA-1) - Unique identifier for the invoice */
  uuid: string;
  /** Issue date (BT-2) - Format: YYYY-MM-DD */
  issueDate: string;
  /** Issue time (KSA-25) - Format: HH:MM:SS or HH:MM:SSZ */
  issueTime: string;
  /** Invoice type code (BT-3) */
  invoiceTypeCode: InvoiceTypeCode;
  /** Invoice transaction code (KSA-2) */
  invoiceTypeCodeName: string; // 7-character transaction code
  /** Document currency code (BT-5) - ISO 4217 */
  documentCurrencyCode: string;
  /** Tax currency code (BT-6) - Must be 'SAR' */
  taxCurrencyCode: "SAR";
  /** Invoice note (BT-22) - Optional */
  note?: string;
  /** Business process (BT-23) - Must be 'reporting:1.0' */
  profileID: "reporting:1.0";

  /** Billing reference (BG-3) - Required for credit/debit notes */
  billingReference?: {
    invoiceDocumentReference: {
      /** Preceding invoice reference (BT-25) */
      id: string;
    };
  };

  /** Additional document references */
  additionalDocumentReference: Array<{
    id: string;
    uuid?: string; // Invoice counter value (KSA-16)
    attachment?: {
      /** Previous invoice hash (KSA-13) or QR code (KSA-14) */
      embeddedDocumentBinaryObject: string;
      mimeCode?: string;
    };
  }>;

  /** Signature (KSA-15) - Required for simplified invoices */
  signature?: Array<{
    id: string;
    signatureMethod: string;
  }>;

  /** Accounting supplier party (Seller) - BG-4 */
  accountingSupplierParty: SellerParty;

  /** Accounting customer party (Buyer) - BG-7 */
  accountingCustomerParty: BuyerParty;

  /** Delivery information (BG-13) - Optional */
  delivery?: {
    /** Actual delivery date / Supply date (KSA-5) */
    actualDeliveryDate?: string;
    /** Latest delivery date / Supply end date (KSA-24) - Optional */
    latestDeliveryDate?: string;
  };

  /** Payment means (BG-16) - Optional */
  paymentMeans?: {
    /** Payment means type code (BT-81) */
    paymentMeansCode: string;
    /** Payment means instruction note (KSA-10) - Reason for credit/debit note */
    instructionNote?: string;
  };

  /** Document level allowances/charges (BG-20, BG-21) - Optional */
  allowanceCharge?: DocumentAllowanceCharge[];

  /** Tax total (BG-22) */
  taxTotal: TaxTotal[];

  /** Legal monetary total (BG-22) */
  legalMonetaryTotal: LegalMonetaryTotal;

  /** Invoice lines (BG-25) */
  invoiceLine: InvoiceLine[];
}

// ============================================================================
// CSR (Certificate Signing Request) CONFIGURATION
// ============================================================================

/**
 * CSR Configuration for Onboarding
 */
export interface CSRConfig {
  /** Common Name - Name or Asset Tracking Number for the Solution Unit */
  commonName: string;
  /** Serial Number - Manufacturer, Model/Version, and Serial Number */
  serialNumber: string;
  /** Organization Identifier - VAT or Group VAT Registration Number (15 digits) */
  organizationIdentifier: string;
  /** Organization Unit Name - Branch name or 10-digit TIN for VAT groups */
  organizationUnitName: string;
  /** Organization Name - Taxpayer Name */
  organizationName: string;
  /** Country Name - 2-letter ISO 3166 Alpha-2 code */
  countryName: string;
  /** Invoice Type - Functionality Map (e.g., '1000', '0100', '1100') */
  invoiceType: string;
  /** Location - Address of branch or EGS unit */
  location: string;
  /** Industry - Industry or sector */
  industry: string;
}

// ============================================================================
// API RESPONSES
// ============================================================================

/**
 * ZATCA API Response for Clearance/Reporting
 */
export interface ZATCAAPIResponse {
  /** Validation status */
  validationResults: {
    status: "PASS" | "FAIL" | "WARNING";
    infoMessages?: string[];
    warningMessages?: string[];
    errorMessages?: string[];
  };
  /** Cleared invoice (for clearance) */
  clearedInvoice?: string;
  /** QR code (for clearance) */
  qrCode?: string;
  /** Invoice hash */
  invoiceHash?: string;
}

/**
 * Onboarding Response
 */
export interface OnboardingResponse {
  /** Compliance CSID or Production CSID */
  binarySecurityToken: string;
  /** Secret for API authentication */
  secret: string;
  /** Request ID */
  requestID: string;
}
