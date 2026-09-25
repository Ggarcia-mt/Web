import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, Download, Plus, QrCode, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, useLoad } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { ATTENDANCE_STATUS, formatDate, fromLocalInput } from '../../lib/format.js';

function CreateSessionModal({ course, open, onClose }) {
  const navigate = useNavigate();
  const today = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  const [form, setForm] = useState({ title: `Clase ${today}`, mode: 'QR', durationMin: 15, lateAfterMin: '', rotateSeconds: 30, startsAt: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body = {
        title: form.title,
        mode: form.mode,
        durationMin: Number(form.durationMin),
        rotateSeconds: Number(form.rotateSeconds),
        lateAfterMin: form.lateAfterMin ? Number(form.lateAfterMin) : null,
      };
      if (form.startsAt) body.startsAt = fromLocalInput(form.startsAt);
      const { session } = await api.post(`/courses/${course.id}/attendance`, body);
      navigate(`/asistencia/sesion/${session.id}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tomar asistencia"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button form="session-form" type="submit" loading={loading}>
            Abrir sesión
          </Button>
        </>
      }
    >
      <Alert>{error}</Alert>
      <form id="session-form" onSubmit={submit} className="space-y-4">
        <Field label="Título">
          <Input required value={form.title} onChange={set('title')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'QR', title: 'Código QR dinámico', text: 'Proyecta el QR; cambia cada pocos segundos.' },
            { id: 'VENTANA', title: 'Ventana de horario', text: 'Los estudiantes marcan desde la app en el horario.' },
          ].map((m) => (
            <button
              type="button"
              key={m.id}
              onClick={() => setForm({ ...form, mode: m.id })}
              className={`rounded-lg border p-3 text-left text-sm ${form.mode === m.id ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-200' : 'border-slate-200'}`}
            >
              <p className="font-medium">{m.title}</p>
              <p className="text-xs text-slate-500">{m.text}</p>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Duración (minutos)">
            <Input type="number" min={1} max={600} required value={form.durationMin} onChange={set('durationMin')} />
          </Field>
          <Field label="Tarde después de (min)" hint="Vacío = sin control de tardanza">
            <Input type="number" min={1} max={600} value={form.lateAfterMin} onChange={set('lateAfterMin')} />
          </Field>
        </div>
        {form.mode === 'QR' ? (
          <Field label="El QR cambia cada">
            <Select value={form.rotateSeconds} onChange={set('rotateSeconds')}>
              {[15, 30, 60].map((s) => (
                <option key={s} value={s}>
                  {s} segundos
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Inicio" hint="Vacío = ahora mismo. Programa la ventana según el horario de clase.">
            <Input type="datetime-local" value={form.startsAt} onChange={set('startsAt')} />
          </Field>
        )}
      </form>
    </Modal>
  );
}

function ManagerView({ course }) {
  const { data, loading, error, reload } = useLoad(() => api.get(`/courses/${course.id}/attendance`), [course.id]);
  const [creating, setCreating] = useState(false);

  const remove = async (s) => {
    if (!window.confirm(`¿Eliminar la sesión "${s.title}" y sus registros?`)) return;
    await api.del(`/attendance/sessions/${s.id}`);
    reload();
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button icon={Plus} onClick={() => setCreating(true)}>
          Tomar asistencia
        </Button>
        <Button variant="secondary" icon={Download} onClick={() => api.download(`/courses/${course.id}/export/attendance.xlsx`, 'asistencia.xlsx')}>
          Exportar a Excel
        </Button>
      </div>
      {loading ? (
        <Spinner />
      ) : error ? (
        <Alert>{error}</Alert>
      ) : data.sessions.length === 0 ? (
        <EmptyState icon={CalendarClock} title="Sin sesiones de asistencia">
          Abre una sesión con QR dinámico o una ventana de horario para que los estudiantes marquen desde su celular.
        </EmptyState>
      ) : (
        <Card className="divide-y divide-slate-100">
          {data.sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{s.title}</p>
                  {s.open && <Badge tone="green">Abierta</Badge>}
                </div>
                <p className="text-xs text-slate-500">
                  {s.mode === 'QR' ? 'QR dinámico' : 'Ventana'} · {formatDate(s.startsAt)} · {s.attended} asistentes
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant={s.open ? 'primary' : 'secondary'} to={`/asistencia/sesion/${s.id}`}>
                  {s.open ? 'Abrir' : 'Ver'}
                </Button>
                <button onClick={() => remove(s)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Eliminar sesión">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}
      <CreateSessionModal course={course} open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function StudentView({ course }) {
  const { data, loading, error, reload } = useLoad(() => api.get(`/courses/${course.id}/attendance`), [course.id]);
  const [msg, setMsg] = useState(null);

  const checkIn = async (s) => {
    try {
      const r = await api.post(`/attendance/sessions/${s.id}/check-in`);
      setMsg({ tone: 'success', text: r.already ? 'Ya tenías la asistencia registrada.' : 'Asistencia registrada.' });
      reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err.message });
    }
  };

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  const past = data.sessions.filter((s) => s.myStatus);
  const attended = past.filter((s) => s.myStatus !== 'AUSENTE').length;

  return (
    <>
      {msg && (
        <Alert tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}
      {past.length > 0 && (
        <p className="mb-4 text-sm text-slate-600">
          Asistencia acumulada: <b>{Math.round((attended / past.length) * 100)}%</b> ({attended} de {past.length} sesiones)
        </p>
      )}
      {data.sessions.length === 0 ? (
        <EmptyState icon={CalendarClock} title="Aún no hay sesiones de asistencia" />
      ) : (
        <Card className="divide-y divide-slate-100">
          {data.sessions.map((s) => {
            const status = s.myStatus && ATTENDANCE_STATUS[s.myStatus];
            const pending = s.open && (!s.myStatus || s.myStatus === 'AUSENTE');
            return (
              <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-xs text-slate-500">{formatDate(s.startsAt)}</p>
                </div>
                {pending ? (
                  s.mode === 'QR' ? (
                    <Button size="sm" icon={QrCode} to="/app/escanear">
                      Escanear
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => checkIn(s)}>
                      Marcar
                    </Button>
                  )
                ) : status ? (
                  <Badge tone={status.tone}>{status.label}</Badge>
                ) : (
                  <Badge>Programada</Badge>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}

export default function AttendanceTab({ course, manager }) {
  return manager ? <ManagerView course={course} /> : <StudentView course={course} />;
}
