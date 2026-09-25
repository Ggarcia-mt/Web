import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, ClipboardList, Pencil, Play, Plus } from 'lucide-react';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, useLoad } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { AUDIENCE, EVAL_STATUS, formatDate, formatGrade, gradeTone } from '../../lib/format.js';

function CreateEvaluationModal({ course, open, onClose }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', type: 'EXAMEN', weight: 0 });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { evaluation } = await api.post(`/courses/${course.id}/evaluations`, { ...form, weight: Number(form.weight) || 0 });
      navigate(`/app/evaluaciones/${evaluation.id}/editar`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva evaluación"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button form="eval-form" type="submit" loading={loading}>
            Crear y agregar preguntas
          </Button>
        </>
      }
    >
      <Alert>{error}</Alert>
      <form id="eval-form" onSubmit={submit} className="space-y-4">
        <Field label="Título">
          <Input required minLength={3} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Parcial 1 - Fundamentos" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tipo">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="EXAMEN">Examen</option>
              <option value="EJERCICIO">Ejercicio</option>
            </Select>
          </Field>
          <Field label="Peso en la nota (%)">
            <Input type="number" min={0} max={100} step="0.5" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
          </Field>
        </div>
        <p className="text-xs text-slate-500">Podrás configurar fechas, tiempo límite, intentos y a quién se asigna en el siguiente paso.</p>
      </form>
    </Modal>
  );
}

function ManagerList({ course }) {
  const { data, loading, error } = useLoad(() => api.get(`/courses/${course.id}/evaluations`), [course.id]);
  const [creating, setCreating] = useState(false);
  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Peso asignado en evaluaciones publicadas:{' '}
          <b className={data.totalWeight === 100 ? 'text-emerald-700' : 'text-amber-700'}>{data.totalWeight}%</b>
          {data.totalWeight !== 100 && <span className="text-slate-500"> (lo ideal es que sume 100%)</span>}
        </p>
        <Button icon={Plus} onClick={() => setCreating(true)}>
          Nueva evaluación
        </Button>
      </div>
      {data.evaluations.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Sin evaluaciones">
          Crea exámenes o ejercicios manualmente, con IA o importando preguntas desde Excel.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {data.evaluations.map((e) => (
            <Card key={e.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge tone={EVAL_STATUS[e.status].tone}>{EVAL_STATUS[e.status].label}</Badge>
                  <Badge tone={e.type === 'EXAMEN' ? 'violet' : 'blue'}>{e.type === 'EXAMEN' ? 'Examen' : 'Ejercicio'}</Badge>
                  <span className="text-xs text-slate-500">{AUDIENCE[e.audience]}</span>
                </div>
                <p className="truncate font-semibold">{e.title}</p>
                <p className="text-xs text-slate-500">
                  {e.weight}% · {e._count.questions} preguntas · {e._count.submissions} entregas
                  {e.closesAt ? ` · cierra ${formatDate(e.closesAt)}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" icon={Pencil} to={`/app/evaluaciones/${e.id}/editar`}>
                  Editar
                </Button>
                <Button size="sm" variant="soft" icon={BarChart3} to={`/app/evaluaciones/${e.id}/resultados`}>
                  Resultados
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <CreateEvaluationModal course={course} open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function StudentList({ course }) {
  const navigate = useNavigate();
  const { data, loading, error } = useLoad(() => api.get(`/courses/${course.id}/evaluations`), [course.id]);
  const [startError, setStartError] = useState(null);
  const [starting, setStarting] = useState(null);

  const start = async (e) => {
    if (e.inProgressId) return navigate(`/presentar/${e.inProgressId}`);
    const msg = e.timeLimitMin
      ? `Tendrás ${e.timeLimitMin} minutos desde que inicies. ¿Comenzar "${e.title}"?`
      : `¿Comenzar "${e.title}"?`;
    if (!window.confirm(msg)) return;
    setStarting(e.id);
    try {
      const { submissionId } = await api.post(`/take/${e.id}/start`);
      navigate(`/presentar/${submissionId}`);
    } catch (err) {
      setStartError(err.message);
      setStarting(null);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (!data.evaluations.length) return <EmptyState icon={ClipboardList} title="No hay evaluaciones publicadas" />;

  return (
    <>
      <Alert onClose={() => setStartError(null)}>{startError}</Alert>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.evaluations.map((e) => (
          <Card key={e.id} className="flex flex-col gap-3 p-4">
            <div className="flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge tone={e.type === 'EXAMEN' ? 'violet' : 'blue'}>{e.type === 'EXAMEN' ? 'Examen' : 'Ejercicio'}</Badge>
                {e.status === 'CERRADA' && <Badge tone="amber">Cerrada</Badge>}
                {e.bestGrade !== null && <Badge tone={gradeTone(e.bestGrade)}>Nota {formatGrade(e.bestGrade)}</Badge>}
              </div>
              <p className="font-semibold">{e.title}</p>
              {e.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{e.description}</p>}
              <p className="mt-1 text-xs text-slate-500">
                {e._count.questions} preguntas · {e.weight}% · intentos {e.attemptsUsed}/{e.maxAttempts}
                {e.timeLimitMin ? ` · ${e.timeLimitMin} min` : ''}
                {e.closesAt ? ` · cierra ${formatDate(e.closesAt)}` : ''}
              </p>
              {!e.canStart && e.blockReason && <p className="mt-1 text-xs text-amber-700">{e.blockReason}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {e.canStart && (
                <Button size="sm" icon={Play} loading={starting === e.id} onClick={() => start(e)}>
                  {e.inProgressId ? 'Continuar' : e.attemptsUsed ? 'Nuevo intento' : 'Presentar'}
                </Button>
              )}
              {e.lastSubmissionId && (
                <Button size="sm" variant="secondary" to={`/presentar/${e.lastSubmissionId}`}>
                  Ver resultado
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

export default function EvaluationsTab({ course, manager }) {
  return manager ? <ManagerList course={course} /> : <StudentList course={course} />;
}
