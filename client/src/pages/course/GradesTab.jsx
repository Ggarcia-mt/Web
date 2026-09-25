import { BarChart3, Download } from 'lucide-react';
import { Alert, Badge, Button, Card, EmptyState, Spinner, useLoad } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { formatGrade, gradeTone } from '../../lib/format.js';

function GradeCell({ value, passing }) {
  if (value === null || value === undefined) return <span className="text-slate-300">—</span>;
  return <span className={value >= passing ? 'text-slate-800' : 'font-semibold text-red-600'}>{formatGrade(value)}</span>;
}

function StudentSummary({ gb }) {
  const row = gb.rows[0];
  if (!row) return <EmptyState icon={BarChart3} title="Sin información de notas" />;
  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Nota acumulada</p>
          <p className="text-3xl font-bold">{formatGrade(row.accumulated)}</p>
          <p className="text-xs text-slate-500">sobre el {row.evaluatedWeight}% evaluado</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Promedio proyectado</p>
          <p className={`text-3xl font-bold ${row.projected !== null && row.projected < gb.passingGrade ? 'text-red-600' : 'text-emerald-700'}`}>
            {formatGrade(row.projected)}
          </p>
          <p className="text-xs text-slate-500">si mantienes el ritmo · aprueba con {gb.passingGrade}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Asistencia</p>
          <p className="text-3xl font-bold">{row.attendance.percent === null ? '—' : `${row.attendance.percent}%`}</p>
          <p className="text-xs text-slate-500">
            {row.attendance.PRESENTE} presente · {row.attendance.TARDE} tarde · {row.attendance.JUSTIFICADO} justif. · {row.attendance.AUSENTE} ausente
          </p>
        </Card>
      </div>
      <Card className="divide-y divide-slate-100">
        {gb.evaluations.map((e) => (
          <div key={e.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{e.title}</p>
              <p className="text-xs text-slate-500">{e.weight}% de la nota</p>
            </div>
            {row.grades[e.id] === null || row.grades[e.id] === undefined ? (
              <Badge>Pendiente</Badge>
            ) : (
              <Badge tone={gradeTone(row.grades[e.id], gb.passingGrade)}>{formatGrade(row.grades[e.id])}</Badge>
            )}
          </div>
        ))}
      </Card>
    </>
  );
}

export default function GradesTab({ course, manager }) {
  const { data: gb, loading, error } = useLoad(() => api.get(`/courses/${course.id}/gradebook`), [course.id]);
  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (!manager) return <StudentSummary gb={gb} />;

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Escala 0 - {gb.scale} · aprueba con {gb.passingGrade}. Las evaluaciones cerradas sin presentar cuentan 0. Para ajustar una nota, abre los resultados de la evaluación.
        </p>
        <Button icon={Download} onClick={() => api.download(`/courses/${course.id}/export/grades.xlsx`, 'notas.xlsx')}>
          Exportar a Excel
        </Button>
      </div>
      {gb.rows.length === 0 ? (
        <EmptyState icon={BarChart3} title="No hay estudiantes inscritos" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="sticky left-0 bg-slate-50 px-4 py-3 font-medium">Estudiante</th>
                {gb.evaluations.map((e) => (
                  <th key={e.id} className="px-3 py-3 text-center font-medium">
                    <span className="line-clamp-2 max-w-28">{e.title}</span>
                    <span className="block font-normal">{e.weight}%</span>
                  </th>
                ))}
                <th className="px-3 py-3 text-center font-medium">Acumulada</th>
                <th className="px-3 py-3 text-center font-medium">Proyectada</th>
                <th className="px-3 py-3 text-center font-medium">Asistencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {gb.rows.map((r) => (
                <tr key={r.student.id} className="hover:bg-slate-50">
                  <td className="sticky left-0 bg-white px-4 py-2">
                    <p className="font-medium">{r.student.name}</p>
                    <p className="text-xs text-slate-500">{r.student.email}</p>
                  </td>
                  {gb.evaluations.map((e) => (
                    <td key={e.id} className="px-3 py-2 text-center">
                      <GradeCell value={r.grades[e.id]} passing={gb.passingGrade} />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-semibold">{formatGrade(r.accumulated)}</td>
                  <td className="px-3 py-2 text-center">
                    <GradeCell value={r.projected} passing={gb.passingGrade} />
                  </td>
                  <td className="px-3 py-2 text-center">{r.attendance.percent === null ? '—' : `${r.attendance.percent}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
