// Vista del profesor para proyectar el QR dinámico y ver quién va llegando.
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Clock, Maximize2, Square, Timer } from 'lucide-react';
import { Alert, Badge, Button, Card, Select, Spinner, useLoad } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { ATTENDANCE_STATUS, formatCountdown, formatDate } from '../lib/format.js';

function useNow(intervalMs = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function QrPanel({ session, onClosed }) {
  const [qr, setQr] = useState(null);
  const [error, setError] = useState(null);
  const now = useNow();

  const fetchQr = useCallback(async () => {
    try {
      const data = await api.get(`/attendance/sessions/${session.id}/qr`);
      setQr({ ...data, receivedAt: Date.now() });
      setError(null);
      if (!data.open) onClosed();
    } catch (err) {
      setError(err.message);
    }
  }, [session.id, onClosed]);

  useEffect(() => {
    fetchQr();
  }, [fetchQr]);

  // Pide el siguiente QR justo cuando rota el actual.
  useEffect(() => {
    if (!qr?.open) return undefined;
    const t = setTimeout(fetchQr, Math.max(500, qr.expiresInMs + 150));
    return () => clearTimeout(t);
  }, [qr, fetchQr]);

  if (error) return <Alert>{error}</Alert>;
  if (!qr) return <Spinner label="Generando código…" />;
  if (!qr.open) return null;

  const rotateLeft = Math.max(0, qr.expiresInMs - (now - qr.receivedAt));
  const pct = (rotateLeft / (qr.rotateSeconds * 1000)) * 100;

  return (
    <div className="flex flex-col items-center">
      <img src={qr.qrDataUrl} alt="Código QR de asistencia" className="aspect-square w-full max-w-md rounded-xl bg-white p-2 shadow-lg" />
      <div className="mt-4 h-2 w-full max-w-md overflow-hidden rounded-full bg-slate-200">
        <div className="h-full bg-brand-600 transition-[width] duration-200 ease-linear" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-slate-500">El código cambia en {Math.ceil(rotateLeft / 1000)} s</p>
      <p className="mt-1 font-mono text-sm text-slate-500">
        Código manual: {session.id}-{qr.token}
      </p>
    </div>
  );
}

export default function AttendanceLive() {
  const { id } = useParams();
  const { data, loading, error, reload } = useLoad(() => api.get(`/attendance/sessions/${id}`), [id]);
  const [extend, setExtend] = useState(10);
  const now = useNow(1000);

  // Actualiza la lista de asistentes cada 5 s mientras la sesión está abierta.
  const isOpen = data?.session.open;
  useEffect(() => {
    if (!isOpen) return undefined;
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const onClosed = useCallback(() => reload(), [reload]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !data) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  const { session, roster } = data;
  const attended = roster.filter((r) => r.status !== 'AUSENTE').length;
  const remaining = new Date(session.endsAt).getTime() - now;

  const update = async (body) => {
    await api.put(`/attendance/sessions/${session.id}`, body);
    reload();
  };

  const setStatus = async (student, status) => {
    await api.put(`/attendance/sessions/${session.id}/records/${student.id}`, { status });
    reload();
  };

  const fullscreen = () => document.documentElement.requestFullscreen?.();

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div>
          <Link to={`/app/cursos/${session.courseId}?tab=asistencia`} className="text-sm text-brand-700 hover:underline">
            ← {session.courseName}
          </Link>
          <h1 className="text-lg font-bold">{session.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={session.open ? 'green' : 'slate'}>{session.open ? 'Abierta' : new Date(session.startsAt) > now ? 'Programada' : 'Cerrada'}</Badge>
          <Badge tone="blue">{session.mode === 'QR' ? 'QR dinámico' : 'Ventana de horario'}</Badge>
          {session.mode === 'QR' && session.open && (
            <Button size="sm" variant="ghost" icon={Maximize2} onClick={fullscreen}>
              Pantalla completa
            </Button>
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <Timer className="size-8 text-brand-700" />
              <div>
                <p className="text-xs text-slate-500">{session.open ? 'Cierra en' : 'Horario'}</p>
                <p className="font-mono text-2xl font-bold">
                  {session.open ? formatCountdown(remaining) : `${formatDate(session.startsAt)} – ${new Date(session.endsAt).toLocaleTimeString('es-CO', { timeStyle: 'short' })}`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Asistentes</p>
              <p className="text-2xl font-bold">
                {attended}
                <span className="text-base font-normal text-slate-400"> / {roster.length}</span>
              </p>
            </div>
          </Card>

          {session.open && session.mode === 'QR' && (
            <Card className="p-6">
              <QrPanel session={session} onClosed={onClosed} />
              <p className="mt-4 text-center text-sm text-slate-600">
                Los estudiantes escanean con la cámara del celular o desde <b>CampusPoli → Asistencia</b>.
              </p>
            </Card>
          )}
          {session.open && session.mode === 'VENTANA' && (
            <Alert tone="info">La ventana está abierta: los estudiantes inscritos pueden marcar su asistencia desde su panel de inicio o desde el curso.</Alert>
          )}

          <Card className="flex flex-wrap items-center gap-2 p-4">
            <Clock className="size-4 text-slate-500" />
            <span className="text-sm text-slate-600">{session.open ? 'Ampliar' : 'Reabrir por'}</span>
            <Select value={extend} onChange={(e) => setExtend(Number(e.target.value))} className="w-auto">
              {[5, 10, 15, 30, 60].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </Select>
            <Button size="sm" variant="secondary" onClick={() => update({ extendMin: extend })}>
              Aplicar
            </Button>
            {session.open && (
              <Button size="sm" variant="danger" icon={Square} onClick={() => update({ closeNow: true })} className="ml-auto">
                Cerrar ahora
              </Button>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="font-semibold">Lista del curso</h2>
            <p className="text-xs text-slate-500">Puedes corregir el estado manualmente (justificaciones).</p>
          </div>
          <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
            {roster.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-4 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-slate-400">
                    {s.markedAt && s.status !== 'AUSENTE' ? `${new Date(s.markedAt).toLocaleTimeString('es-CO', { timeStyle: 'short' })} · ${s.method}` : s.email}
                  </p>
                </div>
                <Select
                  value={s.status}
                  onChange={(e) => setStatus(s, e.target.value)}
                  className={`w-auto py-1 text-xs ${s.status === 'AUSENTE' ? 'text-red-600' : 'text-emerald-700'}`}
                  aria-label={`Estado de ${s.name}`}
                >
                  {Object.entries(ATTENDANCE_STATUS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </Select>
              </li>
            ))}
            {roster.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">No hay estudiantes inscritos</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
