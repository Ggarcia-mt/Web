import { test } from 'node:test';
import assert from 'node:assert/strict';
import { courseGrade, gradeAnswer, normalizeText, toGrade } from '../src/utils/grading.js';

test('normalizeText ignora tildes, mayúsculas y puntuación', () => {
  assert.equal(normalizeText('  Programación  Orientada. '), 'programacion orientada');
});

test('gradeAnswer califica selección múltiple', () => {
  const q = { type: 'MULTIPLE', correctOption: 2, points: 2 };
  assert.deepEqual(gradeAnswer(q, '2'), { isCorrect: true, points: 2 });
  assert.deepEqual(gradeAnswer(q, '1'), { isCorrect: false, points: 0 });
  assert.deepEqual(gradeAnswer(q, null), { isCorrect: false, points: 0 });
});

test('gradeAnswer acepta variantes en completar', () => {
  const q = { type: 'COMPLETAR', answers: ['CSS', 'Hojas de estilo en cascada'], points: 1 };
  assert.equal(gradeAnswer(q, 'css').isCorrect, true);
  assert.equal(gradeAnswer(q, 'hojas de estilo en cascáda').isCorrect, true);
  assert.equal(gradeAnswer(q, 'html').isCorrect, false);
});

test('toGrade escala a 0-5 y suma bonificación sin pasar el máximo', () => {
  assert.equal(toGrade(3, 4), 3.75);
  assert.equal(toGrade(4, 4, 0.5), 5);
  assert.equal(toGrade(2, 4, 0.3), 2.8);
  assert.equal(toGrade(0, 0), 0);
});

test('courseGrade pondera por porcentaje y proyecta sobre lo evaluado', () => {
  const r = courseGrade([
    { weight: 20, grade: 4 },
    { weight: 30, grade: 3 },
    { weight: 50, grade: null },
  ]);
  assert.equal(r.accumulated, 1.7);
  assert.equal(r.evaluatedWeight, 50);
  assert.equal(r.projected, 3.4);
});
