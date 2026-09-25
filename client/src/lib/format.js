export function formatDate(value, withTime = true) {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleString('es-CO', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
}

export function formatGrade(value) {
  if (value === null || value === undefined || value === '') return '—';
  return Number(value).toFixed(1);
}

export function gradeTone(value, passing = 3) {
  if (value === null || value === undefined) return 'slate';
  return value >= passing ? 'green' : 'red';
}

/** Convierte una fecha a valor para <input type="datetime-local"> en hora local. */
export function toLocalInput(value) {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value) {
  return value ? new Date(value).toISOString() : null;
}

export function formatCountdown(ms) {
  if (ms <= 0) return '00:00';
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export const EVAL_STATUS = {
  BORRADOR: { label: 'Borrador', tone: 'slate' },
  PUBLICADA: { label: 'Publicada', tone: 'green' },
  CERRADA: { label: 'Cerrada', tone: 'amber' },
};

export const AUDIENCE = {
  CURSO: 'Todo el curso',
  ESPECIFICOS: 'Estudiantes específicos',
  PUBLICA: 'Pública (con enlace)',
};

export const ATTENDANCE_STATUS = {
  PRESENTE: { label: 'Presente', tone: 'green' },
  TARDE: { label: 'Tarde', tone: 'amber' },
  JUSTIFICADO: { label: 'Justificado', tone: 'blue' },
  AUSENTE: { label: 'Ausente', tone: 'red' },
};
