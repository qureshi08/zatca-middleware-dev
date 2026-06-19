
/**
 * ZATCA Sandbox Test Configuration
 * 1:1 Mirror of the ZATCA Developer Portal "Golden Profile"
 */
export const TEST_CSR_CONFIG = {
    commonName: 'TST-886431145-399999999900003',
    serialNumber: '1-TST|2-TST|3-ed22f1d8-e6a2-1118-9b58-d9a8f11e445f',
    organizationIdentifier: '399999999900003',
    organizationUnitName: 'Riyadh Branch',
    organizationName: 'Maximum Speed Tech Supply LTD',
    countryName: 'SA',
    invoiceType: '1100', // Both Standard and Simplified
    location: 'RRRD2929',
    industry: 'Supply activities',
} as const;

/**
 * Onboarding Status type definition
 */
export type OnboardingStep =
    | 'not_started'
    | 'keys_generated'
    | 'csr_generated'
    | 'compliance_csid_received'
    | 'compliance_complete'
    | 'production_received';

export interface OnboardingStatus {
    isRegistered?: boolean;
    step: OnboardingStep;
    privateKey?: string;
    publicKey?: string;
    csr?: string;
    complianceCSID?: string;
    complianceSecret?: string;
    complianceRequestId?: string;
    productionCSID?: string;
    productionSecret?: string;
}

/**
 * Test Seller Configuration (Sandbox)
 */
export const TEST_SELLER = {
    partyIdentification: {
        id: '1010010000',
        schemeID: 'CRN' as const
    },
    postalAddress: {
        streetName: 'Prince Muhammad Bin Abdulaziz',
        buildingNumber: '2929',
        additionalNumber: '9292',
        citySubdivisionName: 'Al-Murabba',
        cityName: 'Riyadh',
        postalZone: '12311',
        country: 'SA'
    },
    partyTaxScheme: {
        companyID: '399999999900003'
    },
    partyLegalEntity: {
        registrationName: 'Maximum Speed Tech Supply LTD'
    }
};

/**
 * Test Buyer Configuration
 */
export const TEST_BUYERS = {
    CORPORATE_CLIENT: {
        partyIdentification: {
            id: '1234567890',
            schemeID: 'CRN' as const
        },
        postalAddress: {
            streetName: 'King Fahd Rd',
            buildingNumber: '8228',
            additionalNumber: '9999',
            citySubdivisionName: 'Al-Murooj',
            cityName: 'Riyadh',
            postalZone: '12214',
            country: 'SA'
        },
        partyTaxScheme: {
            companyID: '300000000000003'
        },
        partyLegalEntity: {
            registrationName: 'ZATCA Developer Sandbox Buyer'
        }
    },
    INDIVIDUAL_CUSTOMER: {
        postalAddress: {
            streetName: 'Tahlia St',
            buildingNumber: '1111',
            additionalNumber: '9999',
            citySubdivisionName: 'Al-Olaya',
            cityName: 'Riyadh',
            postalZone: '12222',
            country: 'SA'
        },
        partyLegalEntity: {
            registrationName: 'Individual Customer'
        }
    }
};

/**
 * Test Invoice Items
 */
export const TEST_INVOICE_ITEMS = {
    ACCOUNT_FEE: {
        name: 'Sandbox Test Item 001',
        quantity: 1,
        unitPrice: 100,
        vatRate: 15,
        vatCategory: 'S' as const
    },
    WARNING_TRIGGER: {
        name: 'TRIGGER_ZATCA_WARNING',
        quantity: 1,
        unitPrice: 50,
        vatRate: 15,
        vatCategory: 'S' as const
    }
};
