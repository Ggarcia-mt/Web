import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import { Spinner } from './components/ui.jsx';
import Layout from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import NotFound from './pages/NotFound.jsx';

// Carga diferida por pantalla: el celular solo descarga lo que usa.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Users = lazy(() => import('./pages/admin/Users.jsx'));
const Courses = lazy(() => import('./pages/Courses.jsx'));
const CourseDetail = lazy(() => import('./pages/course/CourseDetail.jsx'));
const EvaluationEditor = lazy(() => import('./pages/EvaluationEditor.jsx'));
const EvaluationResults = lazy(() => import('./pages/EvaluationResults.jsx'));
const SubmissionReview = lazy(() => import('./pages/SubmissionReview.jsx'));
const TakeEvaluation = lazy(() => import('./pages/TakeEvaluation.jsx'));
const PublicEvaluation = lazy(() => import('./pages/PublicEvaluation.jsx'));
const AttendanceLive = lazy(() => import('./pages/AttendanceLive.jsx'));
const ScanAttendance = lazy(() => import('./pages/ScanAttendance.jsx'));
const MarkAttendance = lazy(() => import('./pages/MarkAttendance.jsx'));
const MyResults = lazy(() => import('./pages/MyResults.jsx'));

/** Protege rutas por sesión y rol (RF-01). */
function RequireAuth({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (user.mustChangePassword && location.pathname !== '/app/perfil') return <Navigate to="/app/perfil?cambiar=1" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/app" replace />;
  return children;
}

const MANAGERS = ['PROFESOR', 'ADMIN'];
const STUDENTS = ['ESTUDIANTE', 'INDEPENDIENTE'];

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Register />} />
      {/* Evaluaciones públicas: accesibles sin cuenta (usuario anónimo) */}
      <Route path="/e/:code" element={<PublicEvaluation />} />
      <Route path="/presentar/:submissionId" element={<TakeEvaluation />} />
      {/* Enlace del QR: pide sesión y marca la asistencia */}
      <Route
        path="/asistencia/marcar"
        element={
          <RequireAuth roles={STUDENTS}>
            <MarkAttendance />
          </RequireAuth>
        }
      />
      <Route
        path="/asistencia/sesion/:id"
        element={
          <RequireAuth roles={MANAGERS}>
            <AttendanceLive />
          </RequireAuth>
        }
      />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="perfil" element={<Profile />} />
        <Route path="usuarios" element={<RequireAuth roles={['ADMIN']}><Users /></RequireAuth>} />
        <Route path="cursos" element={<Courses />} />
        <Route path="cursos/:courseId" element={<CourseDetail />} />
        <Route path="evaluaciones/:id/editar" element={<RequireAuth roles={MANAGERS}><EvaluationEditor /></RequireAuth>} />
        <Route path="evaluaciones/:id/resultados" element={<RequireAuth roles={MANAGERS}><EvaluationResults /></RequireAuth>} />
        <Route path="intentos/:id/revisar" element={<RequireAuth roles={MANAGERS}><SubmissionReview /></RequireAuth>} />
        <Route path="escanear" element={<RequireAuth roles={STUDENTS}><ScanAttendance /></RequireAuth>} />
        <Route path="resultados" element={<RequireAuth roles={STUDENTS}><MyResults /></RequireAuth>} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
}
