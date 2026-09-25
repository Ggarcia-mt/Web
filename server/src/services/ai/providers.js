// Adaptadores de cada proveedor de IA. Todos reciben (system, user) y devuelven texto JSON.
// Agregar un proveedor nuevo = agregar una entrada en PROVIDERS.
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { config } from '../../config.js';
import { QUESTIONS_JSON_SCHEMA } from './prompt.js';

const { ai } = config;

async function callAnthropic(system, user) {
  const client = new Anthropic({ apiKey: ai.anthropic.apiKey });
  const model = ai.anthropic.model;
  // En Opus 5 / Fable 5.1 se activa el respaldo del servidor: si el modelo rechaza la
  // petición, la API la reintenta con otro modelo dentro de la misma llamada.
  const withFallback = /^claude-(opus-5|fable-5-1)/.test(model);
  const response = await client.beta.messages.create({
    model,
    max_tokens: 16000,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { format: { type: 'json_schema', schema: QUESTIONS_JSON_SCHEMA } },
    ...(withFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
  });
  if (response.stop_reason === 'refusal') {
    throw new Error('El modelo de Anthropic rechazó la solicitud; reformula el tema o las indicaciones');
  }
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

async function callOpenAICompatible({ apiKey, baseURL, model }, system, user) {
  const client = new OpenAI({ apiKey, baseURL });
  const response = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  return response.choices[0]?.message?.content ?? '';
}

async function callGemini(system, user) {
  const client = new GoogleGenAI({ apiKey: ai.gemini.apiKey });
  const response = await client.models.generateContent({
    model: ai.gemini.model,
    contents: user,
    config: { systemInstruction: system, responseMimeType: 'application/json' },
  });
  return response.text ?? '';
}

export const PROVIDERS = {
  anthropic: {
    label: 'Claude (Anthropic)',
    enabled: () => Boolean(ai.anthropic.apiKey),
    model: () => ai.anthropic.model,
    call: callAnthropic,
  },
  openai: {
    label: 'ChatGPT (OpenAI)',
    enabled: () => Boolean(ai.openai.apiKey),
    model: () => ai.openai.model,
    call: (s, u) => callOpenAICompatible({ apiKey: ai.openai.apiKey, model: ai.openai.model }, s, u),
  },
  gemini: {
    label: 'Gemini (Google)',
    enabled: () => Boolean(ai.gemini.apiKey),
    model: () => ai.gemini.model,
    call: callGemini,
  },
  compatible: {
    label: ai.compatible.name,
    enabled: () => Boolean(ai.compatible.baseURL && ai.compatible.model),
    model: () => ai.compatible.model,
    call: (s, u) => callOpenAICompatible(ai.compatible, s, u),
  },
};
