// Estructura adaptativa (RNF-01): barra lateral en escritorio, barra inferior en celular.
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BookOpen, ClipboardList, GraduationCap, Home, LogOut, QrCode, User, Users } from 'lucide-react';
import { ROLE_LABELS, useAuth } from '../lib/auth.jsx';

const NAV = {
  ADMIN: [
    { to: '/app', label: 'Inicio', icon: Home, end: true },
    { to: '/app/usuarios', label: 'Usuarios', icon: Users },
    { to: '/app/cursos', label: 'Cursos', icon: BookOpen },
    { to: '/app/perfil', label: 'Perfil', icon: User },
  ],
  PROFESOR: [
    { to: '/app', label: 'Inicio', icon: Home, end: true },
    { to: '/app/cursos', label: 'Mis cursos', icon: BookOpen },
    { to: '/app/perfil', label: 'Perfil', icon: User },
  ],
  ESTUDIANTE: [
    { to: '/app', label: 'Inicio', icon: Home, end: true },
    { to: '/app/cursos', label: 'Cursos', icon: BookOpen },
    { to: '/app/escanear', label: 'Asistencia', icon: QrCode },
    { to: '/app/resultados', label: 'Resultados', icon: ClipboardList },
    { to: '/app/perfil', label: 'Perfil', icon: User },
  ],
  INDEPENDIENTE: [
    { to: '/app', label: 'Inicio', icon: Home, end: true },
    { to: '/app/cursos', label: 'Cursos', icon: BookOpen },
    { to: '/app/resultados', label: 'Resultados', icon: ClipboardList },
    { to: '/app/perfil', label: 'Perfil', icon: User },
  ],
};

export function Logo({ className = '' }) {
  return (
    <span className={`flex items-center gap-2 font-bold text-slate-900 ${className}`}>
      <span className="rounded-lg bg-brand-700 p-1.5 text-white">
        <GraduationCap className="size-5" />
      </span>
      CampusPoli
    </span>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = NAV[user.role] || [];

  const doLogout = () => {
    logout();
    navigate('/login');
  };

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <div className="min-h-dvh lg:flex">
      {/* Barra lateral (escritorio) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4 lg:flex">
        <Logo className="mb-8 px-2 text-lg" />
        <nav className="flex flex-1 flex-col gap-1">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} className={linkClass}>
              <it.icon className="size-5" /> {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 pt-4">
          <p className="truncate px-2 text-sm font-medium text-slate-900">{user.name}</p>
          <p className="truncate px-2 text-xs text-slate-500">{ROLE_LABELS[user.role]}</p>
          <button onClick={doLogout} className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
            <LogOut className="size-5" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Barra superior (celular y tableta) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button onClick={doLogout} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Cerrar sesión">
          <LogOut className="size-5" />
        </button>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pb-10">
        <Outlet />
      </main>

      {/* Navegación inferior (celular y tableta) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-brand-700' : 'text-slate-500'}`
            }
          >
            <it.icon className="size-5" />
            {it.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
