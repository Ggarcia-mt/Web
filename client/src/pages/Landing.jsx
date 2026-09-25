import { Link, Navigate } from 'react-router-dom';
import { FileSpreadsheet, QrCode, ShieldCheck, Smartphone, Sparkles, SlidersHorizontal } from 'lucide-react';
import { Logo } from '../components/Layout.jsx';
import { Button } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';

const FEATURES = [
  { icon: Sparkles, title: 'Evaluaciones con IA', text: 'Genera preguntas de selección múltiple y de completar con Claude, ChatGPT, Gemini u otro modelo, y edítalas antes de publicar.' },
  { icon: SlidersHorizontal, title: 'Calificación flexible', text: 'Calificación automática, puntaje por pregunta, ponderación por evaluación, ajustes manuales y puntos adicionales.' },
  { icon: QrCode, title: 'Asistencia dual', text: 'Código QR dinámico que cambia cada pocos segundos o ventana de horario para marcar desde la app.' },
  { icon: FileSpreadsheet, title: 'Excel de ida y vuelta', text: 'Importa listas de estudiantes y preguntas; exporta notas, asistencia y resultados a .xlsx.' },
  { icon: Smartphone, title: 'Pensada para el celular', text: 'Funciona en el navegador de cualquier dispositivo, sin instalar nada.' },
  { icon: ShieldCheck, title: 'Acceso por roles', text: 'Administrador, profesor, estudiante de curso, estudiante independiente y visitante anónimo.' },
];

export default function Landing() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/app" replace />;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-brand-50 to-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo className="text-lg" />
        <div className="flex gap-2">
          <Button variant="ghost" to="/login">
            Iniciar sesión
          </Button>
          <Button to="/registro" className="hidden sm:inline-flex">
            Crear cuenta
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-10 pb-16 text-center sm:px-6 sm:pt-16">
        <p className="mb-4 inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">
          Politécnico Colombiano Jaime Isaza Cadavid
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Evaluaciones con IA y asistencia en segundos
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          CampusPoli ayuda a los docentes a crear exámenes y ejercicios, calificar automáticamente y tomar asistencia con QR, y a los estudiantes a seguir sus notas en tiempo real.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" to="/registro">
            Empezar gratis
          </Button>
          <Button size="lg" variant="secondary" to="/login">
            Ya tengo cuenta
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <f.icon className="mb-3 size-8 text-brand-700" />
            <h3 className="font-semibold text-slate-900">{f.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{f.text}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        CampusPoli © {new Date().getFullYear()} · Proyecto Pedagógico Integrador · <Link to="/login" className="underline">Acceso</Link>
      </footer>
    </div>
  );
}
