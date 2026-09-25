// Consolidado de notas y asistencia por curso (usado por la vista de notas y por Excel).
import { prisma } from '../db.js';
import { config } from '../config.js';
import { courseGrade, round } from '../utils/grading.js';

export async function buildGradebook(courseId, { onlyUserId } = {}) {
  const [enrollments, evaluations, sessions] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId, ...(onlyUserId ? { userId: onlyUserId } : {}) },
      include: { user: { select: { id: true, name: true, email: true, document: true } } },
      orderBy: { user: { name: 'asc' } },
    }),
    prisma.evaluation.findMany({
      where: { courseId, status: { in: ['PUBLICADA', 'CERRADA'] } },
      include: { assignees: { select: { userId: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.attendanceSession.findMany({
      where: { courseId, startsAt: { lte: new Date() } },
      include: { records: true },
      orderBy: { startsAt: 'asc' },
    }),
  ]);

  const userIds = enrollments.map((e) => e.userId);
  const submissions = await prisma.submission.findMany({
    where: { evaluationId: { in: evaluations.map((e) => e.id) }, userId: { in: userIds }, submittedAt: { not: null } },
    select: { evaluationId: true, userId: true, grade: true },
  });

  // Mejor nota por estudiante y evaluación
  const best = new Map();
  for (const s of submissions) {
    const key = `${s.userId}:${s.evaluationId}`;
    if (!best.has(key) || (s.grade ?? 0) > best.get(key)) best.set(key, s.grade ?? 0);
  }

  const rows = enrollments.map(({ user }) => {
    const grades = {};
    const items = [];
    for (const ev of evaluations) {
      const applies = ev.audience !== 'ESPECIFICOS' || ev.assignees.some((a) => a.userId === user.id);
      if (!applies) {
        grades[ev.id] = null;
        continue;
      }
      const g = best.has(`${user.id}:${ev.id}`) ? best.get(`${user.id}:${ev.id}`) : null;
      grades[ev.id] = g;
      // Evaluación cerrada sin presentar cuenta como 0; abierta sin presentar aún no cuenta.
      const closed = ev.status === 'CERRADA' || (ev.closesAt && ev.closesAt < new Date());
      items.push({ weight: ev.weight, grade: g ?? (closed ? 0 : null) });
    }

    const counts = { PRESENTE: 0, TARDE: 0, JUSTIFICADO: 0, AUSENTE: 0 };
    const bySession = {};
    for (const s of sessions) {
      const rec = s.records.find((r) => r.userId === user.id);
      const status = rec?.status ?? 'AUSENTE';
      counts[status]++;
      bySession[s.id] = status;
    }
    const attended = counts.PRESENTE + counts.TARDE + counts.JUSTIFICADO;

    return {
      student: user,
      grades,
      ...courseGrade(items, config.gradeScale),
      attendance: {
        ...counts,
        total: sessions.length,
        percent: sessions.length ? round((attended / sessions.length) * 100, 1) : null,
        bySession,
      },
    };
  });

  return {
    scale: config.gradeScale,
    passingGrade: config.passingGrade,
    evaluations: evaluations.map((e) => ({ id: e.id, title: e.title, type: e.type, weight: e.weight, status: e.status })),
    sessions: sessions.map((s) => ({ id: s.id, title: s.title, startsAt: s.startsAt, mode: s.mode })),
    rows,
  };
}
