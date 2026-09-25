import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { publicUser, requireAuth, signToken } from '../middleware/auth.js';
import { badRequest, parse, unauthorized } from '../utils/http.js';

const router = Router();

// Frena ataques de fuerza bruta sobre el login/registro.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

const emailSchema = z.string().trim().toLowerCase().email('correo inválido');
const passwordSchema = z.string().min(8, 'debe tener al menos 8 caracteres').max(100);

router.post('/register', authLimiter, async (req, res) => {
  const data = parse(
    z.object({
      name: z.string().trim().min(3).max(120),
      email: emailSchema,
      password: passwordSchema,
      document: z.string().trim().max(30).optional(),
      joinCode: z.string().trim().toUpperCase().optional(),
    }),
    req.body,
  );

  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw badRequest('Ya existe una cuenta con ese correo');

  let course = null;
  if (data.joinCode) {
    course = await prisma.course.findUnique({ where: { joinCode: data.joinCode } });
    if (!course || !course.active) throw badRequest('El código de curso no es válido');
  }

  // Registro público = estudiante independiente. Si trae código de curso, queda como estudiante de curso.
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      document: data.document,
      passwordHash: await bcrypt.hash(data.password, 10),
      role: course ? 'ESTUDIANTE' : 'INDEPENDIENTE',
      enrollments: course ? { create: { courseId: course.id } } : undefined,
    },
  });

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', authLimiter, async (req, res) => {
  const data = parse(z.object({ email: emailSchema, password: z.string().min(1) }), req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  const ok = user && (await bcrypt.compare(data.password, user.passwordHash));
  if (!ok) throw unauthorized('Correo o contraseña incorrectos');
  if (!user.active) throw unauthorized('Tu cuenta está desactivada, contacta al administrador');
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user), sessionIdleMinutes: config.sessionIdleMinutes });
});

router.put('/me', requireAuth, async (req, res) => {
  const data = parse(
    z.object({
      name: z.string().trim().min(3).max(120),
      document: z.string().trim().max(30).optional().nullable(),
    }),
    req.body,
  );
  const user = await prisma.user.update({ where: { id: req.user.id }, data });
  res.json({ user: publicUser(user) });
});

router.put('/password', requireAuth, async (req, res) => {
  const data = parse(z.object({ current: z.string().min(1), next: passwordSchema }), req.body);
  const ok = await bcrypt.compare(data.current, req.user.passwordHash);
  if (!ok) throw badRequest('La contraseña actual no es correcta');
  await prisma.user.update({
    where: { id: req.user.id },
    data: { passwordHash: await bcrypt.hash(data.next, 10), mustChangePassword: false },
  });
  res.json({ ok: true });
});

export default router;
