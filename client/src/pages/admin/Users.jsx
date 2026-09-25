import { useEffect, useRef, useState } from 'react';
import { Download, KeyRound, Pencil, Search, Trash2, Upload, UserPlus } from 'lucide-react';
import { Alert, Badge, Button, Card, Checkbox, CredentialsList, Field, Input, Modal, PageHeader, Select, Spinner, useLoad } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { ROLE_LABELS, useAuth } from '../../lib/auth.jsx';

const ROLE_TONES = { ADMIN: 'red', PROFESOR: 'violet', ESTUDIANTE: 'blue', INDEPENDIENTE: 'slate' };

function UserModal({ user, open, onClose, onSaved }) {
  const editing = Boolean(user?.id);
  const [form, setForm] = useState({});
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(user?.id ? { ...user, document: user.document || '' } : { name: '', email: '', role: 'PROFESOR', document: '', password: '', active: true });
      setError(null);
      setCreated(null);
    }
  }, [open, user]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (editing) {
        await api.put(`/users/${user.id}`, { name: form.name, email: form.email, role: form.role, document: form.document || null, active: form.active });
        onSaved();
        onClose();
      } else {
        const body = { name: form.name, email: form.email, role: form.role, document: form.document || null };
        if (form.password) body.password = form.password;
        const r = await api.post('/users', body);
        onSaved();
        if (r.tempPassword) setCreated({ email: r.user.email, tempPassword: r.tempPassword });
        else onClose();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar usuario' : 'Nuevo usuario'}
      footer={
        created ? (
          <Button onClick={onClose}>Listo</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button form="user-form" type="submit" loading={loading}>
              Guardar
            </Button>
          </>
        )
      }
    >
      <Alert>{error}</Alert>
      {created ? (
        <CredentialsList items={[created]} />
      ) : (
        <form id="user-form" onSubmit={submit} className="space-y-4">
          <Field label="Nombre completo">
            <Input required minLength={3} value={form.name || ''} onChange={set('name')} />
          </Field>
          <Field label="Correo">
            <Input type="email" required value={form.email || ''} onChange={set('email')} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Rol">
              <Select value={form.role} onChange={set('role')}>
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Documento">
              <Input value={form.document || ''} onChange={set('document')} />
            </Field>
          </div>
          {editing ? (
            <Checkbox label="Cuenta activa" checked={Boolean(form.active)} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          ) : (
            <Field label="Contraseña" hint="Vacío = se genera una temporal que el usuario deberá cambiar">
              <Input type="password" minLength={8} value={form.password || ''} onChange={set('password')} />
            </Field>
          )}
        </form>
      )}
    </Modal>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [query, setQuery] = useState({ search: '', role: '' });
  const { data, loading, error, reload } = useLoad(
    () => api.get(`/users?search=${encodeURIComponent(query.search)}&role=${query.role}`),
    [query.search, query.role],
  );
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery({ search, role }), 300);
    return () => clearTimeout(t);
  }, [search, role]);

  const resetPassword = async (u) => {
    if (!window.confirm(`¿Generar una contraseña temporal para ${u.name}?`)) return;
    try {
      const r = await api.post(`/users/${u.id}/reset-password`);
      setImportResult({ created: [{ email: u.email, tempPassword: r.tempPassword }], skipped: [], errors: [] });
      reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err.message });
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`¿Eliminar definitivamente a ${u.name}? Se borran sus intentos y asistencia. Si solo quieres bloquearlo, desactívalo.`)) return;
    try {
      await api.del(`/users/${u.id}`);
      reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err.message });
    }
  };

  const importFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setImportResult(await api.upload('/users/import', file));
      reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err.message });
    }
  };

  return (
    <>
      <PageHeader
        title="Usuarios"
        subtitle="Gestiona perfiles, roles y accesos."
        actions={
          <>
            <Button icon={UserPlus} onClick={() => setModal({})}>
              Nuevo usuario
            </Button>
            <Button variant="secondary" icon={Upload} onClick={() => fileRef.current?.click()}>
              Importar
            </Button>
            <Button variant="secondary" icon={Download} onClick={() => api.download('/users/export.xlsx', 'usuarios.xlsx')}>
              Exportar
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={importFile} />
          </>
        }
      />
      <p className="-mt-4 mb-4 text-xs text-slate-500">
        Importación: columnas Nombre, Correo, Rol (ADMIN, PROFESOR, ESTUDIANTE, INDEPENDIENTE), Documento.{' '}
        <button className="text-brand-700 underline" onClick={() => api.download('/users/template.xlsx', 'plantilla_usuarios.xlsx')}>
          Descargar plantilla
        </button>
      </p>

      {msg && (
        <Alert tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}
      {importResult && (
        <div className="mb-4 space-y-2">
          {(importResult.skipped.length > 0 || importResult.errors.length > 0) && (
            <Alert tone="warning" onClose={() => setImportResult(null)}>
              {importResult.skipped.length > 0 && <p>Ya existían: {importResult.skipped.join(', ')}</p>}
              {importResult.errors.map((e) => (
                <p key={e}>{e}</p>
              ))}
            </Alert>
          )}
          <CredentialsList items={importResult.created} />
        </div>
      )}

      <Card className="mb-4 flex flex-col gap-3 p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-2.5 left-3 size-4 text-slate-400" />
          <Input placeholder="Buscar por nombre, correo o documento" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={role} onChange={(e) => setRole(e.target.value)} className="sm:w-56">
          <option value="">Todos los roles</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Card>

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <Alert>{error}</Alert>
      ) : (
        <Card className="divide-y divide-slate-100">
          {data.users.map((u) => (
            <div key={u.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{u.name}</p>
                  <Badge tone={ROLE_TONES[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                  {!u.active && <Badge tone="red">Inactivo</Badge>}
                  {u.mustChangePassword && <Badge tone="amber">Clave temporal</Badge>}
                </div>
                <p className="truncate text-xs text-slate-500">
                  {u.email}
                  {u.document ? ` · ${u.document}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setModal(u)}>
                  Editar
                </Button>
                <Button size="sm" variant="ghost" icon={KeyRound} onClick={() => resetPassword(u)}>
                  Clave
                </Button>
                {u.id !== me.id && (
                  <button onClick={() => remove(u)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Eliminar a ${u.name}`}>
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {data.users.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">No se encontraron usuarios</p>}
        </Card>
      )}
      <UserModal user={modal} open={Boolean(modal)} onClose={() => setModal(null)} onSaved={reload} />
    </>
  );
}
