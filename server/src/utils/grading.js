// Lógica pura de calificación (RF-05). Sin acceso a base de datos para poder probarla.

/** Normaliza texto para comparar respuestas de "completar": sin tildes, mayúsculas ni espacios extra. */
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,;:!?¡¿"'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Califica una respuesta contra su pregunta. Devuelve { isCorrect, points }. */
export function gradeAnswer(question, value) {
  const points = Number(question.points) || 0;
  let isCorrect = false;

  if (value === null || value === undefined || value === '') {
    return { isCorrect: false, points: 0 };
  }

  if (question.type === 'MULTIPLE') {
    isCorrect = Number(value) === Number(question.correctOption);
  } else if (question.type === 'COMPLETAR') {
    const accepted = Array.isArray(question.answers) ? question.answers : [];
    const given = normalizeText(value);
    isCorrect = given.length > 0 && accepted.some((a) => normalizeText(a) === given);
  }

  return { isCorrect, points: isCorrect ? points : 0 };
}

/** Puntos efectivos de una respuesta: el ajuste manual del profesor tiene prioridad. */
export function effectivePoints(answer) {
  return answer.overridePoints ?? answer.points ?? 0;
}

export function round(value, decimals = 2) {
  const f = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * f) / f;
}

/**
 * Convierte puntos a nota en la escala institucional (por defecto 0 a 5)
 * y suma los puntos adicionales (bonus) sin exceder la escala.
 */
export function toGrade(score, maxScore, bonus = 0, scale = 5) {
  const base = maxScore > 0 ? (Math.max(0, Math.min(score, maxScore)) / maxScore) * scale : 0;
  return round(Math.max(0, Math.min(scale, base + (Number(bonus) || 0))));
}

/**
 * Nota acumulada del curso: Σ(nota_i × peso_i) / 100.
 * Las evaluaciones sin presentar cuentan 0. También devuelve el porcentaje ya evaluado.
 * items: [{ weight, grade | null }]
 */
export function courseGrade(items, scale = 5) {
  let accumulated = 0;
  let evaluatedWeight = 0;
  let totalWeight = 0;
  for (const it of items) {
    const w = Number(it.weight) || 0;
    totalWeight += w;
    if (it.grade !== null && it.grade !== undefined) {
      accumulated += (Number(it.grade) * w) / 100;
      evaluatedWeight += w;
    }
  }
  // Promedio proyectado: cómo va el estudiante sobre lo que ya se evaluó.
  const projected = evaluatedWeight > 0 ? (accumulated * 100) / evaluatedWeight : null;
  return {
    accumulated: round(Math.min(accumulated, scale)),
    evaluatedWeight: round(evaluatedWeight),
    totalWeight: round(totalWeight),
    projected: projected === null ? null : round(Math.min(projected, scale)),
  };
}
