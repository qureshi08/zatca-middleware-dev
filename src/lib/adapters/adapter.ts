/**
 * Accounting-software adapter contract.
 *
 * The ZATCA core is written once; each accounting software (Odoo, Zoho, …future)
 * implements this interface. The core/pipeline never knows which ERP it's talking
 * to. Mode B (custom systems) bypasses adapters and posts a CanonicalInvoice directly.
 *
 * See docs/05-Architecture.md §4.
 */

export type AdapterId = "odoo" | "zoho";

export interface ConnectionResult {
  ok: boolean;
  message: string;
}

export interface FieldStatus {
  ok: boolean;
  missing: string[]; // names of custom fields not yet present in the ERP
  message: string;
}

/** Reference used to pull a document from the ERP (pull mode). */
export interface ErpDocumentRef {
  entityType: "invoice" | "creditnote" | "debitnote";
  erpId: string; // the ERP's internal id
}

/** Result of compliance processing, written back into the ERP. */
export interface ComplianceResult {
  status: "cleared" | "reported" | "failed";
  uuid?: string;
  qrCode?: string;
  signedXml?: string;
  pdfBase64?: string;
  documentType?: string; // 388 | 381 | 383
  error?: string;
}

/**
 * Every accounting-software adapter implements this. `toCanonical` maps the ERP's
 * native document into the shared ZATCA invoice model consumed by the core
 * (see src/types/zatca.ts → ZATCAInvoice). Typed loosely here to avoid coupling the
 * contract to a specific core revision during the merge; tightened in the core wiring.
 */
export interface AccountingAdapter {
  readonly id: AdapterId;

  /** Verify stored credentials can reach the ERP. */
  testConnection(config: unknown): Promise<ConnectionResult>;

  /** Ensure/verify the x_zatca_* / cf_zatca_* write-back fields exist. */
  provisionOrVerifyFields(config: unknown): Promise<FieldStatus>;

  /** Pull mode: fetch the full document from the ERP. */
  fetchInvoice(config: unknown, ref: ErpDocumentRef): Promise<unknown>;

  /** Map an ERP document into the canonical ZATCA invoice model. */
  toCanonical(doc: unknown): unknown;

  /** Write the compliance result back into the ERP (fields + attachments + note). */
  writeBack(config: unknown, ref: ErpDocumentRef, result: ComplianceResult): Promise<void>;
}
