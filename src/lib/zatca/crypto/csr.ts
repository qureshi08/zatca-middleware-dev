import forge from 'node-forge';
import { createPrivateKey, createPublicKey, createSign } from 'crypto';

export interface CSRConfig {
    commonName: string;
    serialNumber: string;
    organizationIdentifier: string;
    organizationUnitName: string;
    organizationName: string;
    countryName: string;
    invoiceType: string;
    location: string;
    industry: string;
}

/**
 * Generate a Certificate Signing Request (CSR) for ZATCA.
 * 1:1 Structural Mirror of the ZATCA Sandbox ISB 2.1.0 working sample.
 */
export function generateCSR(config: CSRConfig, privateKeyPEM: string): { b64Der: string, pem: string } {

    const oid = (id: string) => forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false, forge.asn1.oidToDer(id).getBytes());

    const createRDN = (id: string, val: string, tag: number = 12) => {
        return forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, [
            forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
                oid(id),
                forge.asn1.create(forge.asn1.Class.UNIVERSAL, tag, false, tag === 12 ? forge.util.encodeUtf8(val) : val)
            ])
        ]);
    };

    // 1. Subject (Ordered: C, OU, O, CN)
    // C=SA (Tag 19), Others (Tag 12 as per Sample)
    const subjectAsn1 = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        createRDN('2.5.4.6', config.countryName, 19),      // countryName
        createRDN('2.5.4.11', config.organizationUnitName, 12), // organizationalUnitName
        createRDN('2.5.4.10', config.organizationName, 12),     // organizationName
        createRDN('2.5.4.3', config.commonName, 12)             // commonName
    ]);

    // 2. Public Key Extraction (secp256k1)
    const nodePrivKey = createPrivateKey(privateKeyPEM);
    const nodePubKey = createPublicKey(nodePrivKey);
    const pubKeyDer = nodePubKey.export({ type: 'spki', format: 'der' }) as Buffer;
    const pubKeyAsn1 = forge.asn1.fromDer(pubKeyDer.toString('binary'));

    // 3. Extensions
    // SAN: DirectoryName EXPLICIT [4]
    // Sequence in Sample: 2.5.4.4, 0.9.2342.19200300.100.1.1, 2.5.4.12, 2.5.4.26, 2.5.4.15
    const sanRDNs = [
        createRDN('2.5.4.4', config.serialNumber, 12),              // Surname (Used for SN)
        createRDN('0.9.2342.19200300.100.1.1', config.organizationIdentifier, 12), // UID (VAT)
        createRDN('2.5.4.12', config.invoiceType, 12),              // Title (Map)
        createRDN('2.5.4.26', config.location, 12),                 // RegisteredAddress
        createRDN('2.5.4.15', config.industry, 12)                  // BusinessCategory
    ];

    const directoryName = forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 4, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, sanRDNs)
    ]);

    const sanExtension = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        oid('2.5.29.17'),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false,
            forge.asn1.toDer(forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [directoryName])).getBytes()
        )
    ]);

    // Microsoft Template Extension (OID 1.3.6.1.4.1.311.20.2)
    // Sample tags this as UTF8String (Tag 12) inside an Octet String
    const templateExtension = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        oid('1.3.6.1.4.1.311.20.2'),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false,
            forge.asn1.toDer(forge.asn1.create(forge.asn1.Class.UNIVERSAL, 12, false, forge.util.encodeUtf8('ZATCA-Code-Signing'))).getBytes()
        )
    ]);

    const extensionRequestAttr = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        oid('1.2.840.113549.1.9.14'),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, [
            forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
                templateExtension,
                sanExtension
            ])
        ])
    ]);

    // 4. CertificationRequestInfo (TBS)
    const certRequestInfo = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false, forge.asn1.integerToDer(0).getBytes()),
        subjectAsn1,
        pubKeyAsn1,
        forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, [extensionRequestAttr])
    ]);

    // 5. Signature (ecdsa-with-sha256)
    const tbsDer = forge.asn1.toDer(certRequestInfo).getBytes();
    const sign = createSign('SHA256');
    sign.update(Buffer.from(tbsDer, 'binary'));
    const signature = sign.sign(privateKeyPEM);

    // 6. Assembly
    const finalAsn1 = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        certRequestInfo,
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
            oid('1.2.840.10045.4.3.2')
        ]),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.BITSTRING, false, String.fromCharCode(0x00) + signature.toString('binary'))
    ]);

    const der = forge.asn1.toDer(finalAsn1).getBytes();
    const b64Der = forge.util.encode64(der);

    let pem = '-----BEGIN CERTIFICATE REQUEST-----\n';
    for (let i = 0; i < b64Der.length; i += 64) pem += b64Der.substring(i, i + 64) + '\n';
    pem += '-----END CERTIFICATE REQUEST-----';

    return { b64Der, pem };
}
