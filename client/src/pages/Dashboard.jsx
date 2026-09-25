import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CalendarClock, ClipboardList, QrCode, Sparkles, Users } from 'lucide-react';
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner, Stat, useLoad } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { formatCountdown, formatDate, formatGrade } from '../lib/format.js';
import { JoinCourseForm } from './Courses.jsx';

function AdminHome() {
  const { data, loading, error } = useLoad(() => api.get('/users/stats'));
  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  const u = data.users;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Profesores" value={u.PROFESOR || 0} />
        <Stat icon={Users} tone="blue" label="Estudiantes de curso" value={u.ESTUDIANTE || 0} />
        <Stat icon={Users} tone="violet" label="Estudiantes independientes" value={u.INDEPENDIENTE || 0} />
        <Stat icon={BookOpen} tone="amber" label="Cursos" value={data.courses} />
        <Stat icon={ClipboardList} label="Evaluaciones" value={data.evaluations} />
        <Stat icon={ClipboardList} tone="blue" label="Intentos entregados" value={data.submissions} />
        <Stat icon={CalendarClock} tone="violet" label="Sesiones de asistencia" value={data.attendanceSessions} />
        <Stat icon={Users} tone="amber" label="Administradores" value={u.ADMIN || 0} />
      </div>
      <Card className="mt-6 p-5">
        <h2 className="mb-1 flex items-center gap-2 font-semibold">
          <Sparkles className="size-5 text-brand-700" /> Proveedores de IA
        </h2>
        <p className="mb-4 text-sm text-slate-500">Se configuran con variables de entorno en el servidor (ver README).</p>
        <ul className="divide-y divide-slate-100">
          {data.aiProviders.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {p.label} <span className="text-slate-400">{p.model ? `· ${p.model}` : ''}</span>
              </span>
              <Badge tone={p.enabled ? 'green' : 'slate'}>{p.enabled ? 'Activo' : 'Sin configurar'}</Badge>
            </li>
          ))}
        </ul>
      </Card>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button to="/app/usuarios" icon={Users}>
          Gestionar usuarios
        </Button>
        <Button to="/app/cursos" variant="secondary" icon={BookOpen}>
          Ver cursos
        </Button>
      </div>
    </>
  );
}

function TeacherHome() {
  const { data, loading, error } = useLoad(() => api.get('/courses'));
  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  const courses = data.courses;
  const students = courses.reduce((s, c) => s + c._count.enrollments, 0);
  const evaluations = courses.reduce((s, c) => s + c._count.evaluations, 0);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={BookOpen} label="Cursos" value={courses.length} />
        <Stat icon={Users} tone="blue" label="Estudiantes inscritos" value={students} />
        <Stat icon={ClipboardList} tone="violet" label="Evaluaciones" value={evaluations} />
      </div>
      <h2 className="mt-8 mb-3 font-semibold text-slate-900">Tus cursos</h2>
      {courses.length === 0 ? (
        <EmptyState icon={BookOpen} title="Aún no tienes cursos" action={<Button to="/app/cursos">Crear mi primer curso</Button>}>
          Crea un curso, comparte el código con tus estudiantes o impórtalos desde Excel.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.slice(0, 6).map((c) => (
            <Link key={c.id} to={`/app/cursos/${c.id}`}>
              <Card className="h-full p-4 transition-shadow hover:shadow-md">
                <p className="font-semibold text-slate-900">{c.name}</p>
                <p className="text-xs text-slate-500">{c.period || 'Sin periodo'} · Código {c.joinCode}</p>
                <p className="mt-3 text-sm text-slate-600">
                  {c._count.enrollments} estudiantes · {c._count.evaluations} evaluaciones
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function OpenAttendance() {
  const { data, loading, reload } = useLoad(() => api.get('/attendance/open'));
  const [msg, setMsg] = useState(null);
  const checkIn = async (s) => {
    try {
      const r = await api.post(`/attendance/sessions/${s.id}/check-in`);
      setMsg({ tone: 'success', text: r.already ? 'Ya tenías la asistencia registrada.' : `Asistencia registrada en ${r.courseName} (${r.record.status.toLowerCase()}).` });
      reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err.message });
    }
  };
  if (loading || !data?.sessions.length) return null;
  return (
    <Card className="mb-6 border-brand-200 bg-brand-50/60 p-4">
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-brand-900">
        <CalendarClock className="size-5" /> Asistencia abierta ahora
      </h2>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <ul className="space-y-2">
        {data.sessions.map((s) => (
          <li key={s.id} className="flex flex-col gap-2 rounded-lg bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{s.course.name}</p>
              <p className="text-xs text-slate-500">
                {s.title} · cierra en {formatCountdown(new Date(s.endsAt) - Date.now())}
              </p>
            </div>
            {s.myStatus && s.myStatus !== 'AUSENTE' ? (
              <Badge tone="green">Registrada</Badge>
            ) : s.mode === 'QR' ? (
              <Button size="sm" icon={QrCode} to="/app/escanear">
                Escanear QR
              </Button>
            ) : (
              <Button size="sm" onClick={() => checkIn(s)}>
                Marcar asistencia
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function StudentHome() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useLoad(async () => {
    const { courses } = await api.get('/courses');
    const lists = await Promise.all(courses.map((c) => api.get(`/courses/${c.id}/evaluations`).then((r) => r.evaluations.map((e) => ({ ...e, course: c })))));
    return { courses, pending: lists.flat().filter((e) => e.canStart && e.status === 'PUBLICADA') };
  });

  return (
    <>
      <OpenAttendance />
      {user.role === 'INDEPENDIENTE' && (
        <Card className="mb-6 p-5">
          <h2 className="font-semibold">¿Tienes un código de curso?</h2>
          <p className="mb-3 text-sm text-slate-500">
            Como estudiante independiente puedes presentar evaluaciones públicas con el enlace que te compartan. Únete a un curso para ver sus evaluaciones, notas y asistencia.
          </p>
          <JoinCourseForm onJoined={reload} />
        </Card>
      )}
      {loading ? (
        <Spinner />
      ) : error ? (
        <Alert>{error}</Alert>
      ) : (
        <>
          <h2 className="mb-3 font-semibold text-slate-900">Evaluaciones pendientes</h2>
          {data.pending.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No tienes evaluaciones pendientes">
              Cuando tus profesores publiquen evaluaciones aparecerán aquí.
            </EmptyState>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.pending.map((e) => (
                <Card key={e.id} className="flex flex-col gap-3 p-4">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <Badge tone={e.type === 'EXAMEN' ? 'violet' : 'blue'}>{e.type === 'EXAMEN' ? 'Examen' : 'Ejercicio'}</Badge>
                      {e.weight > 0 && <span className="text-xs text-slate-500">{e.weight}% de la nota</span>}
                    </div>
                    <p className="font-semibold">{e.title}</p>
                    <p className="text-xs text-slate-500">
                      {e.course.name} · {e._count.questions} preguntas{e.timeLimitMin ? ` · ${e.timeLimitMin} min` : ''}
                      {e.closesAt ? ` · cierra ${formatDate(e.closesAt)}` : ''}
                    </p>
                    {e.bestGrade !== null && <p className="mt-1 text-xs text-slate-500">Mejor nota: {formatGrade(e.bestGrade)}</p>}
                  </div>
                  <Button size="sm" to={`/app/cursos/${e.course.id}?tab=evaluaciones`} variant="soft">
                    {e.inProgressId ? 'Continuar' : 'Presentar'}
                  </Button>
                </Card>
              ))}
            </div>
          )}
          <h2 className="mt-8 mb-3 font-semibold text-slate-900">Mis cursos</h2>
          {data.courses.length === 0 ? (
            <EmptyState icon={BookOpen} title="No estás inscrito en cursos" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.courses.map((c) => (
                <Link key={c.id} to={`/app/cursos/${c.id}`}>
                  <Card className="h-full p-4 transition-shadow hover:shadow-md">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-slate-500">
                      {c.teacher.name} · {c.period || 'Sin periodo'}
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const first = user.name.split(' ')[0];
  return (
    <>
      <PageHeader title={`Hola, ${first}`} subtitle="Este es tu resumen en CampusPoli." />
      {user.role === 'ADMIN' && <AdminHome />}
      {user.role === 'PROFESOR' && <TeacherHome />}
      {(user.role === 'ESTUDIANTE' || user.role === 'INDEPENDIENTE') && <StudentHome />}
    </>
  );
}
