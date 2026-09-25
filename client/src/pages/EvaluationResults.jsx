// Resultados de una evaluación: estadísticas, intentos y exportación a Excel.
import { useParams } from 'react-router-dom';
import { Award, ClipboardList, Download, Eye, Pencil, TrendingUp, Trash2, Users } from 'lucide-react';
import { api } from '../lib/api.js';
import { formatDate, formatGrade, gradeTone } from '../lib/format.js';
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner, Stat, useLoad } from '../components/ui.jsx';

export default function EvaluationResults() {
  const { id } = useParams();
  const { data, loading, error, reload } = useLoad(
    () => Promise.all([api.get(`/evaluations/${id}`), api.get(`/evaluations/${id}/submissions`)]),
    [id],
  );

  if (loading && !data) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;

  const [{ evaluation }, { submissions, stats }] = data;

  const exportExcel = () => api.download(`/evaluations/${id}/export.xlsx`, 'resultados.xlsx').catch((err) => window.alert(err.message));

  const removeAttempt = async (s) => {
    const who = s.user?.name || s.guestName || 'este participante';
    if (!window.confirm(`¿Eliminar el intento ${s.attempt} de ${who}? Se borrarán sus respuestas y nota, y podrá presentar un nuevo intento.`)) return;
    try {
      await api.del(`/submissions/${s.id}`);
      reload();
    } catch (err) {
      window.alert(err.message);
    }
  };

  return (
    <div>
      <PageHeader
        back={{ to: `/app/cursos/${evaluation.courseId}`, label: evaluation.course?.name || 'Volver al curso' }}
        title={`Resultados: ${evaluation.title}`}
        subtitle={`${evaluation.questions.length} preguntas · Peso ${evaluation.weight}%`}
        actions={
          <>
            <Button variant="secondary" icon={Pencil} to={`/app/evaluaciones/${id}/editar`}>
              Editar
            </Button>
            <Button icon={Download} onClick={exportExcel}>
              Exportar a Excel
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Intentos" value={stats.total} icon={Users} />
        <Stat label="Entregados" value={stats.submitted} icon={ClipboardList} tone="blue" />
        <Stat label="Promedio" value={formatGrade(stats.average)} icon={TrendingUp} tone="violet" />
        <Stat label="Aprobados" value={stats.passed} icon={Award} tone="amber" />
      </div>

      {submissions.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Aún no hay intentos">
          Cuando los estudiantes presenten la evaluación, sus resultados aparecerán aquí.
        </EmptyState>
      ) : (
        <>
          {/* Tabla en escritorio */}
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Participante</th>
                  <th className="px-4 py-3">Intento</th>
                  <th className="px-4 py-3">Entregado</th>
                  <th className="px-4 py-3 text-right">Puntos</th>
                  <th className="px-4 py-3 text-right">Nota</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {submissions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Participant s={s} />
                    </td>
                    <td className="px-4 py-3">{s.attempt}</td>
                    <td className="px-4 py-3">{s.submittedAt ? formatDate(s.submittedAt) : <Badge tone="amber">En curso</Badge>}</td>
                    <td className="px-4 py-3 text-right">
                      {s.submittedAt ? `${s.score} / ${s.maxScore}` : '—'}
                      {s.bonus ? <span className="ml-1 text-xs text-brand-700">({s.bonus > 0 ? '+' : ''}{s.bonus})</span> : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge tone={gradeTone(s.grade)}>{formatGrade(s.grade)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Actions s={s} onRemove={() => removeAttempt(s)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Tarjetas en celular */}
          <div className="space-y-3 md:hidden">
            {submissions.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <Participant s={s} />
                  <Badge tone={gradeTone(s.grade)} className="text-sm">
                    {formatGrade(s.grade)}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Intento {s.attempt} · {s.submittedAt ? formatDate(s.submittedAt) : 'En curso'}
                  {s.submittedAt && ` · ${s.score} / ${s.maxScore} pts`}
                  {s.bonus ? ` · bonificación ${s.bonus > 0 ? '+' : ''}${s.bonus}` : ''}
                </p>
                <div className="mt-3">
                  <Actions s={s} onRemove={() => removeAttempt(s)} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Participant({ s }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-slate-800">
        {s.user?.name || s.guestName || 'Anónimo'}
        {!s.user && (
          <Badge tone="slate" className="ml-2">
            Visitante
          </Badge>
        )}
      </p>
      <p className="truncate text-xs text-slate-500">{s.user?.email || s.guestEmail || 'Sin correo'}</p>
    </div>
  );
}

function Actions({ s, onRemove }) {
  return (
    <div className="flex justify-end gap-2">
      {s.submittedAt && (
        <Button size="sm" variant="soft" icon={Eye} to={`/app/intentos/${s.id}/revisar`}>
          Revisar
        </Button>
      )}
      <Button size="sm" variant="ghost" icon={Trash2} onClick={onRemove} title="Eliminar intento (permite presentar de nuevo)">
        <span className="sr-only md:not-sr-only">Eliminar</span>
      </Button>
    </div>
  );
}
