import { EncryptionService } from '../src/storage/encryption.service';
import { LocalKmsAdapter } from '../src/storage/local-kms.adapter';

describe('Crypto-shredding (envelope-kryptering, AES-256-GCM)', () => {
  const kms = new LocalKmsAdapter();
  const enc = new EncryptionService(kms);

  it('krypterer og dekrypterer korrekt (round-trip)', async () => {
    const plain = Buffer.from('Tagrapport: tag udskiftet 2023, garanti til 2033');
    const { ciphertext, keyRef } = await enc.encrypt(plain);
    expect(ciphertext.equals(plain)).toBe(false); // faktisk krypteret
    const out = await enc.decrypt(ciphertext, keyRef);
    expect(out.toString()).toBe(plain.toString());
  });

  it('efter shred() er indholdet PERMANENT ulæseligt', async () => {
    const { ciphertext, keyRef } = await enc.encrypt(Buffer.from('følsomt dokument'));
    await enc.shred(keyRef); // destruér nøglen (GDPR-sletning)
    await expect(enc.decrypt(ciphertext, keyRef)).rejects.toThrow(/permanent ulæseligt/);
  });

  it('manipuleret ciphertext afvises (GCM-integritet)', async () => {
    const { ciphertext, keyRef } = await enc.encrypt(Buffer.from('uændret'));
    ciphertext[ciphertext.length - 1] ^= 0xff; // flip sidste byte
    await expect(enc.decrypt(ciphertext, keyRef)).rejects.toThrow();
  });
});
