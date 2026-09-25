import crypto from 'node:crypto';

// Sin caracteres ambiguos (0/O, 1/I/L) para dictarlos en clase.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function randomCode(length = 6) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function randomSecret() {
  return crypto.randomBytes(32).toString('hex');
}

export function randomPassword() {
  return crypto.randomBytes(9).toString('base64url');
}
