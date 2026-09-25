import { z } from 'zod';

// Contrato común para todos los proveedores: siempre devuelven este JSON.
export const QUESTIONS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'prompt', 'options', 'correctOption', 'answers', 'explanation'],
        properties: {
          type: { type: 'string', enum: ['MULTIPLE', 'COMPLETAR'] },
          prompt: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          correctOption: { type: 'integer' },
          answers: { type: 'array', items: { type: 'string' } },
          explanation: { type: 'string' },
        },
      },
    },
  },
};

const questionSchema = z.object({
  type: z.enum(['MULTIPLE', 'COMPLETAR']),
  prompt: z.string().min(3),
  options: z.array(z.string()).default([]),
  correctOption: z.number().int().default(-1),
  answers: z.array(z.string()).default([]),
  explanation: z.string().default(''),
});

export const SYSTEM_PROMPT = `Eres un asistente pedagógico que redacta preguntas de evaluación en español para docentes universitarios.
Responde únicamente con un objeto JSON con la forma {"questions": [...]}.
Cada pregunta tiene:
- "type": "MULTIPLE" (selección múltiple con única respuesta) o "COMPLETAR" (completar el espacio en blanco).
- "prompt": el enunciado. En COMPLETAR marca exactamente un espacio con "___".
- "options": en MULTIPLE, entre 3 y 5 opciones plausibles sin letras ni numeración; en COMPLETAR, una lista vacía.
- "correctOption": en MULTIPLE, el índice (desde 0) de la opción correcta; en COMPLETAR, -1.
- "answers": en COMPLETAR, las respuestas aceptadas (sinónimos y variantes cortas, de 1 a 3 palabras); en MULTIPLE, una lista vacía.
- "explanation": una justificación breve de la respuesta correcta.
Las preguntas deben ser correctas, sin ambigüedades, sin repetir ideas y ajustadas al nivel pedido. Varía la posición de la opción correcta.`;

export function buildUserPrompt({ topic, level, count, questionType, instructions, language = 'español' }) {
  const typeText = {
    MULTIPLE: 'todas de selección múltiple (MULTIPLE)',
    COMPLETAR: 'todas de completar el espacio (COMPLETAR)',
    MIXTO: 'mezcla equilibrada de MULTIPLE y COMPLETAR',
  }[questionType];

  return [
    `Genera ${count} preguntas ${typeText}.`,
    `Tema: ${topic}`,
    `Nivel: ${level}`,
    `Idioma: ${language}`,
    instructions ? `Indicaciones adicionales del docente: ${instructions}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Extrae el JSON aunque el modelo lo envuelva en ```json ... ``` o agregue texto. */
export function extractJson(text) {
  if (!text) throw new Error('La IA no devolvió contenido');
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('La IA no devolvió un JSON válido');
  return JSON.parse(candidate.slice(start, end + 1));
}

/** Valida y limpia las preguntas; descarta las que no cumplen el formato. */
export function normalizeQuestions(raw) {
  const list = Array.isArray(raw?.questions) ? raw.questions : [];
  const clean = [];
  for (const item of list) {
    const parsed = questionSchema.safeParse(item);
    if (!parsed.success) continue;
    const q = parsed.data;
    if (q.type === 'MULTIPLE') {
      const options = q.options.map((o) => o.trim()).filter(Boolean);
      if (options.length < 2 || q.correctOption < 0 || q.correctOption >= options.length) continue;
      clean.push({ type: 'MULTIPLE', prompt: q.prompt.trim(), options, correctOption: q.correctOption, answers: [], explanation: q.explanation });
    } else {
      const answers = q.answers.map((a) => a.trim()).filter(Boolean);
      if (!answers.length) continue;
      const prompt = q.prompt.includes('___') ? q.prompt.trim() : `${q.prompt.trim()} ___`;
      clean.push({ type: 'COMPLETAR', prompt, options: [], correctOption: null, answers, explanation: q.explanation });
    }
  }
  return clean;
}
