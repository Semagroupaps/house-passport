import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/** Hasher en adgangskode med scrypt + tilfældigt salt. Format: "<salt_hex>:<hash_hex>". */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return salt.toString('hex') + ':' + derived.toString('hex');
}

/** Konstant-tids verifikation mod en lagret hash. */
export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = (stored || '').split(':');
  if (!saltHex || !hashHex) return false;
  const derived = scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(hashHex, 'hex');
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
