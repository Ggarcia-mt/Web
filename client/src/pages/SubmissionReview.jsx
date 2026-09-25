// Revisión de un intento: ajuste de puntos por pregunta, bonificación y retroalimentación (RF-05).
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CircleCheck, CircleX, Save } from 'lucide-react';
import { api } from '../lib/api.js';
import { formatDate, formatGrade, gradeTone } from '../lib/format.js';
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Spinner, Textarea, useLoad } from '../components/ui.jsx';

function answerText(q) {
  const value = q.answer?.value;
  if (value === null || value === undefined || value === '') return null;
  if (q.type === 'MULTIPLE') {
    const opt = q.options?.[Number(value)];
    return opt !== undefined ? `${String.fromCharCode(65 + Number(value))}. ${opt}` : value;
  }
  return value;
}

function correctText(q) {
  if (q.type === 'MULTIPLE') {
    const i = q.correctOption;
    return i === null || i === undefined ? '—' : `${String.fromCharCode(65 + i)}. ${q.options?.[i] ?? ''}`;
  }
  return (q.answers || []).join(' | ');
}

export default function SubmissionReview() {
  const { id } = useParams();
  const { data, loading, error, setData } = useLoad(() => api.get(`/submissions/${id}/review`), [id]);
  const [overrides, setOverrides] = useState({});
  const [bonus, setBonus] = useState('0');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!data) return;
    const o = {};
    for (const q of data.questions) o[q.id] = q.answer?.overridePoints ?? '';
    setOverrides(o);
    setBonus(String(data.submission.bonus ?? 0));
    setFeedback(data.submission.feedback || '');
  }, [data]);

  if (loading && !data) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;

  const { submission, evaluation, questions, scale } = data;
  const participant = submission.user?.name || `${submission.guestName || 'Anónimo'} (visitante)`;

  const save = async () => {
    setMsg(null);
    const list = [];
    for (const q of questions) {
      const raw = overrides[q.id];
      const points = raw === '' || raw === null || raw === undefined ? null : Number(raw);
      if (points !== null && (Number.isNaN(points) || points < 0 || points > q.points)) {
        setMsg({ tone: 'error', text: `La pregunta ${q.order + 1} admite entre 0 y ${q.points} puntos` });
        return;
      }
      const previous = q.answer?.overridePoints ?? null;
      if (points !== previous) list.push({ questionId: q.id, points });
    }
    const bonusNum = Number(String(bonus).replace(',', '.')) || 0;
    if (Math.abs(bonusNum) > scale) {
      setMsg({ tone: 'error', text: `La bonificación debe estar entre -${scale} y ${scale}` });
      return;
    }
    setSaving(true);
    try {
      const res = await api.put(`/submissions/${id}/grade`, { bonus: bonusNum, feedback: feedback.trim() || null, overrides: list });
      const fresh = await api.get(`/submissions/${id}/review`);
      setData(fresh);
      setMsg({ tone: 'success', text: `Calificación actualizada: ${formatGrade(res.submission.grade)}` });
    } catch (err) {
      setMsg({ tone: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        back={{ to: `/app/evaluaciones/${evaluation.id}/resultados`, label: 'Resultados' }}
        title={participant}
        subtitle={`${evaluation.title} · Intento ${submission.attempt} · ${submission.submittedAt ? formatDate(submission.submittedAt) : 'En curso'}`}
      />

      {msg && (
        <Alert tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      <Card className="mb-6 grid gap-4 p-5 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase text-slate-500">Nota</p>
          <p className={`text-3xl font-bold ${gradeTone(submission.grade) === 'red' ? 'text-red-600' : 'text-brand-700'}`}>
            {formatGrade(submission.grade)} <span className="text-base font-normal text-slate-400">/ {scale}</span>
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Puntos</p>
          <p className="text-3xl font-bold text-slate-800">
            {submission.score} <span className="text-base font-normal text-slate-400">/ {submission.maxScore}</span>
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Bonificación</p>
          <p className="text-3xl font-bold text-slate-800">
            {submission.bonus > 0 ? '+' : ''}
            {submission.bonus}
          </p>
        </div>
      </Card>

      <div className="space-y-4">
        {questions.map((q, i) => {
          const given = answerText(q);
          const auto = q.answer?.points ?? 0;
          const correct = q.answer?.isCorrect;
          return (
            <Card key={q.id} className="p-4 sm:p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">{i + 1}</span>
                <Badge tone={q.type === 'MULTIPLE' ? 'blue' : 'violet'}>{q.type === 'MULTIPLE' ? 'Selección múltiple' : 'Completar'}</Badge>
                {correct ? (
                  <Badge tone="green">
                    <CircleCheck className="mr-1 size-3" /> Correcta
                  </Badge>
                ) : (
                  <Badge tone="red">
                    <CircleX className="mr-1 size-3" /> {given ? 'Incorrecta' : 'Sin responder'}
                  </Badge>
                )}
                <span className="ml-auto text-sm text-slate-500">{q.points} pts</span>
              </div>
              <p className="whitespace-pre-wrap font-medium text-slate-800">{q.prompt}</p>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs uppercase text-slate-500">Respuesta del estudiante</p>
                  <p className={given ? 'text-slate-800' : 'italic text-slate-400'}>{given ?? 'Sin respuesta'}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-3">
                  <p className="text-xs uppercase text-emerald-700">Respuesta correcta</p>
                  <p className="text-emerald-900">{correctText(q)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <p className="text-sm text-slate-600">
                  Automático: <b>{auto}</b> pts
                </p>
                <Field label="Ajuste manual" hint="Vacío = usar el automático" className="w-40">
                  <Input
                    type="number"
                    min={0}
                    max={q.points}
                    step="0.25"
                    value={overrides[q.id] ?? ''}
                    onChange={(e) => setOverrides((o) => ({ ...o, [q.id]: e.target.value }))}
                    placeholder={String(auto)}
                  />
                </Field>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 grid gap-4 p-5 sm:grid-cols-[12rem_1fr]">
        <Field label={`Puntos adicionales (escala 0-${scale})`} hint="Se suman a la nota; pueden ser negativos">
          <Input type="number" step="0.1" min={-scale} max={scale} value={bonus} onChange={(e) => setBonus(e.target.value)} />
        </Field>
        <Field label="Retroalimentación para el estudiante">
          <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={3000} />
        </Field>
        <div className="sm:col-span-2">
          <Button icon={Save} loading={saving} onClick={save}>
            Guardar calificación
          </Button>
        </div>
      </Card>
    </div>
  );
}
