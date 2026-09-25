// Calificación automática y recalculo de intentos (RF-05).
import { prisma } from '../db.js';
import { config } from '../config.js';
import { effectivePoints, gradeAnswer, round, toGrade } from '../utils/grading.js';

/** Califica y cierra un intento con las respuestas guardadas. */
export async function gradeSubmission(submissionId) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { answers: true, evaluation: { include: { questions: true } } },
  });
  const { questions } = submission.evaluation;
  const byQuestion = new Map(submission.answers.map((a) => [a.questionId, a]));

  let score = 0;
  let maxScore = 0;
  const ops = [];
  for (const q of questions) {
    maxScore += q.points;
    const existing = byQuestion.get(q.id);
    const { isCorrect, points } = gradeAnswer(q, existing?.value);
    const answer = { isCorrect, points, overridePoints: existing?.overridePoints ?? null };
    score += effectivePoints(answer);
    ops.push(
      prisma.answer.upsert({
        where: { submissionId_questionId: { submissionId, questionId: q.id } },
        create: { submissionId, questionId: q.id, value: existing?.value ?? null, isCorrect, points },
        update: { isCorrect, points },
      }),
    );
  }

  const grade = toGrade(score, maxScore, submission.bonus, config.gradeScale);
  ops.push(
    prisma.submission.update({
      where: { id: submissionId },
      data: { score: round(score), maxScore: round(maxScore), grade, submittedAt: submission.submittedAt ?? new Date() },
    }),
  );
  await prisma.$transaction(ops);
  return prisma.submission.findUnique({ where: { id: submissionId } });
}

/** Recalcula todos los intentos entregados (p. ej. si el profesor corrige la clave de una pregunta). */
export async function regradeEvaluation(evaluationId) {
  const subs = await prisma.submission.findMany({
    where: { evaluationId, submittedAt: { not: null } },
    select: { id: true },
  });
  for (const s of subs) await gradeSubmission(s.id);
  return subs.length;
}
