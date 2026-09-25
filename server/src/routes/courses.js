// Cursos, inscripciones, notas consolidadas y exportaciones a Excel.
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { excelUpload, requireFile } from '../middleware/upload.js';
import { getManagedCourse, getVisibleCourse } from '../services/access.js';
import { STUDENT_ALIASES, attendanceWorkbook, gradebookWorkbook, readRows, sendXlsx, studentsTemplate, toBuffer } from '../services/excel.js';
import { buildGradebook } from '../services/gradebook.js';
import { upsertStudent } from '../services/users.js';
import { randomCode } from '../utils/codes.js';
import { badRequest, notFound, parse, toInt } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

const courseSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  period: z.string().trim().max(20).optional().nullable(),
  active: z.boolean().optional(),
  teacherId: z.number().int().positive().optional(), // solo admin
});

async function uniqueJoinCode() {
  for (let i = 0; i < 10; i++) {
    const code = randomCode(6);
    if (!(await prisma.course.findUnique({ where: { joinCode: code } }))) return code;
  }
  throw new Error('No se pudo generar un código único');
}

router.get('/', async (req, res) => {
  const { user } = req;
  const where =
    user.role === 'ADMIN' ? {} : user.role === 'PROFESOR' ? { teacherId: user.id } : { enrollments: { some: { userId: user.id } } };
  const courses = await prisma.course.findMany({
    where,
    include: {
      teacher: { select: { id: true, name: true } },
      _count: { select: { enrollments: true, evaluations: true, sessions: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ courses });
});

router.get('/students-template.xlsx', async (req, res) => {
  sendXlsx(res, await toBuffer(studentsTemplate()), 'plantilla_estudiantes.xlsx');
});

router.post('/', requireRole('PROFESOR', 'ADMIN'), async (req, res) => {
  const data = parse(courseSchema, req.body);
  let teacherId = req.user.id;
  if (req.user.role === 'ADMIN' && data.teacherId) {
    const t = await prisma.user.findUnique({ where: { id: data.teacherId } });
    if (!t || t.role !== 'PROFESOR') throw badRequest('El profesor indicado no existe');
    teacherId = t.id;
  }
  const course = await prisma.course.create({
    data: { name: data.name, description: data.description, period: data.period, teacherId, joinCode: await uniqueJoinCode() },
  });
  res.status(201).json({ course });
});

// Unirse con código: el estudiante independiente pasa a ser estudiante de curso.
router.post('/join', requireRole('ESTUDIANTE', 'INDEPENDIENTE'), async (req, res) => {
  const { code } = parse(z.object({ code: z.string().trim().toUpperCase().min(4) }), req.body);
  const course = await prisma.course.findUnique({ where: { joinCode: code } });
  if (!course || !course.active) throw notFound('No hay un curso activo con ese código');
  await upsertStudent({ email: req.user.email }, course.id);
  res.json({ course });
});

router.get('/:id', async (req, res) => {
  const { course, manager } = await getVisibleCourse(req.user, toInt(req.params.id));
  const full = await prisma.course.findUnique({
    where: { id: course.id },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      _count: { select: { enrollments: true, evaluations: true, sessions: true } },
    },
  });
  if (!manager) delete full.joinCode;
  res.json({ course: full, manager });
});

router.put('/:id', async (req, res) => {
  const course = await getManagedCourse(req.user, toInt(req.params.id));
  const data = parse(courseSchema.partial(), req.body);
  if (req.user.role !== 'ADMIN') delete data.teacherId;
  const updated = await prisma.course.update({ where: { id: course.id }, data });
  res.json({ course: updated });
});

router.post('/:id/regenerate-code', async (req, res) => {
  const course = await getManagedCourse(req.user, toInt(req.params.id));
  const updated = await prisma.course.update({ where: { id: course.id }, data: { joinCode: await uniqueJoinCode() } });
  res.json({ course: updated });
});

router.delete('/:id', async (req, res) => {
  const course = await getManagedCourse(req.user, toInt(req.params.id));
  await prisma.course.delete({ where: { id: course.id } });
  res.json({ ok: true });
});

// --------------------------- Estudiantes ------------------------------------

router.get('/:id/students', async (req, res) => {
  const course = await getManagedCourse(req.user, toInt(req.params.id));
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: course.id },
    include: { user: { select: { id: true, name: true, email: true, document: true, role: true, mustChangePassword: true } } },
    orderBy: { user: { name: 'asc' } },
  });
  res.json({ students: enrollments.map((e) => ({ ...e.user, enrolledAt: e.createdAt })) });
});

router.post('/:id/students', async (req, res) => {
  const course = await getManagedCourse(req.user, toInt(req.params.id));
  const data = parse(
    z.object({
      email: z.string().trim().toLowerCase().email(),
      name: z.string().trim().max(120).optional(),
      document: z.string().trim().max(30).optional(),
    }),
    req.body,
  );
  try {
    const result = await upsertStudent(data, course.id);
    res.status(201).json({ student: { id: result.user.id, name: result.user.name, email: result.user.email }, created: result.created, tempPassword: result.tempPassword });
  } catch (err) {
    throw badRequest(err.message);
  }
});

router.post('/:id/students/import', excelUpload, async (req, res) => {
  const course = await getManagedCourse(req.user, toInt(req.params.id));
  const rows = await readRows(requireFile(req), STUDENT_ALIASES);
  const results = { enrolled: 0, created: [], errors: [] };
  for (const r of rows) {
    try {
      const out = await upsertStudent({ name: r.nombre, email: r.correo, document: r.documento }, course.id);
      results.enrolled++;
      if (out.created) results.created.push({ name: out.user.name, email: out.user.email, tempPassword: out.tempPassword });
    } catch (err) {
      results.errors.push(`Fila ${r._row}: ${err.message}`);
    }
  }
  res.json(results);
});

router.delete('/:id/students/:userId', async (req, res) => {
  const course = await getManagedCourse(req.user, toInt(req.params.id));
  await prisma.enrollment.delete({
    where: { courseId_userId: { courseId: course.id, userId: toInt(req.params.userId, 'userId') } },
  });
  res.json({ ok: true });
});

// El estudiante puede salirse del curso.
router.delete('/:id/leave', async (req, res) => {
  const courseId = toInt(req.params.id);
  await prisma.enrollment.delete({ where: { courseId_userId: { courseId, userId: req.user.id } } });
  res.json({ ok: true });
});

// --------------------------- Notas y reportes -------------------------------

router.get('/:id/gradebook', async (req, res) => {
  const { course, manager } = await getVisibleCourse(req.user, toInt(req.params.id));
  const gradebook = await buildGradebook(course.id, manager ? {} : { onlyUserId: req.user.id });
  res.json(gradebook);
});

router.get('/:id/export/grades.xlsx', async (req, res) => {
  const course = await getManagedCourse(req.user, toInt(req.params.id));
  const gb = await buildGradebook(course.id);
  sendXlsx(res, await toBuffer(gradebookWorkbook(course, gb)), `notas_${course.name}.xlsx`);
});

router.get('/:id/export/attendance.xlsx', async (req, res) => {
  const course = await getManagedCourse(req.user, toInt(req.params.id));
  const gb = await buildGradebook(course.id);
  sendXlsx(res, await toBuffer(attendanceWorkbook(course, gb)), `asistencia_${course.name}.xlsx`);
});

export default router;
