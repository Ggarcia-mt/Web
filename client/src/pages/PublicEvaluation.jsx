// Acceso a una evaluación pública: visitantes anónimos (nombre) o usuarios con sesión.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Clock, ListChecks, Send } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { formatDate } from '../lib/format.js';
import { Alert, Button, Card, Field, Input, Spinner, useLoad } from '../components/ui.jsx';
import { Logo } from '../components/Layout.jsx';

export default function PublicEvaluation() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data, loading, error } = useLoad(() => api.get(`/take/public/${code}`), [code]);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(null);

  const start = async (e) => {
    e.preventDefault();
    setStartError(null);
    setStarting(true);
    try {
      const body = user ? {} : { guestName: guestName.trim(), guestEmail: guestEmail.trim() };
      const res = await api.post(`/take/public/${code}/start`, body);
      if (res.guestToken) {
        try {
          sessionStorage.setItem(`guest_${res.submissionId}`, res.guestToken);
        } catch {
          /* almacenamiento no disponible */
        }
      }
      navigate(`/presentar/${res.submissionId}`);
    } catch (err) {
      setStartError(err.message);
      setStarting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <Link to="/">
            <Logo />
          </Link>
          {!user && (
            <Link to={`/login?next=${encodeURIComponent(`/e/${code}`)}`} className="text-sm font-medium text-brand-700 hover:underline">
              Iniciar sesión
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-8">
        {loading || authLoading ? (
          <Spinner />
        ) : error ? (
          <Alert>{error}</Alert>
        ) : (
          <Card className="p-6">
            {data.evaluation.courseName && <p className="text-sm font-medium text-brand-700">{data.evaluation.courseName}</p>}
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{data.evaluation.title}</h1>
            {data.evaluation.description && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{data.evaluation.description}</p>}

            <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <ListChecks className="size-4 text-slate-400" /> {data.evaluation.questionCount} preguntas
              </li>
              <li className="flex items-center gap-2">
                <Clock className="size-4 text-slate-400" />
                {data.evaluation.timeLimitMin ? `${data.evaluation.timeLimitMin} minutos para responder` : 'Sin límite de tiempo'}
              </li>
              {data.evaluation.closesAt && (
                <li className="flex items-center gap-2">
                  <Clock className="size-4 text-slate-400" /> Cierra el {formatDate(data.evaluation.closesAt)}
                </li>
              )}
            </ul>

            {data.blockReason && (
              <div className="mt-5">
                <Alert tone="warning">{data.blockReason}</Alert>
              </div>
            )}
            {startError && (
              <div className="mt-5">
                <Alert>{startError}</Alert>
              </div>
            )}

            <form onSubmit={start} className="mt-6 space-y-4">
              {user ? (
                <p className="text-sm text-slate-600">
                  Presentarás como <b>{user.name}</b>.
                </p>
              ) : (
                <>
                  <Field label="Tu nombre completo">
                    <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} required minLength={3} maxLength={120} autoComplete="name" />
                  </Field>
                  <Field label="Correo (opcional)" hint="Para que el profesor pueda identificarte">
                    <Input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} autoComplete="email" />
                  </Field>
                </>
              )}
              <Button type="submit" size="lg" icon={Send} className="w-full" loading={starting} disabled={Boolean(data.blockReason)}>
                {user ? `Presentar como ${user.name.split(' ')[0]}` : 'Comenzar'}
              </Button>
              {data.evaluation.timeLimitMin && <p className="text-center text-xs text-slate-500">El tiempo empieza a correr al presionar el botón.</p>}
              {!user && (
                <p className="text-center text-sm text-slate-500">
                  ¿Tienes cuenta?{' '}
                  <Link to={`/login?next=${encodeURIComponent(`/e/${code}`)}`} className="font-medium text-brand-700 hover:underline">
                    Inicia sesión
                  </Link>
                </p>
              )}
            </form>
          </Card>
        )}
      </main>
    </div>
  );
}
