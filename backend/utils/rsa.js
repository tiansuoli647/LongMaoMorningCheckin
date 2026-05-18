const crypto = require('crypto');

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDU/j+c5FdkEwhSIF9jmw+050iN
0/yfjhk/669RyFiG5wu0Adpk3NR2Ikbo2lA+rTBJBx1bpGVGCvMKKQ/pljNUSmJt
JaM5ieONFrZD6RhSUbjrNENH89Ks9GGWi+1dkOfdSHNujQilF5oLOIHez1HYmwml
ADA29Ux4yb8e4+PtLQIDAQAB
-----END PUBLIC KEY-----`;

/**
 * Encrypts data using RSA with PKCS1Padding and segments.
 * Matches the Java implementation requirements:
 * Algorithm: RSA/ECB/PKCS1Padding
 * Key source: assets/rsa_public_key.pem
 * Segment size: 117 bytes
 * Output encoding: Base64
 */
function encrypt(data) {
  const buffer = Buffer.from(data, 'utf-8');
  const segmentSize = 117;
  const encryptedSegments = [];

  for (let i = 0; i < buffer.length; i += segmentSize) {
    const segment = buffer.slice(i, i + segmentSize);
    const encrypted = crypto.publicEncrypt(
      {
        key: PUBLIC_KEY,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      segment
    );
    encryptedSegments.push(encrypted);
  }

  const resultBuffer = Buffer.concat(encryptedSegments);
  return resultBuffer.toString('base64');
}

module.exports = {
  encrypt,
};
