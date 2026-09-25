// Importación y exportación de Excel (.xlsx) (RF-06).
import ExcelJS from 'exceljs';
import { normalizeText } from '../utils/grading.js';
import { badRequest } from '../utils/http.js';

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };

function styleHeader(sheet) {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = HEADER_FILL;
  row.alignment = { vertical: 'middle' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

function newSheet(workbook, name, columns) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns;
  styleHeader(sheet);
  return sheet;
}

export async function toBuffer(workbook) {
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function sendXlsx(res, buffer, filename) {
  const safe = filename.replace(/[^\w.-]+/g, '_');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
  res.send(buffer);
}

function cellText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (value.text) return String(value.text);
    if (value.richText) return value.richText.map((r) => r.text).join('');
    if (value.result !== undefined) return String(value.result);
    if (value instanceof Date) return value.toISOString();
  }
  return String(value).trim();
}

/**
 * Lee la primera hoja y devuelve filas como objetos cuyas claves son los
 * encabezados normalizados (sin tildes, minúsculas). `aliases` mapea variantes.
 */
export async function readRows(buffer, aliases = {}) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw badRequest('El archivo no es un Excel (.xlsx) válido');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw badRequest('El archivo no tiene hojas');

  const headers = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    const key = normalizeText(cellText(cell.value));
    headers[col] = aliases[key] || key;
  });

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj = { _row: rowNumber };
    let hasData = false;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (!headers[col]) return;
      const text = cellText(cell.value);
      if (text) hasData = true;
      obj[headers[col]] = text;
    });
    if (hasData) rows.push(obj);
  });
  return rows;
}

// ----------------------------- Plantillas ---------------------------------

export const STUDENT_ALIASES = { nombre: 'nombre', 'nombre completo': 'nombre', correo: 'correo', email: 'correo', 'correo electronico': 'correo', documento: 'documento', cedula: 'documento', identificacion: 'documento' };

export function studentsTemplate() {
  const wb = new ExcelJS.Workbook();
  const sheet = newSheet(wb, 'Estudiantes', [
    { header: 'Nombre', key: 'nombre', width: 32 },
    { header: 'Correo', key: 'correo', width: 32 },
    { header: 'Documento', key: 'documento', width: 18 },
  ]);
  sheet.addRow({ nombre: 'Ana María Pérez', correo: 'ana.perez@ejemplo.edu.co', documento: '1001234567' });
  return wb;
}

export const USER_ALIASES = { ...STUDENT_ALIASES, rol: 'rol', perfil: 'rol' };

export function usersTemplate() {
  const wb = new ExcelJS.Workbook();
  const sheet = newSheet(wb, 'Usuarios', [
    { header: 'Nombre', key: 'nombre', width: 32 },
    { header: 'Correo', key: 'correo', width: 32 },
    { header: 'Rol', key: 'rol', width: 16 },
    { header: 'Documento', key: 'documento', width: 18 },
  ]);
  sheet.addRow({ nombre: 'Carlos Gómez', correo: 'carlos.gomez@ejemplo.edu.co', rol: 'PROFESOR', documento: '98765432' });
  sheet.addRow({ nombre: 'Laura Ríos', correo: 'laura.rios@ejemplo.edu.co', rol: 'ESTUDIANTE', documento: '1007654321' });
  return wb;
}

export const QUESTION_ALIASES = { tipo: 'tipo', pregunta: 'pregunta', enunciado: 'pregunta', 'opcion a': 'a', 'opcion b': 'b', 'opcion c': 'c', 'opcion d': 'd', 'opcion e': 'e', correcta: 'correcta', respuesta: 'correcta', 'respuesta correcta': 'correcta', puntos: 'puntos', puntaje: 'puntos', explicacion: 'explicacion' };

export function questionsTemplate() {
  const wb = new ExcelJS.Workbook();
  const sheet = newSheet(wb, 'Preguntas', [
    { header: 'Tipo', key: 'tipo', width: 12 },
    { header: 'Pregunta', key: 'pregunta', width: 60 },
    { header: 'A', key: 'a', width: 20 },
    { header: 'B', key: 'b', width: 20 },
    { header: 'C', key: 'c', width: 20 },
    { header: 'D', key: 'd', width: 20 },
    { header: 'Correcta', key: 'correcta', width: 24 },
    { header: 'Puntos', key: 'puntos', width: 10 },
    { header: 'Explicacion', key: 'explicacion', width: 40 },
  ]);
  sheet.addRow({ tipo: 'MULTIPLE', pregunta: '¿Qué etiqueta HTML define un enlace?', a: '<a>', b: '<link>', c: '<href>', d: '<url>', correcta: 'A', puntos: 1, explicacion: 'La etiqueta <a> crea hipervínculos.' });
  sheet.addRow({ tipo: 'COMPLETAR', pregunta: 'El lenguaje de estilos de la web se llama ___.', correcta: 'CSS | hojas de estilo en cascada', puntos: 1, explicacion: 'Varias respuestas aceptadas se separan con |' });
  return wb;
}

/** Convierte las filas de la plantilla de preguntas al formato interno. */
export function rowsToQuestions(rows) {
  const questions = [];
  const errors = [];
  for (const r of rows) {
    const tipo = normalizeText(r.tipo).toUpperCase();
    const prompt = r.pregunta?.trim();
    const points = Number(String(r.puntos || '1').replace(',', '.')) || 1;
    if (!prompt) {
      errors.push(`Fila ${r._row}: falta el enunciado`);
      continue;
    }
    if (tipo === 'MULTIPLE') {
      const letters = ['a', 'b', 'c', 'd', 'e'];
      const options = letters.map((l) => r[l]).filter((o) => o && o.trim());
      const correctLetter = normalizeText(r.correcta);
      const idx = letters.indexOf(correctLetter);
      if (options.length < 2 || idx < 0 || idx >= options.length) {
        errors.push(`Fila ${r._row}: necesita al menos 2 opciones y la letra de la correcta (A-E)`);
        continue;
      }
      questions.push({ type: 'MULTIPLE', prompt, options, correctOption: idx, answers: [], points, explanation: r.explicacion || null });
    } else if (tipo === 'COMPLETAR') {
      const answers = String(r.correcta || '').split('|').map((a) => a.trim()).filter(Boolean);
      if (!answers.length) {
        errors.push(`Fila ${r._row}: indica al menos una respuesta aceptada`);
        continue;
      }
      questions.push({ type: 'COMPLETAR', prompt: prompt.includes('___') ? prompt : `${prompt} ___`, options: [], correctOption: null, answers, points, explanation: r.explicacion || null });
    } else {
      errors.push(`Fila ${r._row}: el tipo debe ser MULTIPLE o COMPLETAR`);
    }
  }
  return { questions, errors };
}

// ----------------------------- Reportes -----------------------------------

export function gradebookWorkbook(course, gb) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CampusPoli';
  const columns = [
    { header: 'Estudiante', key: 'name', width: 32 },
    { header: 'Correo', key: 'email', width: 32 },
    { header: 'Documento', key: 'document', width: 16 },
    ...gb.evaluations.map((e) => ({ header: `${e.title} (${e.weight}%)`, key: `e${e.id}`, width: 18 })),
    { header: 'Acumulada', key: 'accumulated', width: 12 },
    { header: '% evaluado', key: 'evaluatedWeight', width: 12 },
    { header: 'Proyectada', key: 'projected', width: 12 },
    { header: 'Asistencia %', key: 'attendance', width: 14 },
  ];
  const sheet = newSheet(wb, 'Notas', columns);
  for (const r of gb.rows) {
    const row = {
      name: r.student.name,
      email: r.student.email,
      document: r.student.document || '',
      accumulated: r.accumulated,
      evaluatedWeight: r.evaluatedWeight,
      projected: r.projected ?? '',
      attendance: r.attendance.percent ?? '',
    };
    for (const e of gb.evaluations) row[`e${e.id}`] = r.grades[e.id] ?? '';
    const added = sheet.addRow(row);
    if (r.projected !== null && r.projected < gb.passingGrade) {
      added.getCell('projected').font = { color: { argb: 'FFB91C1C' }, bold: true };
    }
  }
  const info = wb.addWorksheet('Info');
  info.addRows([
    ['Curso', course.name],
    ['Periodo', course.period || ''],
    ['Escala', `0 - ${gb.scale}`],
    ['Nota aprobatoria', gb.passingGrade],
    ['Generado', new Date().toLocaleString('es-CO')],
  ]);
  info.getColumn(1).font = { bold: true };
  info.getColumn(1).width = 20;
  info.getColumn(2).width = 40;
  return wb;
}

const STATUS_SHORT = { PRESENTE: 'P', TARDE: 'T', JUSTIFICADO: 'J', AUSENTE: 'A' };

export function attendanceWorkbook(course, gb) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CampusPoli';
  const sheet = newSheet(wb, 'Asistencia', [
    { header: 'Estudiante', key: 'name', width: 32 },
    { header: 'Correo', key: 'email', width: 32 },
    ...gb.sessions.map((s) => ({
      header: `${new Date(s.startsAt).toLocaleDateString('es-CO')} ${s.title}`,
      key: `s${s.id}`,
      width: 16,
    })),
    { header: 'Presente', key: 'p', width: 10 },
    { header: 'Tarde', key: 't', width: 10 },
    { header: 'Justificado', key: 'j', width: 12 },
    { header: 'Ausente', key: 'a', width: 10 },
    { header: 'Asistencia %', key: 'percent', width: 14 },
  ]);
  for (const r of gb.rows) {
    const row = {
      name: r.student.name,
      email: r.student.email,
      p: r.attendance.PRESENTE,
      t: r.attendance.TARDE,
      j: r.attendance.JUSTIFICADO,
      a: r.attendance.AUSENTE,
      percent: r.attendance.percent ?? '',
    };
    for (const s of gb.sessions) row[`s${s.id}`] = STATUS_SHORT[r.attendance.bySession[s.id]] || 'A';
    sheet.addRow(row);
  }
  sheet.addRow([]);
  sheet.addRow([`Curso: ${course.name}`, 'P = Presente, T = Tarde, J = Justificado, A = Ausente']);
  return wb;
}

export function evaluationResultsWorkbook(evaluation, submissions) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CampusPoli';
  const sheet = newSheet(wb, 'Resultados', [
    { header: 'Participante', key: 'name', width: 32 },
    { header: 'Correo', key: 'email', width: 32 },
    { header: 'Intento', key: 'attempt', width: 10 },
    { header: 'Entregado', key: 'submittedAt', width: 22 },
    { header: 'Puntos', key: 'score', width: 10 },
    { header: 'Máximo', key: 'maxScore', width: 10 },
    { header: 'Bonificación', key: 'bonus', width: 14 },
    { header: 'Nota', key: 'grade', width: 10 },
  ]);
  for (const s of submissions) {
    sheet.addRow({
      name: s.user?.name || `${s.guestName || 'Anónimo'} (visitante)`,
      email: s.user?.email || s.guestEmail || '',
      attempt: s.attempt,
      submittedAt: s.submittedAt ? new Date(s.submittedAt).toLocaleString('es-CO') : 'En curso',
      score: s.score,
      maxScore: s.maxScore,
      bonus: s.bonus,
      grade: s.grade ?? '',
    });
  }
  sheet.name = 'Resultados';
  wb.title = evaluation.title;
  return wb;
}

export function usersWorkbook(users) {
  const wb = new ExcelJS.Workbook();
  const sheet = newSheet(wb, 'Usuarios', [
    { header: 'Nombre', key: 'name', width: 32 },
    { header: 'Correo', key: 'email', width: 32 },
    { header: 'Rol', key: 'role', width: 16 },
    { header: 'Documento', key: 'document', width: 18 },
    { header: 'Activo', key: 'active', width: 10 },
    { header: 'Creado', key: 'createdAt', width: 22 },
  ]);
  for (const u of users) {
    sheet.addRow({ ...u, active: u.active ? 'Sí' : 'No', createdAt: new Date(u.createdAt).toLocaleString('es-CO') });
  }
  return wb;
}
