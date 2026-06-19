import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.JWT_SECRET || 'dev-insecure-change-me';

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlJson(obj: unknown): string {
  return b64url(JSON.stringify(obj));
}

/** Udsteder et signeret JWT for en person. Standard levetid: 7 dage. */
export function signToken(personId: string, ttlSeconds = 60 * 60 * 24 * 7): string {
  const now = Math.floor(Date.now() / 1000);
  const data = b64urlJson({ alg: 'HS256', typ: 'JWT' }) + '.' + b64urlJson({ sub: personId, iat: now, exp: now + ttlSeconds });
  const sig = b64url(createHmac('sha256', SECRET).update(data).digest());
  return data + '.' + sig;
}

/** Verificerer signatur + udløb og returnerer person-id'et (sub). */
export function verifyToken(token: string): { sub: string } {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Ugyldigt token');
  const data = parts[0] + '.' + parts[1];
  const expected = b64url(createHmac('sha256', SECRET).update(data).digest());
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('Ugyldig signatur');
  const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) throw new Error('Token udløbet');
  if (!payload.sub) throw new Error('Token mangler subjekt');
  return { sub: payload.sub };
}

export function jwtSecretIsDefault(): boolean {
  return !process.env.JWT_SECRET;
}
