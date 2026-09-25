import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { forbidden, unauthorized } from '../utils/http.js';

export const RENEW_HEADER = 'X-Session-Token';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: `${config.sessionIdleMinutes}m`,
  });
}

export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

/**
 * Lee el token (si existe) y carga el usuario en req.user.
 * RNF-03: el token dura SESSION_IDLE_MINUTES; cada petición activa lo renueva
 * (cabecera X-Session-Token), así la sesión solo expira por inactividad.
 */
export async function loadUser(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    // Token vencido o inválido: se trata como anónimo; las rutas protegidas responderán 401.
    req.sessionExpired = true;
    return next();
  }

  const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
  if (!user || !user.active) {
    req.sessionExpired = true;
    return next();
  }
  req.user = user;

  const ageSeconds = Date.now() / 1000 - payload.iat;
  if (ageSeconds > 60) res.setHeader(RENEW_HEADER, signToken(user));
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return next(unauthorized(req.sessionExpired ? 'Tu sesión expiró, inicia sesión de nuevo' : undefined));
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}
