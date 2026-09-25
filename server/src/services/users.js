import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { randomPassword } from '../utils/codes.js';

const emailOk = z.string().email();

/**
 * Crea o reutiliza una cuenta de estudiante y (opcionalmente) la inscribe en un curso.
 * - Si no existe: la crea con contraseña temporal (el documento, o una aleatoria) y obliga a cambiarla.
 * - Si existe como INDEPENDIENTE: pasa a ESTUDIANTE (estudiante de curso).
 * Devuelve { user, created, tempPassword }.
 */
export async function upsertStudent({ name, email, document }, courseId) {
  email = String(email || '').trim().toLowerCase();
  if (!emailOk.safeParse(email).success) throw new Error(`correo inválido "${email}"`);

  let user = await prisma.user.findUnique({ where: { email } });
  let created = false;
  let tempPassword = null;

  if (!user) {
    if (!name || name.trim().length < 3) throw new Error(`falta el nombre para ${email}`);
    tempPassword = document && String(document).length >= 8 ? String(document) : randomPassword();
    user = await prisma.user.create({
      data: {
        name: name.trim(),
        email,
        document: document ? String(document) : null,
        role: 'ESTUDIANTE',
        passwordHash: await bcrypt.hash(tempPassword, 10),
        mustChangePassword: true,
      },
    });
    created = true;
  } else if (user.role === 'INDEPENDIENTE') {
    user = await prisma.user.update({ where: { id: user.id }, data: { role: 'ESTUDIANTE' } });
  }

  if (courseId) {
    if (user.role === 'PROFESOR' || user.role === 'ADMIN') throw new Error(`${email} es ${user.role.toLowerCase()}, no se puede inscribir como estudiante`);
    await prisma.enrollment.upsert({
      where: { courseId_userId: { courseId, userId: user.id } },
      create: { courseId, userId: user.id },
      update: {},
    });
  }

  return { user, created, tempPassword };
}
