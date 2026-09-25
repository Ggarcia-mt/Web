// Presentación de evaluaciones: estudiantes inscritos, independientes y visitantes anónimos.
import { Router } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { evaluationBlockReason } from '../services/access.js';
import { gradeSubmission } from '../services/grader.js';
import { badRequest, forbidden, notFound, parse, toInt } from '../utils/http.js';

const router = Router();
const GRACE_MS = 30_000;

const publicLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });

function deadlineOf(submission, evaluation) {
  const limits = [];
  if (evaluation.timeLimitMin) limits.push(submission.startedAt.getTime() + evaluation.timeLimitMin * 60_000);
  if (evaluation.closesAt) limits.push(evaluation.closesAt.getTime());
  return limits.length ? new Date(Math.min(...limits)) : null;
}

/** Barajado determinista: el mismo intento siempre ve el mismo orden. */
function seededShuffle(list, seed) {
  const out = [...list];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function publicEvaluationInfo(ev, questionCount) {
  return {
    id: ev.id,
    title: ev.title,
    description: ev.description,
    type: ev.type,
    timeLimitMin: ev.timeLimitMin,
    maxAttempts: ev.maxAttempts,
    opensAt: ev.opensAt,
    closesAt: ev.closesAt,
    audience: ev.audience,
    questionCount,
    courseName: ev.course?.name,
  };
}

async function startSubmission(evaluation, { user, guestName, guestEmail }) {
  const block = await evaluationBlockReason(evaluation, user);
  if (block) throw forbidden(block);

  if (user) {
    const open = await prisma.submission.findFirst({ where: { evaluationId: evaluation.id, userId: user.id, submittedAt: null } });
    if (open) return open;
    const done = await prisma.submission.count({ where: { evaluationId: evaluation.id, userId: user.id } });
    if (done >= evaluation.maxAttempts) throw forbidden('Ya usaste todos tus intentos');
    return prisma.submission.create({ data: { evaluationId: evaluation.id, userId: user.id, attempt: done + 1 } });
  }

  // Visitante anónimo: se identifica con nombre y recibe un token para continuar su intento.
  return prisma.submission.create({
    data: {
      evaluationId: evaluation.id,
      guestName,
      guestEmail: guestEmail || null,
      guestToken: crypto.randomBytes(24).toString('base64url'),
    },
  });
}

async function loadOwnedSubmission(req, id) {
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: { evaluation: { include: { course: { select: { id: true, name: true } } } } },
  });
  if (!submission) throw notFound('Intento no encontrado');
  const guestToken = req.headers['x-guest-token'];
  const isOwner = (req.user && submission.userId === req.user.id) || (submission.guestToken && guestToken === submission.guestToken);
  if (!isOwner) throw forbidden('Este intento no te pertenece');
  return submission;
}

async function submissionView(submission) {
  const { evaluation } = submission;
  const [questions, answers] = await Promise.all([
    prisma.question.findMany({ where: { evaluationId: evaluation.id }, orderBy: { order: 'asc' } }),
    prisma.answer.findMany({ where: { submissionId: submission.id } }),
  ]);
  const ordered = evaluation.shuffle ? seededShuffle(questions, submission.id) : questions;
  const finished = Boolean(submission.submittedAt);
  const reveal = finished && evaluation.showResults;

  return {
    submission: {
      id: submission.id,
      attempt: submission.attempt,
      startedAt: submission.startedAt,
      submittedAt: submission.submittedAt,
      deadline: deadlineOf(submission, evaluation),
      guestName: submission.guestName,
      ...(finished ? { score: submission.score, maxScore: submission.maxScore, bonus: submission.bonus, grade: submission.grade, feedback: submission.feedback } : {}),
    },
    evaluation: { ...publicEvaluationInfo(evaluation, questions.length), showResults: evaluation.showResults },
    scale: config.gradeScale,
    passingGrade: config.passingGrade,
    questions: ordered.map((q) => {
      const a = answers.find((x) => x.questionId === q.id);
      return {
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        options: q.type === 'MULTIPLE' ? q.options : undefined,
        points: q.points,
        value: a?.value ?? null,
        ...(reveal
          ? {
              isCorrect: a?.isCorrect ?? false,
              earned: a ? (a.overridePoints ?? a.points) : 0,
              correctOption: q.correctOption,
              answers: q.answers,
              explanation: q.explanation,
            }
          : {}),
      };
    }),
  };
}

const answersSchema = z.object({ answers: z.record(z.string(), z.string().max(500).nullable()).default({}) });

async function saveAnswers(submission, answers) {
  const questionIds = new Set(
    (await prisma.question.findMany({ where: { evaluationId: submission.evaluationId }, select: { id: true } })).map((q) => q.id),
  );
  const ops = [];
  for (const [key, value] of Object.entries(answers)) {
    const questionId = Number(key);
    if (!questionIds.has(questionId)) continue;
    ops.push(
      prisma.answer.upsert({
        where: { submissionId_questionId: { submissionId: submission.id, questionId } },
        create: { submissionId: submission.id, questionId, value },
        update: { value },
      }),
    );
  }
  if (ops.length) await prisma.$transaction(ops);
}

// ----------------------------- Rutas ------------------------------------------

// Información de una evaluación pública (visitantes sin cuenta).
router.get('/public/:code', publicLimiter, async (req, res) => {
  const ev = await prisma.evaluation.findUnique({
    where: { publicCode: String(req.params.code).toUpperCase() },
    include: { course: { select: { name: true } }, _count: { select: { questions: true } } },
  });
  if (!ev || ev.audience !== 'PUBLICA') throw notFound('Evaluación no encontrada');
  const blockReason = await evaluationBlockReason(ev, null);
  res.json({ evaluation: publicEvaluationInfo(ev, ev._count.questions), blockReason });
});

router.post('/public/:code/start', publicLimiter, async (req, res) => {
  const ev = await prisma.evaluation.findUnique({ where: { publicCode: String(req.params.code).toUpperCase() } });
  if (!ev || ev.audience !== 'PUBLICA') throw notFound('Evaluación no encontrada');
  let guest = {};
  if (!req.user) {
    guest = parse(
      z.object({ guestName: z.string().trim().min(3).max(120), guestEmail: z.string().trim().email().optional().or(z.literal('')) }),
      req.body,
    );
  }
  const submission = await startSubmission(ev, { user: req.user, ...guest });
  res.status(201).json({ submissionId: submission.id, guestToken: submission.guestToken || null });
});

// Estudiante autenticado inicia (o retoma) un intento.
router.post('/:evaluationId/start', requireAuth, async (req, res) => {
  const ev = await prisma.evaluation.findUnique({ where: { id: toInt(req.params.evaluationId) } });
  if (!ev) throw notFound('Evaluación no encontrada');
  const submission = await startSubmission(ev, { user: req.user });
  res.status(201).json({ submissionId: submission.id });
});

router.get('/submissions/:id', async (req, res) => {
  let submission = await loadOwnedSubmission(req, toInt(req.params.id));
  // Si el tiempo venció sin entregar, se entrega automáticamente con lo guardado.
  const deadline = deadlineOf(submission, submission.evaluation);
  if (!submission.submittedAt && deadline && Date.now() > deadline.getTime() + GRACE_MS) {
    await gradeSubmission(submission.id);
    submission = await loadOwnedSubmission(req, submission.id);
  }
  res.json(await submissionView(submission));
});

// Autoguardado mientras el estudiante responde.
router.put('/submissions/:id/answers', async (req, res) => {
  const submission = await loadOwnedSubmission(req, toInt(req.params.id));
  if (submission.submittedAt) throw badRequest('Este intento ya fue entregado');
  const deadline = deadlineOf(submission, submission.evaluation);
  if (deadline && Date.now() > deadline.getTime() + GRACE_MS) throw badRequest('El tiempo terminó');
  const { answers } = parse(answersSchema, req.body);
  await saveAnswers(submission, answers);
  res.json({ ok: true, savedAt: new Date() });
});

// Entrega y calificación automática.
router.post('/submissions/:id/submit', async (req, res) => {
  const submission = await loadOwnedSubmission(req, toInt(req.params.id));
  if (submission.submittedAt) throw badRequest('Este intento ya fue entregado');
  const deadline = deadlineOf(submission, submission.evaluation);
  const late = deadline && Date.now() > deadline.getTime() + GRACE_MS;
  // Si llega tarde, se califica solo lo que alcanzó a guardarse.
  if (!late) {
    const { answers } = parse(answersSchema, req.body);
    await saveAnswers(submission, answers);
  }
  await gradeSubmission(submission.id);
  res.json(await submissionView(await loadOwnedSubmission(req, submission.id)));
});

// Historial de intentos del estudiante autenticado.
router.get('/mine', requireAuth, async (req, res) => {
  const submissions = await prisma.submission.findMany({
    where: { userId: req.user.id },
    include: { evaluation: { select: { id: true, title: true, type: true, showResults: true, course: { select: { id: true, name: true } } } } },
    orderBy: { startedAt: 'desc' },
    take: 100,
  });
  res.json({ submissions: submissions.map(({ guestToken, ...s }) => s) });
});

export default router;
