
import { generateQRCodeData } from './qr/generator';
import { decodeTLVData } from './qr/generator';

const data = {
    sellerName: 'Maximum Speed Tech Supply LTD',
    vatRegistrationNumber: '399999999900003',
    timestamp: '2026-02-19T10:21:20',
    invoiceTotal: '115.00',
    vatTotal: '15.00',
    invoiceHash: 'JYnLSWYEF0VUg1TYFA+tER7y8G5l1QvLQwHnf26sDao=',
    ecdsaSignature: 'MEUCIQBYWNxU2odUwrh2hfV3Ti6MKULlmtmGGp/Ugaqk1MHtkAiEA3Fxtrrzor3Ok61jNkNwtotCDHOQgVldGN9+3Md9KjOc=',
    ecdsaPublicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEGBQvsDPoufLn4Bny5Nf7UQg5o8Daef2aD1+qVr1Wzj9VzCABaN++TO3APB/eARservr27GaC9ye3U46bCrX3HEJFkiDPwhEU/0iBjQE1ERPwQEhOuP0k1A==',
    certificateSignature: 'SIM_CERT_SIGNATURE_STUB'
};

const tlv = generateQRCodeData(data);
console.log('Generated TLV (Base64):', tlv);

const decoded = decodeTLVData(tlv);
console.log('Decoded TLV:');
decoded.forEach(entry => {
    console.log(`Tag ${entry.tag}: ${entry.value}`);
});
