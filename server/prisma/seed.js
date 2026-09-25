// Datos iniciales: administrador y (opcionalmente) datos de demostración.
// Uso: npm run db:seed            -> crea/actualiza el administrador
//      SEED_DEMO=true npm run db:seed -> además crea profesor, estudiantes y un curso de ejemplo
import '../src/env.js';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function upsertUser(email, name, role, password) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, role, passwordHash: await bcrypt.hash(password, 10) },
  });
}

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@campuspoli.edu.co').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminPassword) {
    // Solo crea el administrador si no existe; no cambia la clave de uno existente.
    await upsertUser(adminEmail, 'Administrador CampusPoli', 'ADMIN', adminPassword);
    console.log(`Administrador listo: ${adminEmail}`);
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('ADMIN_PASSWORD no está definido: no se creó el administrador inicial.');
  } else {
    await upsertUser(adminEmail, 'Administrador CampusPoli', 'ADMIN', 'Admin12345');
    console.log(`Administrador (desarrollo): ${adminEmail} / Admin12345`);
  }

  if (process.env.SEED_DEMO !== 'true') return;

  const teacher = await upsertUser('profesor@campuspoli.edu.co', 'Pablo Ortiz', 'PROFESOR', 'Profesor123');
  const students = [];
  for (const [i, name] of ['Juan David Arroyave', 'Juan David Moreno', 'Sara Milena', 'Johari Gutiérrez'].entries()) {
    students.push(await upsertUser(`estudiante${i + 1}@campuspoli.edu.co`, name, 'ESTUDIANTE', 'Estudiante123'));
  }
  await upsertUser('independiente@campuspoli.edu.co', 'Visitante Independiente', 'INDEPENDIENTE', 'Estudiante123');

  let course = await prisma.course.findUnique({ where: { joinCode: 'WEB2026' } });
  if (!course) {
    course = await prisma.course.create({
      data: {
        name: 'Construcción de Elementos de Software Web',
        description: 'Curso de demostración de CampusPoli',
        period: '2026-2',
        joinCode: 'WEB2026',
        teacherId: teacher.id,
        enrollments: { create: students.map((s) => ({ userId: s.id })) },
        evaluations: {
          create: {
            authorId: teacher.id,
            title: 'Quiz 1 - Fundamentos de HTML',
            type: 'EJERCICIO',
            status: 'PUBLICADA',
            weight: 20,
            maxAttempts: 2,
            timeLimitMin: 15,
            questions: {
              create: [
                { order: 0, type: 'MULTIPLE', prompt: '¿Qué etiqueta HTML define un hipervínculo?', options: ['<a>', '<link>', '<href>', '<url>'], correctOption: 0, points: 1, explanation: 'La etiqueta <a> crea enlaces.' },
                { order: 1, type: 'MULTIPLE', prompt: '¿Qué atributo indica la ruta de una imagen?', options: ['href', 'src', 'alt', 'path'], correctOption: 1, points: 1 },
                { order: 2, type: 'COMPLETAR', prompt: 'El lenguaje de estilos de la web se llama ___.', answers: ['CSS', 'hojas de estilo en cascada'], points: 1 },
              ],
            },
          },
        },
      },
    });
  }
  console.log('Datos demo: profesor@campuspoli.edu.co / Profesor123, estudiante1..4@campuspoli.edu.co / Estudiante123, código de curso WEB2026');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
