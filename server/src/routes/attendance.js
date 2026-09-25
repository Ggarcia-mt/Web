// Asistencia dual (RF-04): QR dinámico con caducidad o ventana de horario de clase.
import { Router } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { getManagedCourse, getVisibleCourse, isEnrolled } from '../services/access.js';
import { randomSecret } from '../utils/codes.js';
import { currentToken, isValidToken } from '../utils/qr.js';
import { badRequest, forbidden, notFound, parse, toInt } from '../utils/http.js';

const router = Router();
router.use(['/courses', '/attendance'], requireAuth);

const STATUSES = ['PRESENTE', 'TARDE', 'AUSENTE', 'JUSTIFICADO'];

async function getManagedSession(user, id) {
  const session = await prisma.attendanceSession.findUnique({ where: { id }, include: { course: true } });
  if (!session) throw notFound('Sesión de asistencia no encontrada');
  if (user.role !== 'ADMIN' && session.course.teacherId !== user.id) throw forbidden();
  return session;
}

function isOpen(session, now = new Date()) {
  return now >= session.startsAt && now <= session.endsAt;
}

function statusOnArrival(session, now = new Date()) {
  if (session.lateAfterMin && now.getTime() > session.startsAt.getTime() + session.lateAfterMin * 60_000) return 'TARDE';
  return 'PRESENTE';
}

async function markStudent(session, user, method) {
  if (!(await isEnrolled(user.id, session.courseId))) throw forbidden('No estás inscrito en este curso');
  const existing = await prisma.attendanceRecord.findUnique({
    where: { sessionId_userId: { sessionId: session.id, userId: user.id } },
  });
  if (existing && existing.status !== 'AUSENTE') {
    return { record: existing, already: true };
  }
  const record = await prisma.attendanceRecord.upsert({
    where: { sessionId_userId: { sessionId: session.id, userId: user.id } },
    create: { sessionId: session.id, userId: user.id, status: statusOnArrival(session), method },
    update: { status: statusOnArrival(session), method, markedAt: new Date() },
  });
  return { record, already: false };
}

// ----------------------------- Por curso --------------------------------------

router.get('/courses/:courseId/attendance', async (req, res) => {
  const { course, manager } = await getVisibleCourse(req.user, toInt(req.params.courseId));
  const sessions = await prisma.attendanceSession.findMany({
    where: { courseId: course.id },
    include: manager
      ? { _count: { select: { records: { where: { status: { in: ['PRESENTE', 'TARDE', 'JUSTIFICADO'] } } } } } }
      : { records: { where: { userId: req.user.id } } },
    orderBy: { startsAt: 'desc' },
  });
  const now = new Date();
  res.json({
    manager,
    sessions: sessions.map(({ secret, records, _count, ...s }) => ({
      ...s,
      open: isOpen(s, now),
      ...(manager ? { attended: _count.records } : { myStatus: records[0]?.status ?? (s.startsAt <= now ? 'AUSENTE' : null) }),
    })),
  });
});

router.post('/courses/:courseId/attendance', async (req, res) => {
  const course = await getManagedCourse(req.user, toInt(req.params.courseId));
  const data = parse(
    z.object({
      title: z.string().trim().min(2).max(120),
      mode: z.enum(['QR', 'VENTANA']),
      startsAt: z.coerce.date().optional(),
      durationMin: z.number().int().min(1).max(600).default(15),
      lateAfterMin: z.number().int().min(1).max(600).nullable().optional(),
      rotateSeconds: z.number().int().min(10).max(300).default(30),
    }),
    req.body,
  );
  const startsAt = data.startsAt ?? new Date();
  const session = await prisma.attendanceSession.create({
    data: {
      courseId: course.id,
      title: data.title,
      mode: data.mode,
      startsAt,
      endsAt: new Date(startsAt.getTime() + data.durationMin * 60_000),
      lateAfterMin: data.lateAfterMin ?? null,
      rotateSeconds: data.rotateSeconds,
      secret: randomSecret(),
    },
  });
  const { secret, ...rest } = session;
  res.status(201).json({ session: rest });
});

// ----------------------------- Por sesión (profesor) ---------------------------

router.get('/attendance/sessions/:id', async (req, res) => {
  const session = await getManagedSession(req.user, toInt(req.params.id));
  const [enrollments, records] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId: session.courseId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: 'asc' } },
    }),
    prisma.attendanceRecord.findMany({ where: { sessionId: session.id } }),
  ]);
  const { secret, course, ...rest } = session;
  res.json({
    session: { ...rest, open: isOpen(session), courseName: course.name },
    roster: enrollments.map(({ user }) => {
      const r = records.find((x) => x.userId === user.id);
      return { ...user, status: r?.status ?? 'AUSENTE', method: r?.method ?? null, markedAt: r?.markedAt ?? null, note: r?.note ?? null };
    }),
  });
});

// QR vigente: el frontend del profesor lo consulta cada vez que rota.
router.get('/attendance/sessions/:id/qr', async (req, res) => {
  const session = await getManagedSession(req.user, toInt(req.params.id));
  if (session.mode !== 'QR') throw badRequest('Esta sesión no usa código QR');
  if (!isOpen(session)) return res.json({ open: false, endsAt: session.endsAt, startsAt: session.startsAt });
  const { token, expiresInMs } = currentToken(session);
  const url = `${config.appUrl}/asistencia/marcar?s=${session.id}&t=${token}`;
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: 'M' });
  const attended = await prisma.attendanceRecord.count({ where: { sessionId: session.id, status: { not: 'AUSENTE' } } });
  res.json({ open: true, token, url, qrDataUrl, expiresInMs, rotateSeconds: session.rotateSeconds, endsAt: session.endsAt, attended });
});

router.put('/attendance/sessions/:id', async (req, res) => {
  const session = await getManagedSession(req.user, toInt(req.params.id));
  const data = parse(
    z.object({
      title: z.string().trim().min(2).max(120).optional(),
      endsAt: z.coerce.date().optional(),
      closeNow: z.boolean().optional(),
      extendMin: z.number().int().min(1).max(240).optional(),
    }),
    req.body,
  );
  let endsAt = data.endsAt ?? session.endsAt;
  if (data.closeNow) endsAt = new Date();
  if (data.extendMin) endsAt = new Date(Math.max(Date.now(), session.endsAt.getTime()) + data.extendMin * 60_000);
  const updated = await prisma.attendanceSession.update({
    where: { id: session.id },
    data: { title: data.title ?? session.title, endsAt },
  });
  const { secret, ...rest } = updated;
  res.json({ session: rest });
});

router.delete('/attendance/sessions/:id', async (req, res) => {
  const session = await getManagedSession(req.user, toInt(req.params.id));
  await prisma.attendanceSession.delete({ where: { id: session.id } });
  res.json({ ok: true });
});

// Edición manual (justificaciones, correcciones).
router.put('/attendance/sessions/:id/records/:userId', async (req, res) => {
  const session = await getManagedSession(req.user, toInt(req.params.id));
  const userId = toInt(req.params.userId, 'userId');
  if (!(await isEnrolled(userId, session.courseId))) throw badRequest('El estudiante no está inscrito en el curso');
  const data = parse(z.object({ status: z.enum(STATUSES), note: z.string().trim().max(500).nullable().optional() }), req.body);
  const record = await prisma.attendanceRecord.upsert({
    where: { sessionId_userId: { sessionId: session.id, userId } },
    create: { sessionId: session.id, userId, status: data.status, note: data.note ?? null, method: 'MANUAL' },
    update: { status: data.status, note: data.note ?? null, method: 'MANUAL' },
  });
  res.json({ record });
});

// ----------------------------- Estudiante --------------------------------------

// Escaneo del QR. Validación en memoria + 2 consultas indexadas (RNF-02: < 2 s).
router.post('/attendance/scan', async (req, res) => {
  const started = Date.now();
  const { sessionId, token } = parse(z.object({ sessionId: z.coerce.number().int().positive(), token: z.string().min(1).max(64) }), req.body);
  const session = await prisma.attendanceSession.findUnique({ where: { id: sessionId }, include: { course: { select: { name: true } } } });
  if (!session || session.mode !== 'QR') throw notFound('Sesión de asistencia no encontrada');
  if (!isOpen(session)) throw badRequest('La sesión de asistencia no está abierta');
  if (!isValidToken(session, token)) throw badRequest('El código QR expiró; escanea el código actual');
  const { record, already } = await markStudent(session, req.user, 'QR');
  res.json({ record, already, courseName: session.course.name, sessionTitle: session.title, elapsedMs: Date.now() - started });
});

// Marcado dentro de la ventana de horario.
router.post('/attendance/sessions/:id/check-in', async (req, res) => {
  const session = await prisma.attendanceSession.findUnique({ where: { id: toInt(req.params.id) }, include: { course: { select: { name: true } } } });
  if (!session) throw notFound('Sesión de asistencia no encontrada');
  if (session.mode !== 'VENTANA') throw badRequest('Esta sesión requiere escanear el código QR del profesor');
  if (!isOpen(session)) throw badRequest('La ventana de asistencia no está abierta');
  const { record, already } = await markStudent(session, req.user, 'VENTANA');
  res.json({ record, already, courseName: session.course.name, sessionTitle: session.title });
});

// Sesiones abiertas en los cursos del estudiante (para el panel de inicio).
router.get('/attendance/open', async (req, res) => {
  const now = new Date();
  const sessions = await prisma.attendanceSession.findMany({
    where: { startsAt: { lte: now }, endsAt: { gte: now }, course: { enrollments: { some: { userId: req.user.id } } } },
    include: { course: { select: { id: true, name: true } }, records: { where: { userId: req.user.id } } },
    orderBy: { endsAt: 'asc' },
  });
  res.json({
    sessions: sessions.map(({ secret, records, ...s }) => ({ ...s, myStatus: records[0]?.status ?? null })),
  });
});

export default router;
