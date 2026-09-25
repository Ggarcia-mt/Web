import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Badge, Button, Card, Field, Input, PageHeader } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { ROLE_LABELS, useAuth } from '../lib/auth.jsx';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [info, setInfo] = useState({ name: user.name, document: user.document || '' });
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [msg, setMsg] = useState({});
  const [busy, setBusy] = useState(null);

  const saveInfo = async (e) => {
    e.preventDefault();
    setBusy('info');
    try {
      const data = await api.put('/auth/me', { name: info.name, document: info.document || null });
      setUser(data.user);
      setMsg({ info: 'Datos actualizados' });
    } catch (err) {
      setMsg({ infoError: err.message });
    } finally {
      setBusy(null);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pwd.next !== pwd.confirm) return setMsg({ pwdError: 'Las contraseñas nuevas no coinciden' });
    setBusy('pwd');
    try {
      await api.put('/auth/password', { current: pwd.current, next: pwd.next });
      setPwd({ current: '', next: '', confirm: '' });
      const forced = user.mustChangePassword;
      setUser({ ...user, mustChangePassword: false });
      setMsg({ pwd: 'Contraseña actualizada' });
      if (forced) navigate('/app', { replace: true });
    } catch (err) {
      setMsg({ pwdError: err.message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Mi perfil" subtitle={user.email} />
      {(user.mustChangePassword || params.get('cambiar')) && (
        <Alert tone="warning">Tu cuenta tiene una contraseña temporal. Cámbiala para continuar usando CampusPoli.</Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Datos personales</h2>
            <Badge tone="green">{ROLE_LABELS[user.role]}</Badge>
          </div>
          <Alert tone="success">{msg.info}</Alert>
          <Alert>{msg.infoError}</Alert>
          <form onSubmit={saveInfo} className="space-y-4">
            <Field label="Nombre completo">
              <Input required minLength={3} value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} />
            </Field>
            <Field label="Documento">
              <Input value={info.document} onChange={(e) => setInfo({ ...info, document: e.target.value })} />
            </Field>
            <Field label="Correo" hint="Para cambiar el correo contacta al administrador.">
              <Input value={user.email} disabled />
            </Field>
            <Button type="submit" loading={busy === 'info'}>
              Guardar
            </Button>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Cambiar contraseña</h2>
          <Alert tone="success">{msg.pwd}</Alert>
          <Alert>{msg.pwdError}</Alert>
          <form onSubmit={savePassword} className="space-y-4">
            <Field label="Contraseña actual">
              <Input type="password" required autoComplete="current-password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} />
            </Field>
            <Field label="Nueva contraseña" hint="Mínimo 8 caracteres">
              <Input type="password" required minLength={8} autoComplete="new-password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} />
            </Field>
            <Field label="Confirmar nueva contraseña">
              <Input type="password" required minLength={8} autoComplete="new-password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
            </Field>
            <Button type="submit" loading={busy === 'pwd'}>
              Actualizar contraseña
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
