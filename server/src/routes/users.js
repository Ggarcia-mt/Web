// Administración de usuarios y panel de estadísticas (rol ADMIN).
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { publicUser, requireRole } from '../middleware/auth.js';
import { excelUpload, requireFile } from '../middleware/upload.js';
import { USER_ALIASES, readRows, sendXlsx, toBuffer, usersTemplate, usersWorkbook } from '../services/excel.js';
import { listProviders } from '../services/ai/index.js';
import { randomPassword } from '../utils/codes.js';
import { badRequest, notFound, parse, toInt } from '../utils/http.js';

const router = Router();
router.use(requireRole('ADMIN'));

const ROLES = ['ADMIN', 'PROFESOR', 'ESTUDIANTE', 'INDEPENDIENTE'];
const userSelect = { id: true, name: true, email: true, role: true, document: true, active: true, mustChangePassword: true, createdAt: true };

router.get('/stats', async (req, res) => {
  const [byRole, courses, evaluations, submissions, sessions] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.course.count(),
    prisma.evaluation.count(),
    prisma.submission.count({ where: { submittedAt: { not: null } } }),
    prisma.attendanceSession.count(),
  ]);
  res.json({
    users: Object.fromEntries(byRole.map((r) => [r.role, r._count._all])),
    courses,
    evaluations,
    submissions,
    attendanceSessions: sessions,
    aiProviders: listProviders(),
  });
});

router.get('/', async (req, res) => {
  const search = String(req.query.search || '').trim();
  const role = ROLES.includes(req.query.role) ? req.query.role : undefined;
  const users = await prisma.user.findMany({
    where: {
      role,
      ...(search
        ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { document: { contains: search } }] }
        : {}),
    },
    select: userSelect,
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  res.json({ users });
});

router.get('/template.xlsx', async (req, res) => {
  sendXlsx(res, await toBuffer(usersTemplate()), 'plantilla_usuarios.xlsx');
});

router.get('/export.xlsx', async (req, res) => {
  const users = await prisma.user.findMany({ select: userSelect, orderBy: { name: 'asc' } });
  sendXlsx(res, await toBuffer(usersWorkbook(users)), 'usuarios_campuspoli.xlsx');
});

const createSchema = z.object({
  name: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(ROLES),
  document: z.string().trim().max(30).optional().nullable(),
  password: z.string().min(8).max(100).optional(),
});

router.post('/', async (req, res) => {
  const data = parse(createSchema, req.body);
  const tempPassword = data.password || randomPassword();
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      role: data.role,
      document: data.document,
      passwordHash: await bcrypt.hash(tempPassword, 10),
      mustChangePassword: !data.password,
    },
    select: userSelect,
  });
  res.status(201).json({ user, tempPassword: data.password ? null : tempPassword });
});

router.post('/import', excelUpload, async (req, res) => {
  const rows = await readRows(requireFile(req), USER_ALIASES);
  const results = { created: [], skipped: [], errors: [] };
  for (const r of rows) {
    const role = String(r.rol || 'ESTUDIANTE').toUpperCase().trim();
    const parsed = createSchema.safeParse({ name: r.nombre, email: r.correo, role, document: r.documento || null });
    if (!parsed.success) {
      results.errors.push(`Fila ${r._row}: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join(', ')}`);
      continue;
    }
    const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (exists) {
      results.skipped.push(parsed.data.email);
      continue;
    }
    const tempPassword = parsed.data.document && parsed.data.document.length >= 8 ? parsed.data.document : randomPassword();
    await prisma.user.create({
      data: { ...parsed.data, passwordHash: await bcrypt.hash(tempPassword, 10), mustChangePassword: true },
    });
    results.created.push({ email: parsed.data.email, name: parsed.data.name, tempPassword });
  }
  res.json(results);
});

router.put('/:id', async (req, res) => {
  const id = toInt(req.params.id);
  const data = parse(
    z.object({
      name: z.string().trim().min(3).max(120).optional(),
      email: z.string().trim().toLowerCase().email().optional(),
      role: z.enum(ROLES).optional(),
      document: z.string().trim().max(30).optional().nullable(),
      active: z.boolean().optional(),
    }),
    req.body,
  );
  if (id === req.user.id && (data.active === false || (data.role && data.role !== 'ADMIN'))) {
    throw badRequest('No puedes desactivarte ni quitarte el rol de administrador');
  }
  const user = await prisma.user.update({ where: { id }, data, select: userSelect });
  res.json({ user });
});

router.post('/:id/reset-password', async (req, res) => {
  const id = toInt(req.params.id);
  const tempPassword = randomPassword();
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(tempPassword, 10), mustChangePassword: true },
  });
  res.json({ tempPassword });
});

router.delete('/:id', async (req, res) => {
  const id = toInt(req.params.id);
  if (id === req.user.id) throw badRequest('No puedes eliminar tu propia cuenta');
  const user = await prisma.user.findUnique({ where: { id }, include: { _count: { select: { coursesTaught: true } } } });
  if (!user) throw notFound('Usuario no encontrado');
  if (user._count.coursesTaught > 0) {
    throw badRequest('El usuario es profesor de cursos; reasigna o elimina esos cursos, o desactiva la cuenta');
  }
  await prisma.user.delete({ where: { id } });
  res.json({ ok: true, user: publicUser(user) });
});

export default router;
