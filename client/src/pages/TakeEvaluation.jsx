// Presentación de una evaluación (estudiantes y visitantes anónimos) y vista de resultado.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, CircleCheck, CircleX, Clock, Loader2, Send } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { formatCountdown, formatGrade } from '../lib/format.js';
import { Alert, Badge, Button, Card, Input, Spinner } from '../components/ui.jsx';
import { Logo } from '../components/Layout.jsx';

function readGuestToken(submissionId) {
  try {
    return sessionStorage.getItem(`guest_${submissionId}`) || undefined;
  } catch {
    return undefined;
  }
}

function PromptText({ text }) {
  const parts = String(text).split(/(_{3,})/);
  return (
    <p className="whitespace-pre-wrap text-base font-medium text-slate-800">
      {parts.map((p, i) =>
        /^_{3,}$/.test(p) ? (
          <span key={i} className="mx-1 inline-block min-w-16 border-b-2 border-brand-600 bg-brand-50 px-2 text-center text-brand-700">
            ?
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  );
}

export default function TakeEvaluation() {
  const { submissionId } = useParams();
  const { user } = useAuth();
  const guestToken = useMemo(() => readGuestToken(submissionId), [submissionId]);
  const opts = useMemo(() => ({ guestToken }), [guestToken]);

  const [view, setView] = useState(null);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState({});
  const [saveState, setSaveState] = useState('idle');
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());
  const saveTimer = useRef(null);
  const autoSubmitted = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get(`/take/submissions/${submissionId}`, opts);
      setView(data);
      const initial = {};
      for (const q of data.questions) initial[q.id] = q.value ?? null;
      setAnswers(initial);
    } catch (err) {
      setError(err.message);
    }
  }, [submissionId, opts]);

  useEffect(() => {
    load();
  }, [load]);

  const finished = Boolean(view?.submission.submittedAt);
  const deadline = view?.submission.deadline ? new Date(view.submission.deadline).getTime() : null;

  useEffect(() => {
    if (!deadline || finished) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline, finished]);

  const persist = useCallback(
    async (current) => {
      setSaveState('saving');
      try {
        await api.put(`/take/submissions/${submissionId}/answers`, { answers: current }, opts);
        setSaveState('saved');
      } catch (err) {
        setSaveState('error');
        if (err.status === 400) setError(err.message);
      }
    },
    [submissionId, opts],
  );

  const setAnswer = (questionId, value) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value === '' ? null : value };
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persist(next), 1500);
      return next;
    });
    setSaveState('pending');
  };

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const submit = useCallback(
    async (auto = false) => {
      clearTimeout(saveTimer.current);
      setSubmitting(true);
      setError(null);
      try {
        const data = await api.post(`/take/submissions/${submissionId}/submit`, { answers }, opts);
        setView(data);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        setError(auto ? `El tiempo terminó. ${err.message}` : err.message);
        if (auto) load();
      } finally {
        setSubmitting(false);
      }
    },
    [submissionId, answers, opts, load],
  );

  const remaining = deadline ? deadline - now : null;

  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !finished && !autoSubmitted.current && view) {
      autoSubmitted.current = true;
      submit(true);
    }
  }, [remaining, finished, view, submit]);

  if (error && !view) {
    return (
      <Shell>
        <Alert>{error}</Alert>
        <BackLinks user={user} />
      </Shell>
    );
  }
  if (!view) return <Spinner />;

  const { evaluation, questions } = view;

  if (finished) {
    return (
      <Shell>
        <Result view={view} />
        <BackLinks user={user} />
      </Shell>
    );
  }

  const answeredCount = questions.filter((q) => answers[q.id] !== null && answers[q.id] !== undefined && answers[q.id] !== '').length;

  const confirmSubmit = () => {
    const missing = questions.length - answeredCount;
    const msg = missing > 0 ? `Tienes ${missing} pregunta(s) sin responder. ¿Entregar de todos modos?` : '¿Entregar la evaluación? No podrás cambiar tus respuestas.';
    if (window.confirm(msg)) submit(false);
  };

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900">{evaluation.title}</p>
            <p className="text-xs text-slate-500">
              {answeredCount}/{questions.length} respondidas · <SaveIndicator state={saveState} />
            </p>
          </div>
          {remaining !== null && (
            <span
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 font-mono text-sm font-bold ${
                remaining < 60_000 ? 'bg-red-100 text-red-700' : remaining < 300_000 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
              }`}
              aria-live="polite"
            >
              <Clock className="size-4" /> {formatCountdown(remaining)}
            </span>
          )}
        </div>
        <div className="h-1 bg-slate-100">
          <div className="h-1 bg-brand-600 transition-all" style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }} />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 pb-32">
        {error && (
          <Alert onClose={() => setError(null)}>{error}</Alert>
        )}
        {(evaluation.description || evaluation.courseName) && (
          <Card className="mb-4 p-4 text-sm text-slate-600">
            {evaluation.courseName && <p className="font-medium text-slate-800">{evaluation.courseName}</p>}
            {evaluation.description && <p className="mt-1 whitespace-pre-wrap">{evaluation.description}</p>}
          </Card>
        )}

        <div className="space-y-4">
          {questions.map((q, i) => (
            <Card key={q.id} className="p-4 sm:p-5">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-brand-700">Pregunta {i + 1}</span>
                <span>
                  {q.points} {q.points === 1 ? 'punto' : 'puntos'}
                </span>
              </div>
              <PromptText text={q.prompt} />
              {q.type === 'MULTIPLE' ? (
                <div className="mt-4 space-y-2" role="radiogroup">
                  {(q.options || []).map((opt, j) => {
                    const checked = answers[q.id] === String(j);
                    return (
                      <label
                        key={j}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm transition-colors ${
                          checked ? 'border-brand-600 bg-brand-50 text-brand-900' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          className="sr-only"
                          checked={checked}
                          onChange={() => setAnswer(q.id, String(j))}
                        />
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            checked ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {String.fromCharCode(65 + j)}
                        </span>
                        <span className="flex-1">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <Input
                  className="mt-4 py-3 text-base"
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder="Escribe tu respuesta"
                  maxLength={500}
                  autoComplete="off"
                />
              )}
            </Card>
          ))}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-slate-600">
            {answeredCount} de {questions.length} respondidas
          </p>
          <Button size="lg" icon={Send} loading={submitting} onClick={confirmSubmit}>
            Entregar
          </Button>
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({ state }) {
  if (state === 'saving' || state === 'pending')
    return (
      <span className="inline-flex items-center gap-1">
        <Loader2 className="size-3 animate-spin" /> Guardando…
      </span>
    );
  if (state === 'saved')
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700">
        <Check className="size-3" /> Guardado
      </span>
    );
  if (state === 'error') return <span className="text-red-600">No se pudo guardar</span>;
  return <span>Tus respuestas se guardan solas</span>;
}

function Shell({ children }) {
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <Logo />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}

function BackLinks({ user }) {
  if (user) {
    return (
      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="secondary" to="/app">
          Volver al inicio
        </Button>
        {(user.role === 'ESTUDIANTE' || user.role === 'INDEPENDIENTE') && (
          <Button variant="ghost" to="/app/resultados">
            Mis resultados
          </Button>
        )}
      </div>
    );
  }
  return (
    <Card className="mt-6 p-4 text-sm text-slate-600">
      ¿Quieres guardar tu historial y seguir tus notas?{' '}
      <Link to="/registro" className="font-medium text-brand-700 hover:underline">
        Crea una cuenta gratis
      </Link>{' '}
      o{' '}
      <Link to="/" className="font-medium text-brand-700 hover:underline">
        vuelve al inicio
      </Link>
      .
    </Card>
  );
}

function Result({ view }) {
  const { submission, evaluation, questions, scale, passingGrade } = view;
  const passed = (submission.grade ?? 0) >= passingGrade;
  const revealed = questions.some((q) => q.isCorrect !== undefined);

  return (
    <div>
      <Card className="mb-6 p-6 text-center">
        <p className="text-sm text-slate-500">{evaluation.title}</p>
        {submission.guestName && <p className="text-xs text-slate-400">{submission.guestName}</p>}
        <p className={`mt-3 text-6xl font-bold ${passed ? 'text-brand-700' : 'text-red-600'}`}>{formatGrade(submission.grade)}</p>
        <p className="text-sm text-slate-500">de {scale}</p>
        <Badge tone={passed ? 'green' : 'red'} className="mt-3">
          {passed ? 'Aprobado' : 'No aprobado'}
        </Badge>
        <p className="mt-4 text-sm text-slate-600">
          {submission.score} de {submission.maxScore} puntos
          {submission.bonus ? ` · bonificación ${submission.bonus > 0 ? '+' : ''}${submission.bonus}` : ''}
        </p>
        {submission.feedback && (
          <div className="mx-auto mt-4 max-w-lg rounded-lg bg-slate-50 p-3 text-left text-sm">
            <p className="text-xs font-medium uppercase text-slate-500">Retroalimentación del profesor</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-700">{submission.feedback}</p>
          </div>
        )}
      </Card>

      {!revealed ? (
        <Alert tone="info">El profesor decidió no mostrar las respuestas correctas de esta evaluación.</Alert>
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => {
            const given =
              q.value === null || q.value === undefined || q.value === ''
                ? null
                : q.type === 'MULTIPLE'
                  ? `${String.fromCharCode(65 + Number(q.value))}. ${q.options?.[Number(q.value)] ?? ''}`
                  : q.value;
            const correct =
              q.type === 'MULTIPLE' ? `${String.fromCharCode(65 + q.correctOption)}. ${q.options?.[q.correctOption] ?? ''}` : (q.answers || []).join(' | ');
            return (
              <Card key={q.id} className="p-4">
                <div className="mb-2 flex items-center gap-2 text-sm">
                  {q.isCorrect ? <CircleCheck className="size-5 text-emerald-600" /> : <CircleX className="size-5 text-red-500" />}
                  <span className="font-semibold text-slate-700">Pregunta {i + 1}</span>
                  <span className="ml-auto text-xs text-slate-500">
                    {q.earned} / {q.points} pts
                  </span>
                </div>
                <PromptText text={q.prompt} />
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div className={`rounded-lg p-3 ${q.isCorrect ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <p className="text-xs uppercase text-slate-500">Tu respuesta</p>
                    <p className={given ? 'text-slate-800' : 'italic text-slate-400'}>{given ?? 'Sin responder'}</p>
                  </div>
                  {!q.isCorrect && (
                    <div className="rounded-lg bg-emerald-50 p-3">
                      <p className="text-xs uppercase text-emerald-700">Respuesta correcta</p>
                      <p className="text-emerald-900">{correct}</p>
                    </div>
                  )}
                </div>
                {q.explanation && <p className="mt-2 text-sm text-slate-500">{q.explanation}</p>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
