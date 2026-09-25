import { useParams, useSearchParams } from 'react-router-dom';
import { BarChart3, CalendarClock, ClipboardList, Settings, Users } from 'lucide-react';
import { Alert, Badge, PageHeader, Spinner, Tabs, useLoad } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import EvaluationsTab from './EvaluationsTab.jsx';
import StudentsTab from './StudentsTab.jsx';
import AttendanceTab from './AttendanceTab.jsx';
import GradesTab from './GradesTab.jsx';
import SettingsTab from './SettingsTab.jsx';

export default function CourseDetail() {
  const { courseId } = useParams();
  const [params, setParams] = useSearchParams();
  const { data, loading, error, reload } = useLoad(() => api.get(`/courses/${courseId}`), [courseId]);

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  const { course, manager } = data;

  const tabs = [
    { id: 'evaluaciones', label: 'Evaluaciones', icon: ClipboardList },
    ...(manager ? [{ id: 'estudiantes', label: `Estudiantes (${course._count.enrollments})`, icon: Users }] : []),
    { id: 'asistencia', label: 'Asistencia', icon: CalendarClock },
    { id: 'notas', label: 'Notas', icon: BarChart3 },
    ...(manager ? [{ id: 'ajustes', label: 'Ajustes', icon: Settings }] : []),
  ];
  const active = tabs.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'evaluaciones';

  return (
    <>
      <PageHeader
        back={{ to: '/app/cursos', label: 'Cursos' }}
        title={course.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>Prof. {course.teacher.name}</span>
            {course.period && <span>· {course.period}</span>}
            {manager && (
              <Badge tone="green" className="font-mono">
                Código {course.joinCode}
              </Badge>
            )}
          </span>
        }
      />
      <Tabs tabs={tabs} active={active} onChange={(id) => setParams({ tab: id }, { replace: true })} />
      {active === 'evaluaciones' && <EvaluationsTab course={course} manager={manager} />}
      {active === 'estudiantes' && <StudentsTab course={course} onChange={reload} />}
      {active === 'asistencia' && <AttendanceTab course={course} manager={manager} />}
      {active === 'notas' && <GradesTab course={course} manager={manager} />}
      {active === 'ajustes' && <SettingsTab course={course} onSaved={reload} />}
    </>
  );
}
