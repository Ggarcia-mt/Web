import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentToken, isValidToken } from '../src/utils/qr.js';
import { extractJson, normalizeQuestions } from '../src/services/ai/prompt.js';

const session = { id: 7, secret: 'secreto-de-prueba', rotateSeconds: 30 };

test('el token QR vigente y el anterior son válidos; los viejos no', () => {
  const now = 1_800_000_000_000;
  const { token } = currentToken(session, now);
  assert.equal(isValidToken(session, token, now), true);
  assert.equal(isValidToken(session, token, now + 30_000), true); // tolerancia de un ciclo
  assert.equal(isValidToken(session, token, now + 90_000), false); // caducado
  assert.equal(isValidToken({ ...session, id: 8 }, token, now), false); // otra sesión
});

test('extractJson tolera bloques de código', () => {
  assert.deepEqual(extractJson('Aquí está:\n```json\n{"questions": []}\n```'), { questions: [] });
});

test('normalizeQuestions descarta preguntas mal formadas', () => {
  const out = normalizeQuestions({
    questions: [
      { type: 'MULTIPLE', prompt: '¿2+2?', options: ['3', '4'], correctOption: 1, answers: [], explanation: '' },
      { type: 'MULTIPLE', prompt: 'Sin correcta', options: ['a', 'b'], correctOption: 5, answers: [], explanation: '' },
      { type: 'COMPLETAR', prompt: 'La capital de Colombia es', options: [], correctOption: -1, answers: ['Bogotá'], explanation: '' },
    ],
  });
  assert.equal(out.length, 2);
  assert.equal(out[1].prompt, 'La capital de Colombia es ___');
});
