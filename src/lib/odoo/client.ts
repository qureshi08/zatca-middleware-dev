// ODOO JSON-RPC CLIENT (Z3C v9.8)
// Communicates with Odoo instances over standard JSON-RPC protocol.

export interface OdooConfig {
    odooUrl: string;
    odooDb: string;
    odooUsername: string;
    odooPassword?: string; // Odoo User Password or API Key
}

export class OdooClient {
    private url: string;
    private db: string;
    private username: string;
    private password?: string;
    private userId: number | null = null;

    constructor(config: OdooConfig) {
        this.url = config.odooUrl.replace(/\/$/, ''); // Remove trailing slash
        this.db = config.odooDb;
        this.username = config.odooUsername;
        this.password = config.odooPassword;
    }

    /**
     * Executes a JSON-RPC request to Odoo.
     */
    private async request(service: string, method: string, args: any[]): Promise<any> {
        const endpoint = `${this.url}/jsonrpc`;
        const payload = {
            jsonrpc: '2.0',
            method: 'call',
            params: {
                service,
                method,
                args,
            },
            id: Math.floor(Math.random() * 1000000),
        };

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                cache: 'no-store'
            });

            if (!res.ok) {
                throw new Error(`Odoo HTTP error: ${res.status} ${res.statusText}`);
            }

            const json = await res.json();
            if (json.error) {
                console.error('[Odoo JSON-RPC Error]:', json.error);
                throw new Error(json.error.message || 'Odoo RPC Error');
            }

            return json.result;
        } catch (e: any) {
            console.warn('[Odoo Connection Failure]:', e.message);
            
            // Mock/simulation bypass — ONLY for explicit test sentinels, never for a
            // real tenant. (A real Odoo named "convergentbt" must surface real errors,
            // not silently fall back to fake data, or diagnosis becomes impossible.)
            if (this.url.includes('mock') || this.password === 'password123') {
                console.log(`[Odoo Client] Simulated Mock Mode triggered for URL: ${this.url}, DB: ${this.db}`);
                if (service === 'common' && method === 'authenticate') {
                    return 1; // Mock User ID
                }
                if (service === 'object' && method === 'execute_kw') {
                    const model = args[3];
                    const kwMethod = args[4];
                    const kwArgs = args[5];
                    
                    if (model === 'ir.model' && kwMethod === 'search_read') {
                        return [{ id: 42 }];
                    }
                    if (model === 'ir.model.fields' && kwMethod === 'search_count') {
                        return 0; // Pretend fields do not exist yet so they can be created
                    }
                    if (model === 'ir.model.fields' && kwMethod === 'create') {
                        return 100 + Math.floor(Math.random() * 1000);
                    }
                    if (model === 'account.move' && kwMethod === 'read') {
                        return [{
                            id: kwArgs[0]?.[0] || 1,
                            name: 'INV/2026/00001',
                            move_type: 'out_invoice',
                            currency_id: [1, 'SAR'],
                            partner_id: [2, 'Test Buyer'],
                            invoice_line_ids: [10],
                            amount_total: 1150.00,
                            amount_untaxed: 1000.00,
                            amount_tax: 150.00,
                            x_zatca_status: 'pending'
                        }];
                    }
                    if (model === 'account.move' && kwMethod === 'write') {
                        return true;
                    }
                    if (model === 'ir.attachment') {
                        if (kwMethod === 'search') return [];
                        if (kwMethod === 'unlink') return true;
                        if (kwMethod === 'create') return 12345;
                    }
                    if (model === 'mail.message' && kwMethod === 'create') {
                        return 999;
                    }
                    return [];
                }
            }
            
            throw new Error(`Failed to reach Odoo at ${this.url}: ${e.message}`);
        }
    }

    /**
     * Authenticates with Odoo and retrieves the User ID.
     */
    async authenticate(): Promise<number> {
        if (!this.password) {
            throw new Error('Odoo password or API key is required for authentication');
        }
        
        console.log(`[Odoo] Authenticating user ${this.username} on database ${this.db}...`);
        const uid = await this.request('common', 'authenticate', [
            this.db,
            this.username,
            this.password,
            {}, // Empty environment info dict
        ]);

        if (!uid || typeof uid !== 'number') {
            throw new Error('Authentication failed: Invalid credentials or database name.');
        }

        this.userId = uid;
        return uid;
    }

    /**
     * Helper to execute a model method.
     */
    async execute(model: string, method: string, args: any[], kwargs: Record<string, any> = {}): Promise<any> {
        if (!this.userId) {
            await this.authenticate();
        }

        return await this.request('object', 'execute_kw', [
            this.db,
            this.userId,
            this.password,
            model,
            method,
            args,
            kwargs,
        ]);
    }

    /**
     * Tests the connection by attempting authentication.
     */
    async testConnection(): Promise<{ success: boolean; uid?: number; error?: string }> {
        try {
            const uid = await this.authenticate();
            return { success: true, uid };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Automatically provisions custom fields required for ZATCA in Odoo.
     * Table: account.move (Invoice Model)
     */
    async provisionCustomFields(): Promise<{ success: boolean; created: string[]; errors: string[] }> {
        const fieldsToCreate = [
            { name: 'x_zatca_uuid', field_description: 'ZATCA Clearance UUID', ttype: 'char' },
            { name: 'x_zatca_status', field_description: 'ZATCA Clearance Status', ttype: 'selection', selection: "[('pending','Pending'),('submitted','Submitted'),('cleared','Cleared'),('failed','Failed')]" },
            { name: 'x_zatca_qr_code', field_description: 'ZATCA QR Code (Base64)', ttype: 'text' },
            { name: 'x_zatca_xml', field_description: 'ZATCA Signed XML', ttype: 'text' },
            { name: 'x_zatca_error', field_description: 'ZATCA Last Error', ttype: 'text' },
            { name: 'x_zatca_document_type', field_description: 'ZATCA Document Type', ttype: 'selection', selection: "[('388','Tax Invoice'),('381','Credit Note'),('383','Debit Note')]" },
        ];

        const created: string[] = [];
        const errors: string[] = [];

        try {
            // 1. Authenticate first
            await this.authenticate();

            // Find the model ID for account.move
            const models = await this.execute('ir.model', 'search_read', [
                [['model', '=', 'account.move']],
                ['id']
            ]);

            if (!models || models.length === 0) {
                throw new Error('Odoo model "account.move" not found.');
            }
            const modelId = models[0].id;

            // 2. Loop and create each field if it doesn't exist
            for (const f of fieldsToCreate) {
                const existing = await this.execute('ir.model.fields', 'search_count', [
                    [['model_id', '=', modelId], ['name', '=', f.name]]
                ]);

                if (existing > 0) {
                    console.log(`[Odoo] Field ${f.name} already exists.`);
                    created.push(`${f.name} (exists)`);
                    continue;
                }

                try {
                    const fieldVal: Record<string, any> = {
                        name: f.name,
                        field_description: f.field_description,
                        model_id: modelId,
                        ttype: f.ttype,
                    };
                    if (f.selection) {
                        fieldVal.selection = f.selection;
                    }

                    await this.execute('ir.model.fields', 'create', [fieldVal]);
                    console.log(`[Odoo] Field ${f.name} created successfully.`);
                    created.push(f.name);
                } catch (err: any) {
                    console.error(`[Odoo] Failed to create field ${f.name}:`, err.message);
                    errors.push(`${f.name}: ${err.message}`);
                }
            }

            return { success: errors.length === 0, created, errors };
        } catch (e: any) {
            return { success: false, created, errors: [e.message] };
        }
    }

    /**
     * Fully provisions Odoo so posted customer invoices are auto-sent to this
     * middleware — over the same JSON-RPC channel, so the user never has to click
     * through Odoo's Server Action / Automated Action screens.
     *
     * It (1) installs the `base_automation` module if missing (this is what adds the
     * "Automated Actions" menu — fresh Odoo databases often lack it), (2) creates or
     * repoints a native "Send Webhook Notification" server action to `webhookUrl`,
     * and (3) creates or updates the automated action that fires it on posted
     * customer invoices/credit notes. Idempotent and version-aware (Odoo 17+).
     */
    async provisionAutomation(webhookUrl: string): Promise<{ success: boolean; steps: string[]; errors: string[] }> {
        const steps: string[] = [];
        const errors: string[] = [];
        const ACTION_NAME = 'ZATCA Auto-Clearance';
        const RULE_NAME = 'ZATCA on Posted Invoice';
        // Only posted customer invoices and credit notes — not vendor bills or journal entries.
        const FILTER_DOMAIN = "[('state','=','posted'),('move_type','in',['out_invoice','out_refund'])]";

        try {
            await this.authenticate();

            // 1. Ensure the base_automation module (the "Automation Rules" app) is installed.
            try {
                const mods = await this.execute('ir.module.module', 'search_read', [
                    [['name', '=', 'base_automation']], ['id', 'state']
                ]);
                if (!mods || mods.length === 0) {
                    errors.push('The "Automation Rules" (base_automation) module is not available in this Odoo.');
                } else if (mods[0].state !== 'installed') {
                    await this.execute('ir.module.module', 'button_immediate_install', [[mods[0].id]]);
                    steps.push('Installed the "Automation Rules" module (adds the Automated Actions menu).');
                } else {
                    steps.push('Automation Rules module already installed.');
                }
            } catch (e: any) {
                errors.push(`Module install failed (install "Automation Rules" from Apps, then retry): ${e.message}`);
            }

            // 2. Resolve the account.move model id.
            const models = await this.execute('ir.model', 'search_read', [
                [['model', '=', 'account.move']], ['id']
            ]);
            if (!models || models.length === 0) throw new Error('Model account.move not found in this Odoo.');
            const modelId = models[0].id;

            // 3. Confirm this Odoo supports native webhook server actions (Odoo 17+).
            const saFields = await this.execute('ir.actions.server', 'fields_get', [[], ['type']]);
            if (!saFields || !('webhook_url' in saFields)) {
                errors.push('This Odoo version has no native "Send Webhook Notification" action (needs Odoo 17+). Use the manual guide below.');
                return { success: false, steps, errors };
            }

            // 4. Create or repoint the webhook server action.
            let serverActionId: number;
            const existingActions = await this.execute('ir.actions.server', 'search_read', [
                [['name', '=', ACTION_NAME], ['model_id', '=', modelId]], ['id']
            ]);
            if (existingActions && existingActions.length > 0) {
                serverActionId = existingActions[0].id;
                await this.execute('ir.actions.server', 'write', [
                    [serverActionId], { state: 'webhook', webhook_url: webhookUrl }
                ]);
                steps.push(`Repointed existing "${ACTION_NAME}" action to the middleware URL.`);
            } else {
                serverActionId = await this.execute('ir.actions.server', 'create', [{
                    name: ACTION_NAME,
                    model_id: modelId,
                    state: 'webhook',
                    webhook_url: webhookUrl,
                }]);
                steps.push(`Created webhook server action "${ACTION_NAME}".`);
            }

            // 5. Create or update the automated action that fires it on posted invoices.
            const baFields = await this.execute('base.automation', 'fields_get', [[], ['type']]);

            // Pick a trigger value this Odoo version actually supports.
            let trigger = 'on_create_or_write';
            const trigSelection = baFields?.trigger?.selection;
            if (Array.isArray(trigSelection)) {
                const allowed = trigSelection.map((s: any) => s[0]);
                if (!allowed.includes(trigger)) {
                    trigger = allowed.includes('on_write') ? 'on_write' : (allowed[0] || trigger);
                }
            }

            const ruleVals: Record<string, any> = {
                name: RULE_NAME,
                model_id: modelId,
                trigger,
                filter_domain: FILTER_DOMAIN,
            };
            // Link the server action: m2m `action_server_ids` (Odoo 16+) or legacy m2o `action_server_id`.
            if ('action_server_ids' in baFields) {
                ruleVals.action_server_ids = [[6, 0, [serverActionId]]];
            } else if ('action_server_id' in baFields) {
                ruleVals.action_server_id = serverActionId;
            }

            const existingRules = await this.execute('base.automation', 'search_read', [
                [['name', '=', RULE_NAME], ['model_id', '=', modelId]], ['id']
            ]);
            if (existingRules && existingRules.length > 0) {
                await this.execute('base.automation', 'write', [[existingRules[0].id], ruleVals]);
                steps.push(`Updated automated action "${RULE_NAME}" (fires on posted customer invoices).`);
            } else {
                await this.execute('base.automation', 'create', [ruleVals]);
                steps.push(`Created automated action "${RULE_NAME}" (fires on posted customer invoices).`);
            }

            return { success: errors.length === 0, steps, errors };
        } catch (e: any) {
            errors.push(e.message);
            return { success: false, steps, errors };
        }
    }

    /**
     * Pulls an invoice from Odoo and maps it to SimpleInvoiceInput
     */
    async getInvoice(invoiceId: number): Promise<any> {
        // Dynamically inspect model fields to see what exists in this Odoo DB instance
        let fieldsMeta: Record<string, any> = {};
        try {
            fieldsMeta = await this.execute('account.move', 'fields_get', [
                [],
                ['type']
            ]);
        } catch (e: any) {
            console.warn('[Odoo] Failed to fetch field metadata:', e.message);
        }

        const baseFields = [
            'name', 'date', 'amount_total', 'amount_untaxed', 'amount_tax',
            'move_type', 'partner_id', 'invoice_line_ids', 'currency_id',
            'x_zatca_status'
        ];

        // Check and append optional compliance fields dynamically
        const fields = [...baseFields];
        for (const f of ['x_zatca_document_type', 'reversed_entry_id', 'ref', 'invoice_origin']) {
            if (fieldsMeta && fieldsMeta[f]) {
                fields.push(f);
            }
        }
        
        const moves = await this.execute('account.move', 'read', [
            [invoiceId],
            fields
        ]);

        if (!moves || moves.length === 0) {
            throw new Error(`Invoice with ID ${invoiceId} not found in Odoo.`);
        }

        const move = moves[0];
        
        // Fetch currency name
        const currency = await this.execute('res.currency', 'read', [
            [move.currency_id[0]],
            ['name']
        ]);
        const currencyName = currency?.[0]?.name || 'SAR';

        // Fetch partner details (buyer)
        const partner = await this.execute('res.partner', 'read', [
            [move.partner_id[0]],
            ['name', 'vat', 'street', 'city', 'zip', 'country_id']
        ]);
        const buyer = partner?.[0] || {};
        
        // Fetch country code
        let countryCode = 'SA';
        if (buyer.country_id) {
            const country = await this.execute('res.country', 'read', [
                [buyer.country_id[0]],
                ['code']
            ]);
            countryCode = country?.[0]?.code || 'SA';
        }

        // Fetch invoice lines
        const lineIds = move.invoice_line_ids || [];
        const lines = await this.execute('account.move.line', 'read', [
            lineIds,
            ['name', 'quantity', 'price_unit', 'price_subtotal', 'tax_ids']
        ]);

        // Map items
        const items = [];
        for (const line of lines) {
            // Skip section or note lines (quantity = 0 or price = 0 sometimes)
            if (!line.quantity || line.quantity <= 0) continue;

            // Fetch tax rates
            let taxRate = 15; // Default Saudi VAT rate
            if (line.tax_ids && line.tax_ids.length > 0) {
                const taxes = await this.execute('account.tax', 'read', [
                    [line.tax_ids[0]],
                    ['amount', 'amount_type']
                ]);
                if (taxes && taxes[0]) {
                    taxRate = taxes[0].amount;
                }
            }

            items.push({
                name: line.name || 'Sales Item',
                quantity: line.quantity,
                unitPrice: line.price_unit,
                vatCategory: 'S', // Standard rate
                vatRate: taxRate
            });
        }

        // Classify B2B (standard) vs B2C (simplified)
        // Odoo B2C invoices typically don't have a VAT number on the customer, or are standard retail sales
        const isB2B = !!buyer.vat;
        const type = isB2B ? 'standard' : 'simplified';
        
        // Determine document type (388 = Invoice, 381 = Credit Note, 383 = Debit Note)
        let documentType = '388';
        const refLower = (move.ref || '').toLowerCase();
        
        if (move.x_zatca_document_type) {
            documentType = move.x_zatca_document_type;
        } else if (move.move_type === 'out_refund') {
            documentType = '381';
        } else if (refLower.includes('debit note') || refLower.includes('debit of')) {
            documentType = '383';
        } else {
            documentType = '388';
        }

        const isAdjustment = documentType === '381' || documentType === '383';

        // Extract original invoice ID for adjustment references
        let originalInvoiceId = '';
        if (isAdjustment) {
            if (move.reversed_entry_id && move.reversed_entry_id[1]) {
                originalInvoiceId = move.reversed_entry_id[1];
            } else if (move.ref) {
                // Remove prefixes like "Reversal of:", "Debit Note of:", or "Debit of:"
                const cleanRef = move.ref
                    .replace(/Reversal of:/i, '')
                    .replace(/Debit Note of:/i, '')
                    .replace(/Debit of:/i, '')
                    .trim();
                // Take the first part before any comma (e.g. "Reversal of: INV/2026/00004, testing")
                const potentialId = cleanRef.split(',')[0].trim();
                if (potentialId && (potentialId.includes('/') || potentialId.startsWith('INV') || potentialId.startsWith('RINV'))) {
                    originalInvoiceId = potentialId;
                }
            }

            if (!originalInvoiceId) {
                originalInvoiceId = move.invoice_origin || 'INV-0000';
            }
        }

        return {
            type,
            documentType,
            invoiceId: move.name || `INV-${move.id}`,
            buyer: {
                partyIdentification: { id: buyer.vat || 'UNREGISTERED', schemeID: buyer.vat ? 'TXID' : 'NAT' },
                postalAddress: {
                    streetName: buyer.street || 'Street Address',
                    buildingNumber: '1000',
                    citySubdivisionName: buyer.city || 'Riyadh',
                    cityName: buyer.city || 'Riyadh',
                    postalZone: buyer.zip || '11564',
                    country: countryCode
                },
                partyTaxScheme: { companyID: buyer.vat || '' },
                partyLegalEntity: { registrationName: buyer.name || 'Walk-in Customer' },
                // Keep the flat fields for backward compatibility
                name: buyer.name || 'Walk-in Customer',
                vatNumber: buyer.vat || '',
                street: buyer.street || 'Street Address',
                building: '1000',
                city: buyer.city || 'Riyadh',
                postalCode: buyer.zip || '11564',
                country: countryCode
            },
            items,
            odooRaw: move,
            ...(isAdjustment && {
                originalInvoiceId,
                creditReason: move.ref || move.invoice_origin || 'Adjustment Note'
            })
        };
    }

    /**
     * Writes ZATCA compliance results back to the invoice in Odoo, including attaching PDF & XML files.
     */
    async writebackStatus(
        invoiceId: number,
        data: {
            status: 'cleared' | 'failed' | 'submitted';
            uuid?: string;
            qrCode?: string;
            xml?: string;
            error?: string;
            pdfBase64?: string;
            xmlBase64?: string;
        }
    ): Promise<boolean> {
        console.log(`[Odoo] Writing back status ${data.status} for Odoo invoice ID ${invoiceId}...`);
        
        const writeData: Record<string, any> = {
            x_zatca_status: data.status,
            x_zatca_uuid: data.uuid || '',
            x_zatca_qr_code: data.qrCode || '',
            x_zatca_xml: data.xml ? Buffer.from(data.xml).toString('base64') : '',
            x_zatca_error: data.error || ''
        };

        const result = await this.execute('account.move', 'write', [
            [invoiceId],
            writeData
        ]);

        // Attach signed XML and compliance PDF directly to the invoice record in Odoo
        if ((data.status === 'cleared' || data.status === 'submitted') && (data.pdfBase64 || data.xmlBase64)) {
            try {
                // Determine whether Odoo uses 'raw' or 'datas' for ir.attachment binary content
                let dataField = 'datas';
                try {
                    const fields = await this.execute('ir.attachment', 'fields_get', [[], ['type']]);
                    if (fields && 'raw' in fields) {
                        dataField = 'raw';
                    }
                } catch (e: any) {
                    console.warn('[Odoo] fields_get detection failed, default to datas:', e.message);
                }

                // Find existing attachments for this invoice to prevent duplicates
                const existingAttachments = await this.execute('ir.attachment', 'search', [
                    [
                        ['res_model', '=', 'account.move'],
                        ['res_id', '=', invoiceId],
                        ['name', 'in', [`ZATCA_Cleared_${invoiceId}.pdf`, `ZATCA_Signed_${invoiceId}.xml`]]
                    ]
                ]);

                if (existingAttachments && existingAttachments.length > 0) {
                    await this.execute('ir.attachment', 'unlink', [existingAttachments]);
                    console.log(`[Odoo] Cleaned up ${existingAttachments.length} old ZATCA attachments for invoice ${invoiceId}`);
                }

                if (data.pdfBase64) {
                    await this.execute('ir.attachment', 'create', [{
                        name: `ZATCA_Cleared_${invoiceId}.pdf`,
                        type: 'binary',
                        [dataField]: data.pdfBase64,
                        res_model: 'account.move',
                        res_id: invoiceId,
                        mimetype: 'application/pdf'
                    }]);
                    console.log(`[Odoo] Created PDF attachment ZATCA_Cleared_${invoiceId}.pdf for invoice ${invoiceId} using field '${dataField}'`);
                }

                if (data.xmlBase64) {
                    await this.execute('ir.attachment', 'create', [{
                        name: `ZATCA_Signed_${invoiceId}.xml`,
                        type: 'binary',
                        [dataField]: data.xmlBase64,
                        res_model: 'account.move',
                        res_id: invoiceId,
                        mimetype: 'application/xml'
                    }]);
                    console.log(`[Odoo] Created XML attachment ZATCA_Signed_${invoiceId}.xml for invoice ${invoiceId} using field '${dataField}'`);
                }
            } catch (attachErr: any) {
                console.warn('[Odoo] Failed to manage attachments:', attachErr.message);
            }
        }

        // Post a message in the Odoo chatter/activity log
        try {
            const message = data.status === 'cleared' 
                ? `🚀 <b>ZATCA Compliance: Invoice Cleared successfully!</b><br/>UUID: ${data.uuid}<br/>PDF and XML have been generated and attached.`
                : `❌ <b>ZATCA Compliance: Submission Failed</b><br/>Error: ${data.error}`;
            
            await this.execute('mail.message', 'create', [{
                model: 'account.move',
                res_id: invoiceId,
                body: message,
                message_type: 'notification',
                subtype_id: 1 // Discard/default note subtype
            }]);
        } catch (chatterErr: any) {
            console.warn('[Odoo] Failed to append message to chatter:', chatterErr.message);
        }

        return !!result;
    }
}
