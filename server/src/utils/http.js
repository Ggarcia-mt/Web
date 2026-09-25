import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Debes iniciar sesión') => new HttpError(401, msg);
export const forbidden = (msg = 'No tienes permiso para esta acción') => new HttpError(403, msg);
export const notFound = (msg = 'Recurso no encontrado') => new HttpError(404, msg);

/** Valida `data` con un esquema zod y lanza 400 con los errores legibles. */
export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    throw badRequest('Datos inválidos: ' + details.map((d) => `${d.path || 'campo'} ${d.message}`).join('; '), details);
  }
  return result.data;
}

export function toInt(value, name = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`${name} inválido`);
  return n;
}

// Middleware final de errores
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Datos inválidos', details: err.issues });
  }
  if (err?.code === 'P2002') {
    return res.status(409).json({ error: 'Ya existe un registro con esos datos únicos' });
  }
  if (err?.code === 'P2003') {
    return res.status(409).json({ error: 'No se puede eliminar porque tiene registros relacionados' });
  }
  if (err?.code === 'P2025') {
    return res.status(404).json({ error: 'Recurso no encontrado' });
  }
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'El archivo es demasiado grande' });
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
}
