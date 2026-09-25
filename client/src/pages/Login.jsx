import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '../components/Layout.jsx';
import { Alert, Button, Card, Field, Input } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-slate-50 px-4 py-10">
      <Link to="/" className="mb-6">
        <Logo className="text-xl" />
      </Link>
      <Card className="w-full max-w-md p-6 sm:p-8">
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 mb-5 text-sm text-slate-500">{subtitle}</p>}
        {children}
      </Card>
    </div>
  );
}

/** Solo permite redirecciones internas (evita open redirect). */
export function safeNext(value) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/app';
}

export default function Login() {
  const { user, login, notice, setNotice } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const next = safeNext(params.get('next'));

  if (user) return <Navigate to={next} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(form.email, form.password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Iniciar sesión" subtitle="Ingresa con tu correo institucional o personal.">
      <Alert tone="warning" onClose={() => setNotice(null)}>
        {notice}
      </Alert>
      <Alert>{error}</Alert>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Correo">
          <Input type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Contraseña">
          <Input type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Button type="submit" loading={loading} className="w-full">
          Entrar
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        ¿No tienes cuenta?{' '}
        <Link to={`/registro${params.get('next') ? `?next=${encodeURIComponent(params.get('next'))}` : ''}`} className="font-medium text-brand-700 hover:underline">
          Regístrate
        </Link>
      </p>
    </AuthShell>
  );
}
