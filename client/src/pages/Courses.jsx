import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, LogIn, Plus } from 'lucide-react';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, useLoad } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { isManager, useAuth } from '../lib/auth.jsx';

export function JoinCourseForm({ onJoined }) {
  const { refresh } = useAuth();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { course } = await api.post('/courses/join', { code });
      setMsg({ tone: 'success', text: `Te uniste a ${course.name}` });
      setCode('');
      await refresh(); // el rol puede pasar de independiente a estudiante de curso
      onJoined?.(course);
    } catch (err) {
      setMsg({ tone: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };
  return (
    <form onSubmit={submit}>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="flex gap-2">
        <Input placeholder="Código del curso" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="uppercase tracking-widest" required minLength={4} />
        <Button type="submit" loading={loading} icon={LogIn}>
          Unirme
        </Button>
      </div>
    </form>
  );
}

function CreateCourseModal({ open, onClose, onCreated }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', description: '', period: '', teacherId: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const teachers = useLoad(() => (user.role === 'ADMIN' && open ? api.get('/users?role=PROFESOR') : Promise.resolve({ users: [] })), [open]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body = { name: form.name, description: form.description || null, period: form.period || null };
      if (form.teacherId) body.teacherId = Number(form.teacherId);
      const { course } = await api.post('/courses', body);
      onCreated(course);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo curso"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button form="course-form" type="submit" loading={loading}>
            Crear curso
          </Button>
        </>
      }
    >
      <Alert>{error}</Alert>
      <form id="course-form" onSubmit={submit} className="space-y-4">
        <Field label="Nombre del curso">
          <Input required minLength={3} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Periodo" hint="Ej: 2026-2">
          <Input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} />
        </Field>
        <Field label="Descripción">
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        {user.role === 'ADMIN' && (
          <Field label="Profesor a cargo" hint="Si lo dejas vacío, quedas tú como responsable.">
            <Select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
              <option value="">— Yo —</option>
              {teachers.data?.users.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.email})
                </option>
              ))}
            </Select>
          </Field>
        )}
      </form>
    </Modal>
  );
}

export default function Courses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useLoad(() => api.get('/courses'));
  const [creating, setCreating] = useState(false);
  const manager = isManager(user);

  return (
    <>
      <PageHeader
        title={manager ? 'Cursos' : 'Mis cursos'}
        subtitle={manager ? 'Administra tus cursos, estudiantes, evaluaciones y asistencia.' : 'Cursos en los que estás inscrito.'}
        actions={
          manager && (
            <Button icon={Plus} onClick={() => setCreating(true)}>
              Nuevo curso
            </Button>
          )
        }
      />
      {!manager && (
        <Card className="mb-6 p-4">
          <p className="mb-2 text-sm font-medium">Unirme a un curso con código</p>
          <JoinCourseForm onJoined={(c) => navigate(`/app/cursos/${c.id}`)} />
        </Card>
      )}
      {loading ? (
        <Spinner />
      ) : error ? (
        <Alert>{error}</Alert>
      ) : data.courses.length === 0 ? (
        <EmptyState icon={BookOpen} title="No hay cursos todavía">
          {manager ? 'Crea tu primer curso para empezar.' : 'Pide a tu profesor el código del curso.'}
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.courses.map((c) => (
            <Link key={c.id} to={`/app/cursos/${c.id}`}>
              <Card className="flex h-full flex-col p-5 transition-shadow hover:shadow-md">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900">{c.name}</p>
                  {!c.active && <Badge>Inactivo</Badge>}
                </div>
                <p className="line-clamp-2 flex-1 text-sm text-slate-500">{c.description || 'Sin descripción'}</p>
                <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>{c.period || 'Sin periodo'}</span>
                  <span>{c._count.enrollments} estudiantes</span>
                  <span>{c._count.evaluations} evaluaciones</span>
                  {manager ? <span className="font-mono text-brand-700">{c.joinCode}</span> : <span>Prof. {c.teacher.name}</span>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <CreateCourseModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(c) => {
          setCreating(false);
          reload();
          navigate(`/app/cursos/${c.id}`);
        }}
      />
    </>
  );
}
