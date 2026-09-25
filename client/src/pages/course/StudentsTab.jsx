import { useRef, useState } from 'react';
import { Copy, Download, RefreshCw, Trash2, Upload, UserPlus, Users } from 'lucide-react';
import { Alert, Badge, Button, Card, CredentialsList, EmptyState, Field, Input, Modal, Spinner, useLoad } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { ROLE_LABELS } from '../../lib/auth.jsx';

function AddStudentModal({ course, open, onClose, onAdded }) {
  const [form, setForm] = useState({ email: '', name: '', document: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const close = () => {
    setForm({ email: '', name: '', document: '' });
    setResult(null);
    setError(null);
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body = { email: form.email };
      if (form.name) body.name = form.name;
      if (form.document) body.document = form.document;
      const r = await api.post(`/courses/${course.id}/students`, body);
      setResult(r);
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Inscribir estudiante"
      footer={
        result ? (
          <Button onClick={close}>Listo</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              Cancelar
            </Button>
            <Button form="student-form" type="submit" loading={loading}>
              Inscribir
            </Button>
          </>
        )
      }
    >
      <Alert>{error}</Alert>
      {result ? (
        <>
          <Alert tone="success">{result.student.name} quedó inscrito en el curso.</Alert>
          {result.created && <CredentialsList items={[{ email: result.student.email, tempPassword: result.tempPassword }]} />}
        </>
      ) : (
        <form id="student-form" onSubmit={submit} className="space-y-4">
          <Field label="Correo">
            <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <p className="text-xs text-slate-500">Si el estudiante no tiene cuenta, se crea con estos datos y una contraseña temporal.</p>
          <Field label="Nombre completo">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Documento" hint="Si tiene 8 o más dígitos se usa como contraseña temporal">
            <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
          </Field>
        </form>
      )}
    </Modal>
  );
}

export default function StudentsTab({ course, onChange }) {
  const { data, loading, error, reload } = useLoad(() => api.get(`/courses/${course.id}/students`), [course.id]);
  const [adding, setAdding] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(null);
  const fileRef = useRef(null);

  const refreshAll = () => {
    reload();
    onChange();
  };

  const importFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy('import');
    setMsg(null);
    try {
      const r = await api.upload(`/courses/${course.id}/students/import`, file);
      setImportResult(r);
      refreshAll();
    } catch (err) {
      setMsg({ tone: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (s) => {
    if (!window.confirm(`¿Retirar a ${s.name} del curso? Sus intentos y asistencia se conservan en su cuenta.`)) return;
    try {
      await api.del(`/courses/${course.id}/students/${s.id}`);
      refreshAll();
    } catch (err) {
      setMsg({ tone: 'error', text: err.message });
    }
  };

  const regenerate = async () => {
    if (!window.confirm('El código actual dejará de funcionar. ¿Generar uno nuevo?')) return;
    await api.post(`/courses/${course.id}/regenerate-code`);
    onChange();
  };

  const copyInvite = async () => {
    const link = `${window.location.origin}/registro?codigo=${course.joinCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setMsg({ tone: 'success', text: `Enlace copiado: ${link}` });
    } catch {
      setMsg({ tone: 'info', text: link });
    }
  };

  return (
    <>
      <Card className="mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">Código para unirse al curso</p>
          <p className="font-mono text-2xl font-bold tracking-widest text-brand-800">{course.joinCode}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={Copy} onClick={copyInvite}>
            Copiar enlace de invitación
          </Button>
          <Button size="sm" variant="ghost" icon={RefreshCw} onClick={regenerate}>
            Nuevo código
          </Button>
        </div>
      </Card>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button icon={UserPlus} onClick={() => setAdding(true)}>
          Inscribir estudiante
        </Button>
        <Button variant="secondary" icon={Upload} loading={busy === 'import'} onClick={() => fileRef.current?.click()}>
          Importar Excel
        </Button>
        <Button variant="ghost" icon={Download} onClick={() => api.download('/courses/students-template.xlsx', 'plantilla_estudiantes.xlsx')}>
          Plantilla
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={importFile} />
      </div>

      {msg && (
        <Alert tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}
      {importResult && (
        <div className="mb-4 space-y-2">
          <Alert tone="success" onClose={() => setImportResult(null)}>
            {importResult.enrolled} estudiantes inscritos ({importResult.created.length} cuentas nuevas).
          </Alert>
          {importResult.errors.length > 0 && (
            <Alert tone="warning">
              <ul className="list-disc pl-4">
                {importResult.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Alert>
          )}
          <CredentialsList items={importResult.created} />
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : error ? (
        <Alert>{error}</Alert>
      ) : data.students.length === 0 ? (
        <EmptyState icon={Users} title="Aún no hay estudiantes">
          Compárteles el código del curso, inscríbelos uno a uno o importa la lista desde Excel (columnas Nombre, Correo, Documento).
        </EmptyState>
      ) : (
        <Card className="divide-y divide-slate-100">
          {data.students.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{s.name}</p>
                <p className="truncate text-xs text-slate-500">
                  {s.email}
                  {s.document ? ` · ${s.document}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {s.mustChangePassword && <Badge tone="amber">Sin activar</Badge>}
                <Badge className="hidden sm:inline-flex">{ROLE_LABELS[s.role]}</Badge>
                <button onClick={() => remove(s)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Retirar a ${s.name}`}>
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}
      <AddStudentModal course={course} open={adding} onClose={() => setAdding(false)} onAdded={refreshAll} />
    </>
  );
}
