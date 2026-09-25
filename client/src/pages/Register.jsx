import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, Field, Input } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';
import { AuthShell, safeNext } from './Login.jsx';

export default function Register() {
  const { user, register } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', document: '', password: '', confirm: '', joinCode: params.get('codigo') || '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const next = safeNext(params.get('next'));

  if (user) return <Navigate to={next} replace />;

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('Las contraseñas no coinciden');
    setLoading(true);
    setError(null);
    try {
      const { confirm, ...payload } = form;
      if (!payload.joinCode) delete payload.joinCode;
      if (!payload.document) delete payload.document;
      await register(payload);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Crear cuenta" subtitle="Si tu profesor te dio un código de curso, escríbelo para unirte de una vez.">
      <Alert>{error}</Alert>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nombre completo">
          <Input required minLength={3} autoComplete="name" value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Correo">
          <Input type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Documento (opcional)">
          <Input inputMode="numeric" value={form.document} onChange={set('document')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contraseña" hint="Mínimo 8 caracteres">
            <Input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} />
          </Field>
          <Field label="Confirmar contraseña">
            <Input type="password" required minLength={8} autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
          </Field>
        </div>
        <Field label="Código de curso (opcional)" hint="Sin código quedas como estudiante independiente; podrás unirte después.">
          <Input value={form.joinCode} onChange={(e) => setForm({ ...form, joinCode: e.target.value.toUpperCase() })} className="uppercase tracking-widest" />
        </Field>
        <Button type="submit" loading={loading} className="w-full">
          Crear cuenta
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-medium text-brand-700 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </AuthShell>
  );
}
