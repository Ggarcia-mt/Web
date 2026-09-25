// Historial de intentos del estudiante.
import { ClipboardList, Eye, Play } from 'lucide-react';
import { api } from '../lib/api.js';
import { formatDate, formatGrade, gradeTone } from '../lib/format.js';
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner, useLoad } from '../components/ui.jsx';

export default function MyResults() {
  const { data, loading, error } = useLoad(() => api.get('/take/mine'), []);

  return (
    <div>
      <PageHeader title="Mis resultados" subtitle="Tus evaluaciones y ejercicios presentados" />
      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <Alert>{error}</Alert>
      ) : data.submissions.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Aún no has presentado evaluaciones">
          Cuando respondas un examen o ejercicio, tu nota aparecerá aquí.
        </EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.submissions.map((s) => {
            const done = Boolean(s.submittedAt);
            return (
              <Card key={s.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-brand-700">{s.evaluation.course?.name}</p>
                    <p className="truncate font-semibold text-slate-900">{s.evaluation.title}</p>
                    <p className="text-xs text-slate-500">
                      {s.evaluation.type === 'EXAMEN' ? 'Examen' : 'Ejercicio'} · Intento {s.attempt} ·{' '}
                      {done ? `Entregado ${formatDate(s.submittedAt)}` : `Iniciado ${formatDate(s.startedAt)}`}
                    </p>
                  </div>
                  {done ? (
                    <Badge tone={gradeTone(s.grade)} className="shrink-0 text-sm">
                      {formatGrade(s.grade)}
                    </Badge>
                  ) : (
                    <Badge tone="amber" className="shrink-0">
                      En curso
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{done ? `${s.score} / ${s.maxScore} puntos` : ''}</span>
                  {done ? (
                    <Button size="sm" variant="soft" icon={Eye} to={`/presentar/${s.id}`}>
                      Ver detalle
                    </Button>
                  ) : (
                    <Button size="sm" icon={Play} to={`/presentar/${s.id}`}>
                      Continuar
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
