// Reglas de acceso reutilizables entre rutas.
import { prisma } from '../db.js';
import { forbidden, notFound } from '../utils/http.js';

/** Devuelve el curso si el usuario es su profesor o un administrador. */
export async function getManagedCourse(user, courseId) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw notFound('Curso no encontrado');
  if (user.role !== 'ADMIN' && course.teacherId !== user.id) throw forbidden('No eres el profesor de este curso');
  return course;
}

export async function isEnrolled(userId, courseId) {
  const e = await prisma.enrollment.findUnique({ where: { courseId_userId: { courseId, userId } } });
  return Boolean(e);
}

/** Devuelve el curso si el usuario lo administra o está inscrito. */
export async function getVisibleCourse(user, courseId) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw notFound('Curso no encontrado');
  if (user.role === 'ADMIN' || course.teacherId === user.id) return { course, manager: true };
  if (await isEnrolled(user.id, courseId)) return { course, manager: false };
  throw forbidden('No estás inscrito en este curso');
}

/** Evaluación + curso, validando que el usuario sea quien la administra. */
export async function getManagedEvaluation(user, evaluationId) {
  const evaluation = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    include: { course: true },
  });
  if (!evaluation) throw notFound('Evaluación no encontrada');
  if (user.role !== 'ADMIN' && evaluation.course.teacherId !== user.id) throw forbidden();
  return evaluation;
}

/**
 * ¿Puede este usuario (o anónimo si user = null) presentar la evaluación?
 * Devuelve un motivo en texto si no puede, o null si sí puede.
 */
export async function evaluationBlockReason(evaluation, user) {
  const now = new Date();
  if (evaluation.status !== 'PUBLICADA') return 'La evaluación no está publicada';
  if (evaluation.opensAt && now < evaluation.opensAt) return 'La evaluación aún no está abierta';
  if (evaluation.closesAt && now > evaluation.closesAt) return 'La evaluación ya cerró';

  if (evaluation.audience === 'PUBLICA') return null;
  if (!user) return 'Debes iniciar sesión para presentar esta evaluación';

  const enrolled = await isEnrolled(user.id, evaluation.courseId);
  if (!enrolled) return 'No estás inscrito en el curso de esta evaluación';
  if (evaluation.audience === 'ESPECIFICOS') {
    const a = await prisma.evaluationAssignee.findUnique({
      where: { evaluationId_userId: { evaluationId: evaluation.id, userId: user.id } },
    });
    if (!a) return 'Esta evaluación no está asignada a ti';
  }
  return null;
}
