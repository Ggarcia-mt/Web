// Motor agnóstico de IA (RF-02): el profesor elige el proveedor; el resto del sistema
// solo conoce generateQuestions().
import { HttpError, badRequest } from '../../utils/http.js';
import { PROVIDERS } from './providers.js';
import { SYSTEM_PROMPT, buildUserPrompt, extractJson, normalizeQuestions } from './prompt.js';

export function listProviders() {
  return Object.entries(PROVIDERS).map(([id, p]) => ({
    id,
    label: p.label,
    model: p.model() || null,
    enabled: p.enabled(),
  }));
}

export async function generateQuestions({ provider, ...params }) {
  const p = PROVIDERS[provider];
  if (!p) throw badRequest('Proveedor de IA desconocido');
  if (!p.enabled()) throw badRequest(`El proveedor ${p.label} no está configurado en el servidor`);

  let text;
  try {
    text = await p.call(SYSTEM_PROMPT, buildUserPrompt(params));
  } catch (err) {
    console.error(`[IA:${provider}]`, err?.message || err);
    throw new HttpError(502, `No se pudo generar con ${p.label}: ${err?.message || 'error desconocido'}`);
  }

  let questions;
  try {
    questions = normalizeQuestions(extractJson(text));
  } catch {
    throw new HttpError(502, `${p.label} devolvió una respuesta con formato inválido; intenta de nuevo`);
  }
  if (!questions.length) throw new HttpError(502, `${p.label} no devolvió preguntas válidas; intenta de nuevo`);
  return { provider, model: p.model(), questions };
}
