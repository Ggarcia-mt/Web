import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Alert, Button, Card, Checkbox, Field, Input, Textarea } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';

export default function SettingsTab({ course, onSaved }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: course.name, description: course.description || '', period: course.period || '', active: course.active });
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put(`/courses/${course.id}`, { ...form, description: form.description || null, period: form.period || null });
      setMsg({ tone: 'success', text: 'Curso actualizado' });
      onSaved();
    } catch (err) {
      setMsg({ tone: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    const answer = window.prompt(`Esto elimina el curso con sus evaluaciones, notas y asistencia. Escribe ${course.joinCode} para confirmar.`);
    if (answer?.trim().toUpperCase() !== course.joinCode) return;
    await api.del(`/courses/${course.id}`);
    navigate('/app/cursos', { replace: true });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Datos del curso</h2>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <form onSubmit={save} className="space-y-4">
          <Field label="Nombre">
            <Input required minLength={3} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Periodo">
            <Input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} />
          </Field>
          <Field label="Descripción">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Checkbox label="Curso activo (permite unirse con código)" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          <div>
            <Button type="submit" loading={loading}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </Card>
      <Card className="border-red-200 p-5">
        <h2 className="mb-2 font-semibold text-red-700">Zona de peligro</h2>
        <p className="mb-4 text-sm text-slate-600">Eliminar el curso borra de forma permanente sus evaluaciones, intentos, notas y registros de asistencia. Exporta las notas a Excel antes si las necesitas.</p>
        <Button variant="danger" icon={Trash2} onClick={remove}>
          Eliminar curso
        </Button>
      </Card>
    </div>
  );
}
