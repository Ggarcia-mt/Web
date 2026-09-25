// Editor de evaluaciones: configuración, ponderación, asignación, preguntas, IA y Excel.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Copy,
  CopyPlus,
  Download,
  FileSpreadsheet,
  ListChecks,
  Plus,
  Save,
  Settings,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { AUDIENCE, EVAL_STATUS, fromLocalInput, toLocalInput } from '../lib/format.js';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Tabs,
  Textarea,
  useLoad,
} from '../components/ui.jsx';

let keySeq = 0;
const newKey = () => `q${++keySeq}`;

function toLocalQuestion(q) {
  return {
    key: newKey(),
    id: q.id,
    type: q.type,
    prompt: q.prompt || '',
    options: Array.isArray(q.options) && q.options.length ? [...q.options] : q.type === 'MULTIPLE' ? ['', ''] : [],
    correctOption: q.correctOption ?? (q.type === 'MULTIPLE' ? 0 : null),
    answersText: Array.isArray(q.answers) ? q.answers.join(' | ') : '',
    points: q.points ?? 1,
    explanation: q.explanation || '',
    aiGenerated: Boolean(q.aiGenerated),
  };
}

function parseAnswers(text) {
  const sep = text.includes('|') ? '|' : ',';
  return text
    .split(sep)
    .map((a) => a.trim())
    .filter(Boolean);
}

function toPayload(q) {
  const base = {
    type: q.type,
    prompt: q.prompt.trim(),
    points: Number(q.points) || 0,
    explanation: q.explanation.trim() || null,
    aiGenerated: q.aiGenerated,
  };
  if (q.id) base.id = q.id;
  if (q.type === 'MULTIPLE') {
    return { ...base, options: q.options.map((o) => o.trim()), correctOption: q.correctOption, answers: [] };
  }
  return { ...base, options: [], correctOption: null, answers: parseAnswers(q.answersText) };
}

function validateQuestions(list) {
  for (const [i, q] of list.entries()) {
    const n = i + 1;
    if (q.prompt.trim().length < 3) return `Pregunta ${n}: escribe el enunciado`;
    if (q.type === 'MULTIPLE') {
      if (q.options.length < 2) return `Pregunta ${n}: necesita al menos 2 opciones`;
      if (q.options.some((o) => !o.trim())) return `Pregunta ${n}: hay opciones vacías`;
      if (q.correctOption === null || q.correctOption >= q.options.length) return `Pregunta ${n}: marca la opción correcta`;
    } else if (!parseAnswers(q.answersText).length) {
      return `Pregunta ${n}: indica al menos una respuesta aceptada`;
    }
  }
  return null;
}

function configFromEvaluation(ev) {
  return {
    title: ev.title,
    description: ev.description || '',
    type: ev.type,
    weight: ev.weight ?? 0,
    timeLimitMin: ev.timeLimitMin ?? '',
    maxAttempts: ev.maxAttempts ?? 1,
    opensAt: toLocalInput(ev.opensAt),
    closesAt: toLocalInput(ev.closesAt),
    audience: ev.audience,
    showResults: ev.showResults,
    shuffle: ev.shuffle,
    assigneeIds: ev.assigneeIds || [],
  };
}

export default function EvaluationEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useLoad(() => api.get(`/evaluations/${id}`), [id]);
  const [tab, setTab] = useState('preguntas');

  if (loading && !data) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;

  const { evaluation, publicUrl } = data;
  const status = EVAL_STATUS[evaluation.status];

  const changeStatus = async (next) => {
    const msg = {
      PUBLICADA: '¿Publicar la evaluación? Los estudiantes podrán presentarla.',
      CERRADA: '¿Cerrar la evaluación? Los intentos abiertos se entregarán automáticamente.',
      BORRADOR: '¿Volver a borrador? Los estudiantes dejarán de verla.',
    }[next];
    if (!window.confirm(msg)) return;
    try {
      await api.post(`/evaluations/${id}/status`, { status: next });
      reload();
    } catch (err) {
      window.alert(err.message);
    }
  };

  const duplicate = async () => {
    if (!window.confirm('¿Crear una copia de esta evaluación con sus preguntas?')) return;
    try {
      const res = await api.post(`/evaluations/${id}/duplicate`);
      navigate(`/app/evaluaciones/${res.evaluation.id}/editar`);
    } catch (err) {
      window.alert(err.message);
    }
  };

  const remove = async () => {
    if (!window.confirm('¿Eliminar la evaluación? Se borrarán también todos los intentos y notas. Esta acción no se puede deshacer.')) return;
    try {
      await api.del(`/evaluations/${id}`);
      navigate(`/app/cursos/${evaluation.courseId}`);
    } catch (err) {
      window.alert(err.message);
    }
  };

  return (
    <div>
      <PageHeader
        back={{ to: `/app/cursos/${evaluation.courseId}`, label: evaluation.course?.name || 'Volver al curso' }}
        title={evaluation.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            <span>{evaluation.type === 'EXAMEN' ? 'Examen' : 'Ejercicio'}</span>
            <span>· {evaluation.questions.length} preguntas</span>
            <span>· Peso {evaluation.weight}%</span>
          </span>
        }
        actions={
          <>
            {evaluation.status !== 'PUBLICADA' && (
              <Button onClick={() => changeStatus('PUBLICADA')}>{evaluation.status === 'CERRADA' ? 'Reabrir' : 'Publicar'}</Button>
            )}
            {evaluation.status === 'PUBLICADA' && (
              <Button variant="secondary" onClick={() => changeStatus('CERRADA')}>
                Cerrar
              </Button>
            )}
            {evaluation.status !== 'BORRADOR' && (
              <Button variant="ghost" onClick={() => changeStatus('BORRADOR')}>
                Volver a borrador
              </Button>
            )}
            <Button variant="soft" icon={BarChart3} to={`/app/evaluaciones/${id}/resultados`}>
              Ver resultados
            </Button>
          </>
        }
      />

      {evaluation.audience === 'PUBLICA' && publicUrl && <PublicLink url={publicUrl} />}

      <Tabs
        tabs={[
          { id: 'preguntas', label: 'Preguntas', icon: ListChecks },
          { id: 'config', label: 'Configuración', icon: Settings },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'preguntas' ? (
        <QuestionsEditor evaluation={evaluation} onReload={reload} />
      ) : (
        <ConfigForm evaluation={evaluation} onSaved={reload} />
      )}

      <div className="mt-10 flex flex-wrap gap-2 border-t border-slate-200 pt-6">
        <Button variant="secondary" icon={CopyPlus} onClick={duplicate}>
          Duplicar evaluación
        </Button>
        <Button variant="danger" icon={Trash2} onClick={remove}>
          Eliminar evaluación
        </Button>
      </div>
    </div>
  );
}

function PublicLink({ url }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copia el enlace:', url);
    }
  };
  return (
    <Card className="mb-5 flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-700">Enlace público (visitantes sin cuenta)</p>
        <p className="truncate font-mono text-sm text-brand-700">{url}</p>
      </div>
      <Button variant="secondary" size="sm" icon={Copy} onClick={copy}>
        {copied ? 'Copiado' : 'Copiar enlace'}
      </Button>
    </Card>
  );
}

// ----------------------------- Configuración ---------------------------------

function ConfigForm({ evaluation, onSaved }) {
  const [form, setForm] = useState(() => configFromEvaluation(evaluation));
  const [students, setStudents] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    setForm(configFromEvaluation(evaluation));
  }, [evaluation]);

  useEffect(() => {
    if (form.audience !== 'ESPECIFICOS' || students) return;
    api
      .get(`/courses/${evaluation.courseId}/students`)
      .then((r) => setStudents(r.students))
      .catch((err) => setMsg({ tone: 'error', text: err.message }));
  }, [form.audience, students, evaluation.courseId]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const toggleStudent = (userId) =>
    setForm((f) => ({
      ...f,
      assigneeIds: f.assigneeIds.includes(userId) ? f.assigneeIds.filter((x) => x !== userId) : [...f.assigneeIds, userId],
    }));

  const save = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (form.audience === 'ESPECIFICOS' && !form.assigneeIds.length) {
      setMsg({ tone: 'error', text: 'Selecciona al menos un estudiante' });
      return;
    }
    setSaving(true);
    try {
      await api.put(`/evaluations/${evaluation.id}`, {
        title: form.title,
        description: form.description || null,
        type: form.type,
        weight: Number(form.weight) || 0,
        timeLimitMin: form.timeLimitMin === '' ? null : Number(form.timeLimitMin),
        maxAttempts: Number(form.maxAttempts) || 1,
        opensAt: fromLocalInput(form.opensAt),
        closesAt: fromLocalInput(form.closesAt),
        audience: form.audience,
        showResults: form.showResults,
        shuffle: form.shuffle,
        ...(form.audience === 'ESPECIFICOS' ? { assigneeIds: form.assigneeIds } : {}),
      });
      setMsg({ tone: 'success', text: 'Configuración guardada' });
      onSaved();
    } catch (err) {
      setMsg({ tone: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save}>
      {msg && (
        <Alert tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}
      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Título" className="sm:col-span-2">
          <Input value={form.title} onChange={set('title')} required minLength={3} maxLength={200} />
        </Field>
        <Field label="Descripción / instrucciones" className="sm:col-span-2">
          <Textarea value={form.description} onChange={set('description')} maxLength={3000} />
        </Field>
        <Field label="Tipo">
          <Select value={form.type} onChange={set('type')}>
            <option value="EXAMEN">Examen</option>
            <option value="EJERCICIO">Ejercicio</option>
          </Select>
        </Field>
        <Field label="Peso en la nota del curso (%)" hint="Suma de pesos del curso idealmente 100%">
          <Input type="number" min={0} max={100} step="0.1" value={form.weight} onChange={set('weight')} />
        </Field>
        <Field label="Límite de tiempo (minutos)" hint="Vacío = sin límite">
          <Input type="number" min={1} max={600} value={form.timeLimitMin} onChange={set('timeLimitMin')} placeholder="Sin límite" />
        </Field>
        <Field label="Intentos permitidos">
          <Input type="number" min={1} max={20} value={form.maxAttempts} onChange={set('maxAttempts')} />
        </Field>
        <Field label="Abre" hint="Vacío = disponible al publicar">
          <Input type="datetime-local" value={form.opensAt} onChange={set('opensAt')} />
        </Field>
        <Field label="Cierra" hint="Vacío = sin fecha de cierre">
          <Input type="datetime-local" value={form.closesAt} onChange={set('closesAt')} />
        </Field>
        <Field label="Dirigida a" className="sm:col-span-2">
          <Select value={form.audience} onChange={set('audience')}>
            {Object.entries(AUDIENCE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>

        {form.audience === 'ESPECIFICOS' && (
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium text-slate-700">
              Estudiantes asignados ({form.assigneeIds.length})
            </p>
            {!students ? (
              <Spinner label="Cargando estudiantes…" />
            ) : students.length === 0 ? (
              <p className="text-sm text-slate-500">El curso aún no tiene estudiantes inscritos.</p>
            ) : (
              <div className="grid max-h-64 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
                {students.map((s) => (
                  <Checkbox
                    key={s.id}
                    checked={form.assigneeIds.includes(s.id)}
                    onChange={() => toggleStudent(s.id)}
                    label={
                      <span>
                        {s.name} <span className="text-xs text-slate-400">{s.email}</span>
                      </span>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {form.audience === 'PUBLICA' && (
          <p className="text-sm text-slate-500 sm:col-span-2">
            Cualquier persona con el enlace podrá presentarla, incluso sin cuenta. El enlace aparece al guardar.
          </p>
        )}

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Checkbox checked={form.showResults} onChange={set('showResults')} label="Mostrar respuestas correctas al entregar" />
          <Checkbox checked={form.shuffle} onChange={set('shuffle')} label="Mezclar el orden de las preguntas" />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" icon={Save} loading={saving}>
            Guardar configuración
          </Button>
        </div>
      </Card>
    </form>
  );
}

// ----------------------------- Preguntas -------------------------------------

function QuestionsEditor({ evaluation, onReload }) {
  const [questions, setQuestions] = useState(() => evaluation.questions.map(toLocalQuestion));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    setQuestions(evaluation.questions.map(toLocalQuestion));
    setDirty(false);
  }, [evaluation]);

  const totalPoints = useMemo(() => questions.reduce((s, q) => s + (Number(q.points) || 0), 0), [questions]);

  const update = (key, patch) => {
    setQuestions((list) => list.map((q) => (q.key === key ? { ...q, ...patch } : q)));
    setDirty(true);
  };

  const add = (type) => {
    setQuestions((list) => [
      ...list,
      { key: newKey(), type, prompt: '', options: type === 'MULTIPLE' ? ['', ''] : [], correctOption: type === 'MULTIPLE' ? 0 : null, answersText: '', points: 1, explanation: '', aiGenerated: false },
    ]);
    setDirty(true);
  };

  const move = (index, delta) => {
    setQuestions((list) => {
      const next = [...list];
      const target = index + delta;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setDirty(true);
  };

  const remove = (key) => {
    if (!window.confirm('¿Eliminar esta pregunta?')) return;
    setQuestions((list) => list.filter((q) => q.key !== key));
    setDirty(true);
  };

  const appendGenerated = (items) => {
    setQuestions((list) => [
      ...list,
      ...items.map((q) => ({ ...toLocalQuestion({ ...q, points: 1, aiGenerated: true }), id: undefined })),
    ]);
    setDirty(true);
    setMsg({ tone: 'info', text: `Se agregaron ${items.length} preguntas generadas con IA. Revísalas y presiona "Guardar preguntas".` });
  };

  const save = async () => {
    setMsg(null);
    const problem = validateQuestions(questions);
    if (problem) {
      setMsg({ tone: 'error', text: problem });
      return;
    }
    if (evaluation.submissionCount > 0 && !window.confirm('Esta evaluación ya tiene intentos. Al guardar se recalcularán sus notas automáticamente. ¿Continuar?')) {
      return;
    }
    setSaving(true);
    try {
      const res = await api.put(`/evaluations/${evaluation.id}/questions`, { questions: questions.map(toPayload) });
      setMsg({
        tone: 'success',
        text: res.regraded > 0 ? `Preguntas guardadas. Se recalcularon ${res.regraded} intentos entregados.` : 'Preguntas guardadas.',
      });
      setDirty(false);
      onReload();
    } catch (err) {
      setMsg({ tone: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = () =>
    api.download('/evaluations/questions-template.xlsx', 'plantilla_preguntas.xlsx').catch((err) => setMsg({ tone: 'error', text: err.message }));

  const importFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (dirty && !window.confirm('Tienes cambios sin guardar que se perderán al importar. ¿Continuar?')) return;
    setImporting(true);
    setMsg(null);
    try {
      const res = await api.upload(`/evaluations/${evaluation.id}/questions/import`, file);
      setMsg({
        tone: res.errors.length ? 'warning' : 'success',
        text: (
          <>
            Se importaron {res.imported} preguntas.
            {res.errors.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {res.errors.map((er) => (
                  <li key={er}>{er}</li>
                ))}
              </ul>
            )}
          </>
        ),
      });
      onReload();
    } catch (err) {
      setMsg({ tone: 'error', text: err.message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      {msg && (
        <Alert tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}
      {evaluation.submissionCount > 0 && (
        <Alert tone="warning">
          Esta evaluación ya tiene {evaluation.submissionCount} intentos. Si cambias las respuestas correctas o los puntos, las notas se recalculan al guardar.
        </Alert>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="soft" icon={Sparkles} onClick={() => setAiOpen(true)}>
          Generar con IA
        </Button>
        <Button variant="secondary" icon={Download} onClick={downloadTemplate}>
          Plantilla Excel
        </Button>
        <Button variant="secondary" icon={Upload} loading={importing} onClick={() => fileRef.current?.click()}>
          Importar desde Excel
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={importFile} />
      </div>

      {questions.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          <FileSpreadsheet className="mx-auto mb-2 size-10 text-slate-300" />
          Aún no hay preguntas. Agrégalas manualmente, genéralas con IA o impórtalas desde Excel.
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map((q, i) => (
            <QuestionCard
              key={q.key}
              q={q}
              index={i}
              total={questions.length}
              onChange={(patch) => update(q.key, patch)}
              onMove={(d) => move(i, d)}
              onRemove={() => remove(q.key)}
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" icon={Plus} onClick={() => add('MULTIPLE')}>
          Selección múltiple
        </Button>
        <Button variant="secondary" icon={Plus} onClick={() => add('COMPLETAR')}>
          Completar espacio
        </Button>
      </div>

      <div className="sticky bottom-20 z-20 mt-6 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:bottom-4">
        <p className="text-sm text-slate-600">
          {questions.length} preguntas · <b>{totalPoints}</b> puntos en total
          {dirty && <span className="ml-2 text-amber-700">· Cambios sin guardar</span>}
        </p>
        <Button icon={Save} loading={saving} onClick={save} disabled={!dirty && !saving}>
          Guardar preguntas
        </Button>
      </div>

      <AiGenerateModal open={aiOpen} onClose={() => setAiOpen(false)} onAdd={appendGenerated} />
    </div>
  );
}

function QuestionCard({ q, index, total, onChange, onMove, onRemove }) {
  const setOption = (i, value) => onChange({ options: q.options.map((o, j) => (j === i ? value : o)) });
  const addOption = () => onChange({ options: [...q.options, ''] });
  const removeOption = (i) => {
    const options = q.options.filter((_, j) => j !== i);
    let correctOption = q.correctOption;
    if (correctOption === i) correctOption = 0;
    else if (correctOption > i) correctOption -= 1;
    onChange({ options, correctOption });
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-800">{index + 1}</span>
        <Badge tone={q.type === 'MULTIPLE' ? 'blue' : 'violet'}>{q.type === 'MULTIPLE' ? 'Selección múltiple' : 'Completar'}</Badge>
        {q.aiGenerated && (
          <Badge tone="amber">
            <Sparkles className="mr-1 size-3" /> IA
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Subir">
            <ArrowUp className="size-4" />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Bajar">
            <ArrowDown className="size-4" />
          </button>
          <button type="button" onClick={onRemove} className="rounded p-1.5 text-red-600 hover:bg-red-50" aria-label="Eliminar">
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <Field label="Enunciado" hint={q.type === 'COMPLETAR' ? 'Marca el espacio en blanco con ___ (tres guiones bajos)' : undefined}>
        <Textarea value={q.prompt} onChange={(e) => onChange({ prompt: e.target.value })} rows={2} />
      </Field>

      {q.type === 'MULTIPLE' ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm font-medium text-slate-700">Opciones (marca la correcta)</p>
          {q.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name={`correct-${q.key}`}
                checked={q.correctOption === i}
                onChange={() => onChange({ correctOption: i })}
                className="size-4 shrink-0 accent-brand-700"
                aria-label={`Opción ${i + 1} correcta`}
              />
              <span className="w-5 text-sm font-medium text-slate-500">{String.fromCharCode(65 + i)}</span>
              <Input value={opt} onChange={(e) => setOption(i, e.target.value)} placeholder={`Opción ${String.fromCharCode(65 + i)}`} />
              <button
                type="button"
                onClick={() => removeOption(i)}
                disabled={q.options.length <= 2}
                className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-30"
                aria-label="Quitar opción"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {q.options.length < 8 && (
            <Button type="button" variant="ghost" size="sm" icon={Plus} onClick={addOption}>
              Agregar opción
            </Button>
          )}
        </div>
      ) : (
        <Field label="Respuestas aceptadas" hint="Separa variantes con | (o con comas). No distingue mayúsculas ni tildes." className="mt-3">
          <Input value={q.answersText} onChange={(e) => onChange({ answersText: e.target.value })} placeholder="CSS | hojas de estilo en cascada" />
        </Field>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-[8rem_1fr]">
        <Field label="Puntos">
          <Input type="number" min={0} max={1000} step="0.5" value={q.points} onChange={(e) => onChange({ points: e.target.value })} />
        </Field>
        <Field label="Explicación (opcional)">
          <Input value={q.explanation} onChange={(e) => onChange({ explanation: e.target.value })} placeholder="Se muestra al estudiante si las respuestas son visibles" />
        </Field>
      </div>
    </Card>
  );
}

// ----------------------------- Generar con IA --------------------------------

function AiGenerateModal({ open, onClose, onAdd }) {
  const [providers, setProviders] = useState(null);
  const [form, setForm] = useState({ provider: '', topic: '', level: 'Intermedio', count: 5, questionType: 'MIXTO', instructions: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (!open || providers) return;
    api
      .get('/ai/providers')
      .then((r) => {
        setProviders(r.providers);
        const first = r.providers.find((p) => p.enabled);
        if (first) setForm((f) => ({ ...f, provider: first.id }));
      })
      .catch((err) => setError(err.message));
  }, [open, providers]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const enabled = providers?.filter((p) => p.enabled) || [];

  const generate = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await api.post('/ai/generate', {
        provider: form.provider,
        topic: form.topic,
        level: form.level,
        count: Number(form.count),
        questionType: form.questionType,
        instructions: form.instructions || undefined,
      });
      setResult(res);
      setSelected(res.questions.map((_, i) => i));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addSelected = () => {
    onAdd(result.questions.filter((_, i) => selected.includes(i)));
    setResult(null);
    onClose();
  };

  const toggle = (i) => setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generar preguntas con IA"
      wide
      footer={
        result ? (
          <>
            <Button variant="secondary" onClick={() => setResult(null)}>
              Generar otras
            </Button>
            <Button icon={Plus} onClick={addSelected} disabled={!selected.length}>
              Agregar seleccionadas ({selected.length})
            </Button>
          </>
        ) : null
      }
    >
      {error && <Alert>{error}</Alert>}
      {!providers ? (
        !error && <Spinner />
      ) : result ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Generadas con {providers.find((p) => p.id === result.provider)?.label} ({result.model}). Revisa y elige cuáles agregar.
          </p>
          {result.questions.map((q, i) => (
            <label key={i} className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
              <input type="checkbox" className="mt-1 size-4 accent-brand-700" checked={selected.includes(i)} onChange={() => toggle(i)} />
              <div className="min-w-0 text-sm">
                <Badge tone={q.type === 'MULTIPLE' ? 'blue' : 'violet'} className="mb-1">
                  {q.type === 'MULTIPLE' ? 'Selección múltiple' : 'Completar'}
                </Badge>
                <p className="font-medium text-slate-800">{q.prompt}</p>
                {q.type === 'MULTIPLE' ? (
                  <ul className="mt-1 space-y-0.5">
                    {q.options.map((o, j) => (
                      <li key={j} className={j === q.correctOption ? 'font-semibold text-emerald-700' : 'text-slate-600'}>
                        {String.fromCharCode(65 + j)}. {o} {j === q.correctOption && '✓'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-emerald-700">Respuestas: {q.answers.join(' | ')}</p>
                )}
                {q.explanation && <p className="mt-1 text-xs text-slate-500">{q.explanation}</p>}
              </div>
            </label>
          ))}
        </div>
      ) : (
        <form onSubmit={generate} className="grid gap-4 sm:grid-cols-2">
          {enabled.length === 0 && (
            <div className="sm:col-span-2">
              <Alert tone="info">
                No hay proveedores de IA configurados. El administrador debe definir al menos una clave (ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY u
                OPENAI_COMPAT_BASE_URL) en las variables de entorno del servidor.
              </Alert>
            </div>
          )}
          <Field label="Motor de IA" className="sm:col-span-2">
            <Select value={form.provider} onChange={set('provider')} required>
              {providers.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.enabled}>
                  {p.label}
                  {p.model ? ` — ${p.model}` : ''}
                  {!p.enabled ? ' (no configurado)' : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tema" className="sm:col-span-2" hint="Puedes pegar un fragmento de tus apuntes para que las preguntas se basen en él">
            <Textarea value={form.topic} onChange={set('topic')} required minLength={3} maxLength={2000} placeholder="Ej: Modelo de caja en CSS: margin, padding y border" />
          </Field>
          <Field label="Nivel">
            <Select value={form.level} onChange={set('level')}>
              <option>Básico</option>
              <option>Intermedio</option>
              <option>Avanzado</option>
            </Select>
          </Field>
          <Field label="Cantidad de preguntas">
            <Input type="number" min={1} max={20} value={form.count} onChange={set('count')} />
          </Field>
          <Field label="Tipo de pregunta" className="sm:col-span-2">
            <Select value={form.questionType} onChange={set('questionType')}>
              <option value="MIXTO">Mixto (selección múltiple y completar)</option>
              <option value="MULTIPLE">Solo selección múltiple</option>
              <option value="COMPLETAR">Solo completar el espacio</option>
            </Select>
          </Field>
          <Field label="Indicaciones adicionales (opcional)" className="sm:col-span-2">
            <Textarea value={form.instructions} onChange={set('instructions')} maxLength={2000} placeholder="Ej: enfocadas en ejemplos prácticos, evitar preguntas de memoria" />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" icon={Sparkles} loading={loading} disabled={!enabled.length}>
              {loading ? 'Generando…' : 'Generar'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
