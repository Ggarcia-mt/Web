import crypto from 'node:crypto';

// QR dinámico: el token cambia cada `rotateSeconds` y se deriva con HMAC del
// secreto de la sesión, así que una foto del QR deja de servir en segundos.
// Validar es un cálculo en memoria (sin consultas extra), lo que cumple RNF-02 (< 2 s).

export function currentSlot(rotateSeconds, now = Date.now()) {
  return Math.floor(now / 1000 / rotateSeconds);
}

export function tokenForSlot(secret, sessionId, slot) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${sessionId}:${slot}`)
    .digest('base64url')
    .slice(0, 12);
}

export function currentToken(session, now = Date.now()) {
  const slot = currentSlot(session.rotateSeconds, now);
  const token = tokenForSlot(session.secret, session.id, slot);
  const nextChangeMs = (slot + 1) * session.rotateSeconds * 1000 - now;
  return { token, expiresInMs: nextChangeMs };
}

/** Acepta el token actual y el anterior (tolerancia por latencia al escanear). */
export function isValidToken(session, token, now = Date.now()) {
  if (typeof token !== 'string' || token.length !== 12) return false;
  const slot = currentSlot(session.rotateSeconds, now);
  return [slot, slot - 1].some((s) => {
    const expected = Buffer.from(tokenForSlot(session.secret, session.id, s));
    const given = Buffer.from(token);
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
  });
}
