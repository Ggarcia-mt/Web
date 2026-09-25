// Gestión de evaluaciones por el profesor: configuración, preguntas, ponderación,
// asignación, resultados y ajustes manuales de calificación (RF-02, RF-03, RF-05).
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { excelUpload, requireFile } from '../middleware/upload.js';
import { evaluationBlockReason, getManagedCourse, getManagedEvaluation, getVisibleCourse } from '../services/access.js';
import { QUESTION_ALIASES, evaluationResultsWorkbook, questionsTemplate, readRows, rowsToQuestions, sendXlsx, toBuffer } from '../services/excel.js';
import { gradeSubmission, regradeEvaluation } from '../services/grader.js';
import { randomCode } from '../utils/codes.js';
import { badRequest, forbidden, notFound, parse, toInt } from '../utils/http.js';
import { config } from '../config.js';

const router = Router();
// Este router se monta en /api, así que la autenticación se limita a sus prefijos.
router.use(['/courses', '/evaluations', '/submissions'], requireAuth);

// Sin .default(): en zod 4 .partial() conserva los valores por defecto y una
// actualización parcial restablecería campos. Los defaults los pone la base de datos.
const evaluationSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(3000).optional().nullable(),
  type: z.enum(['EXAMEN', 'EJERCICIO']).optional(),
  audience: z.enum(['CURSO', 'ESPECIFICOS', 'PUBLICA']).optional(),
  weight: z.number().min(0).max(100).optional(),
  timeLimitMin: z.number().int().min(1).max(600).nullable().optional(),
  maxAttempts: z.number().int().min(1).max(20).optional(),
  opensAt: z.coerce.date().nullable().optional(),
  closesAt: z.coerce.date().nullable().optional(),
  showResults: z.boolean().optional(),
  shuffle: z.boolean().optional(),
  assigneeIds: z.array(z.number().int().positive()).optional(),
});

const questionSchema = z
  .object({
    id: z.number().int().positive().optional(),
    type: z.enum(['MULTIPLE', 'COMPLETAR']),
    prompt: z.string().trim().min(3).max(3000),
    options: z.array(z.string().trim().min(1).max(500)).max(8).optional().default([]),
    correctOption: z.number().int().min(0).nullable().optional(),
    answers: z.array(z.string().trim().min(1).max(200)).max(15).optional().default([]),
    points: z.number().min(0).max(1000).default(1),
    explanation: z.string().trim().max(2000).nullable().optional(),
    aiGenerated: z.boolean().optional(),
  })
  .superRefine((q, ctx) => {
    if (q.type === 'MULTIPLE') {
      if (q.options.length < 2) ctx.addIssue({ code: 'custom', message: 'necesita al menos 2 opciones' });
      if (q.correctOption === null || q.correctOption === undefined || q.correctOption >= q.options.length) {
        ctx.addIssue({ code: 'custom', message: 'debe indicar la opción correcta' });
      }
    } else if (q.answers.length < 1) {
      ctx.addIssue({ code: 'custom', message: 'necesita al menos una respuesta aceptada' });
    }
  });

async function uniquePublicCode() {
  for (let i = 0; i < 10; i++) {
    const code = randomCode(8);
    if (!(await prisma.evaluation.findUnique({ where: { publicCode: code } }))) return code;
  }
  throw new Error('No se pudo generar un código único');
}

async function setAssignees(evaluationId, courseId, ids) {
  const valid = await prisma.enrollment.findMany({ where: { courseId, userId: { in: ids } }, select: { userId: true } });
  await prisma.$transaction([
    prisma.evaluationAssignee.deleteMany({ where: { evaluationId } }),
    prisma.evaluationAssignee.createMany({ data: valid.map((v) => ({ evaluationId, userId: v.userId })) }),
  ]);
}

function questionData(q) {
  const isMultiple = q.type === 'MULTIPLE';
  return {
    type: q.type,
    prompt: q.prompt,
    options: isMultiple ? q.options : [],
    correctOption: isMultiple ? q.correctOption : null,
    answers: isMultiple ? [] : q.answers,
    points: q.points,
    explanation: q.explanation || null,
    aiGenerated: Boolean(q.aiGenerated),
  };
}

// ----------------------------- Listado por curso ------------------------------

router.get('/courses/:courseId/evaluations', async (req, res) => {
  const { course, manager } = await getVisibleCourse(req.user, toInt(req.params.courseId));

  if (manager) {
    const evaluations = await prisma.evaluation.findMany({
      where: { courseId: course.id },
      include: { _count: { select: { questions: true, submissions: { where: { submittedAt: { not: null } } } } } },
      orderBy: { createdAt: 'desc' },
    });
    const totalWeight = evaluations.filter((e) => e.status !== 'BORRADOR').reduce((s, e) => s + e.weight, 0);
    return res.json({ evaluations, totalWeight });
  }

  // Vista del estudiante: solo lo publicado que le aplica, con su estado.
  const evaluations = await prisma.evaluation.findMany({
    where: {
      courseId: course.id,
      status: { in: ['PUBLICADA', 'CERRADA'] },
      OR: [{ audience: { in: ['CURSO', 'PUBLICA'] } }, { assignees: { some: { userId: req.user.id } } }],
    },
    include: {
      _count: { select: { questions: true } },
      submissions: { where: { userId: req.user.id }, select: { id: true, submittedAt: true, grade: true, attempt: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const out = [];
  for (const ev of evaluations) {
    const { submissions, publicCode, ...rest } = ev;
    const done = submissions.filter((s) => s.submittedAt);
    const inProgress = submissions.find((s) => !s.submittedAt);
    const blockReason = await evaluationBlockReason(ev, req.user);
    out.push({
      ...rest,
      attemptsUsed: done.length,
      bestGrade: done.length ? Math.max(...done.map((s) => s.grade ?? 0)) : null,
      inProgressId: inProgress?.id ?? null,
      lastSubmissionId: done.at(-1)?.id ?? null,
      canStart: !blockReason && (Boolean(inProgress) || done.length < ev.maxAttempts),
      blockReason: blockReason || (done.length >= ev.maxAttempts && !inProgress ? 'Ya usaste todos tus intentos' : null),
    });
  }
  res.json({ evaluations: out });
});

router.post('/courses/:courseId/evaluations', async (req, res) => {
  const course = await getManagedCourse(req.user, toInt(req.params.courseId));
  const { assigneeIds, ...data } = parse(evaluationSchema, req.body);
  const evaluation = await prisma.evaluation.create({
    data: {
      ...data,
      courseId: course.id,
      authorId: req.user.id,
      publicCode: data.audience === 'PUBLICA' ? await uniquePublicCode() : null,
    },
  });
  if (data.audience === 'ESPECIFICOS' && assigneeIds?.length) await setAssignees(evaluation.id, course.id, assigneeIds);
  res.status(201).json({ evaluation });
});

// ----------------------------- Detalle y edición ------------------------------

router.get('/evaluations/questions-template.xlsx', async (req, res) => {
  sendXlsx(res, await toBuffer(questionsTemplate()), 'plantilla_preguntas.xlsx');
});

router.get('/evaluations/:id', async (req, res) => {
  const ev = await getManagedEvaluation(req.user, toInt(req.params.id));
  const [questions, assignees, submissionCount] = await Promise.all([
    prisma.question.findMany({ where: { evaluationId: ev.id }, orderBy: { order: 'asc' } }),
    prisma.evaluationAssignee.findMany({ where: { evaluationId: ev.id }, select: { userId: true } }),
    prisma.submission.count({ where: { evaluationId: ev.id } }),
  ]);
  res.json({
    evaluation: { ...ev, questions, assigneeIds: assignees.map((a) => a.userId), submissionCount },
    publicUrl: ev.publicCode ? `${config.appUrl}/e/${ev.publicCode}` : null,
  });
});

router.put('/evaluations/:id', async (req, res) => {
  const ev = await getManagedEvaluation(req.user, toInt(req.params.id));
  const { assigneeIds, ...data } = parse(evaluationSchema.partial(), req.body);
  if (data.opensAt && data.closesAt && data.closesAt <= data.opensAt) throw badRequest('La fecha de cierre debe ser posterior a la de apertura');
  const audience = data.audience ?? ev.audience;
  const updated = await prisma.evaluation.update({
    where: { id: ev.id },
    data: { ...data, publicCode: audience === 'PUBLICA' ? ev.publicCode || (await uniquePublicCode()) : ev.publicCode },
  });
  if (assigneeIds) await setAssignees(ev.id, ev.courseId, assigneeIds);
  res.json({ evaluation: updated });
});

router.post('/evaluations/:id/status', async (req, res) => {
  const ev = await getManagedEvaluation(req.user, toInt(req.params.id));
  const { status } = parse(z.object({ status: z.enum(['BORRADOR', 'PUBLICADA', 'CERRADA']) }), req.body);
  if (status === 'PUBLICADA') {
    const count = await prisma.question.count({ where: { evaluationId: ev.id } });
    if (!count) throw badRequest('Agrega al menos una pregunta antes de publicar');
  }
  const updated = await prisma.evaluation.update({ where: { id: ev.id }, data: { status } });
  // Al cerrar, se entregan automáticamente los intentos que quedaron abiertos.
  if (status === 'CERRADA') {
    const open = await prisma.submission.findMany({ where: { evaluationId: ev.id, submittedAt: null }, select: { id: true } });
    for (const s of open) await gradeSubmission(s.id);
  }
  res.json({ evaluation: updated });
});

router.delete('/evaluations/:id', async (req, res) => {
  const ev = await getManagedEvaluation(req.user, toInt(req.params.id));
  await prisma.evaluation.delete({ where: { id: ev.id } });
  res.json({ ok: true });
});

router.post('/evaluations/:id/duplicate', async (req, res) => {
  const ev = await getManagedEvaluation(req.user, toInt(req.params.id));
  const questions = await prisma.question.findMany({ where: { evaluationId: ev.id }, orderBy: { order: 'asc' } });
  const copy = await prisma.evaluation.create({
    data: {
      courseId: ev.courseId,
      authorId: req.user.id,
      title: `${ev.title} (copia)`,
      description: ev.description,
      type: ev.type,
      audience: ev.audience === 'ESPECIFICOS' ? 'CURSO' : ev.audience,
      weight: ev.weight,
      timeLimitMin: ev.timeLimitMin,
      maxAttempts: ev.maxAttempts,
      showResults: ev.showResults,
      shuffle: ev.shuffle,
      publicCode: ev.audience === 'PUBLICA' ? await uniquePublicCode() : null,
      questions: {
        create: questions.map(({ id, evaluationId, ...q }) => ({ ...q, options: q.options ?? undefined, answers: q.answers ?? undefined })),
      },
    },
  });
  res.status(201).json({ evaluation: copy });
});

// ----------------------------- Preguntas --------------------------------------

/**
 * Guarda el banco de preguntas completo (crea, actualiza y elimina).
 * Si ya hay intentos entregados, recalcula sus notas automáticamente.
 */
router.put('/evaluations/:id/questions', async (req, res) => {
  const ev = await getManagedEvaluation(req.user, toInt(req.params.id));
  const { questions } = parse(z.object({ questions: z.array(questionSchema).max(200) }), req.body);

  const existing = await prisma.question.findMany({ where: { evaluationId: ev.id }, select: { id: true } });
  const existingIds = new Set(existing.map((q) => q.id));
  const keepIds = new Set(questions.filter((q) => q.id && existingIds.has(q.id)).map((q) => q.id));

  await prisma.$transaction([
    prisma.question.deleteMany({ where: { evaluationId: ev.id, id: { notIn: [...keepIds] } } }),
    ...questions.map((q, order) =>
      q.id && keepIds.has(q.id)
        ? prisma.question.update({ where: { id: q.id }, data: { ...questionData(q), order } })
        : prisma.question.create({ data: { ...questionData(q), order, evaluationId: ev.id } }),
    ),
  ]);

  const regraded = await regradeEvaluation(ev.id);
  const saved = await prisma.question.findMany({ where: { evaluationId: ev.id }, orderBy: { order: 'asc' } });
  res.json({ questions: saved, regraded });
});

router.post('/evaluations/:id/questions/import', excelUpload, async (req, res) => {
  const ev = await getManagedEvaluation(req.user, toInt(req.params.id));
  const rows = await readRows(requireFile(req), QUESTION_ALIASES);
  const { questions, errors } = rowsToQuestions(rows);
  const last = await prisma.question.findFirst({ where: { evaluationId: ev.id }, orderBy: { order: 'desc' } });
  let order = (last?.order ?? -1) + 1;
  if (questions.length) {
    await prisma.question.createMany({ data: questions.map((q) => ({ ...q, evaluationId: ev.id, order: order++ })) });
  }
  res.json({ imported: questions.length, errors });
});

// ----------------------------- Resultados -------------------------------------

router.get('/evaluations/:id/submissions', async (req, res) => {
  const ev = await getManagedEvaluation(req.user, toInt(req.params.id));
  const submissions = await prisma.submission.findMany({
    where: { evaluationId: ev.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: [{ submittedAt: 'desc' }],
  });
  const graded = submissions.filter((s) => s.grade !== null);
  const average = graded.length ? graded.reduce((s, x) => s + x.grade, 0) / graded.length : null;
  res.json({
    submissions: submissions.map(({ guestToken, ...s }) => s),
    stats: {
      total: submissions.length,
      submitted: graded.length,
      average: average === null ? null : Math.round(average * 100) / 100,
      passed: graded.filter((s) => s.grade >= config.passingGrade).length,
    },
  });
});

router.get('/evaluations/:id/export.xlsx', async (req, res) => {
  const ev = await getManagedEvaluation(req.user, toInt(req.params.id));
  const submissions = await prisma.submission.findMany({
    where: { evaluationId: ev.id },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { submittedAt: 'asc' },
  });
  sendXlsx(res, await toBuffer(evaluationResultsWorkbook(ev, submissions)), `resultados_${ev.title}.xlsx`);
});

async function getManagedSubmission(user, id) {
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: { evaluation: { include: { course: true } } },
  });
  if (!submission) throw notFound('Intento no encontrado');
  if (user.role !== 'ADMIN' && submission.evaluation.course.teacherId !== user.id) throw forbidden();
  return submission;
}

// Detalle de un intento para revisión del profesor.
router.get('/submissions/:id/review', async (req, res) => {
  const submission = await getManagedSubmission(req.user, toInt(req.params.id));
  const [answers, questions, user] = await Promise.all([
    prisma.answer.findMany({ where: { submissionId: submission.id } }),
    prisma.question.findMany({ where: { evaluationId: submission.evaluationId }, orderBy: { order: 'asc' } }),
    submission.userId ? prisma.user.findUnique({ where: { id: submission.userId }, select: { id: true, name: true, email: true } }) : null,
  ]);
  const { guestToken, evaluation, ...rest } = submission;
  res.json({
    submission: { ...rest, user },
    evaluation: { id: evaluation.id, title: evaluation.title, courseId: evaluation.courseId },
    questions: questions.map((q) => ({ ...q, answer: answers.find((a) => a.questionId === q.id) || null })),
    scale: config.gradeScale,
  });
});

// Ajuste manual: puntos por pregunta, bonificación y retroalimentación.
router.put('/submissions/:id/grade', async (req, res) => {
  const submission = await getManagedSubmission(req.user, toInt(req.params.id));
  const data = parse(
    z.object({
      bonus: z.number().min(-config.gradeScale).max(config.gradeScale).optional(),
      feedback: z.string().trim().max(3000).nullable().optional(),
      overrides: z
        .array(z.object({ questionId: z.number().int().positive(), points: z.number().min(0).nullable() }))
        .optional(),
    }),
    req.body,
  );

  if (data.overrides?.length) {
    const questions = await prisma.question.findMany({ where: { evaluationId: submission.evaluationId } });
    for (const o of data.overrides) {
      const q = questions.find((x) => x.id === o.questionId);
      if (!q) throw badRequest('Pregunta inválida');
      if (o.points !== null && o.points > q.points) throw badRequest(`Máximo ${q.points} puntos en la pregunta ${q.order + 1}`);
      await prisma.answer.upsert({
        where: { submissionId_questionId: { submissionId: submission.id, questionId: q.id } },
        create: { submissionId: submission.id, questionId: q.id, overridePoints: o.points },
        update: { overridePoints: o.points },
      });
    }
  }
  await prisma.submission.update({
    where: { id: submission.id },
    data: { bonus: data.bonus ?? submission.bonus, feedback: data.feedback === undefined ? submission.feedback : data.feedback },
  });
  const updated = await gradeSubmission(submission.id);
  res.json({ submission: updated });
});

// Eliminar un intento (p. ej. para habilitar un nuevo intento por una justificación).
router.delete('/submissions/:id', async (req, res) => {
  const submission = await getManagedSubmission(req.user, toInt(req.params.id));
  await prisma.submission.delete({ where: { id: submission.id } });
  res.json({ ok: true });
});

export default router;
