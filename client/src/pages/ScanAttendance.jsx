// Pantalla 1 del prototipo: registro de asistencia por QR (vista estudiante).
import { useCallback, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import QrScanner from '../components/QrScanner.jsx';
import { Button, Card, Field, Input, PageHeader } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { ATTENDANCE_STATUS } from '../lib/format.js';

/** Acepta la URL del QR (…/asistencia/marcar?s=ID&t=TOKEN) o el código manual ID-TOKEN. */
export function parseAttendanceCode(text) {
  const value = String(text || '').trim();
  try {
    const url = new URL(value);
    const s = url.searchParams.get('s');
    const t = url.searchParams.get('t');
    if (s && t) return { sessionId: Number(s), token: t };
  } catch {
    /* no es URL */
  }
  const dash = value.indexOf('-');
  if (dash > 0) return { sessionId: Number(value.slice(0, dash)), token: value.slice(dash + 1) };
  return null;
}

export function AttendanceResult({ result, onRetry }) {
  if (result.error) {
    return (
      <Card className="flex flex-col items-center p-8 text-center">
        <XCircle className="mb-3 size-16 text-red-500" />
        <p className="text-lg font-semibold">No se registró la asistencia</p>
        <p className="mt-1 text-sm text-slate-600">{result.error}</p>
        {onRetry && (
          <Button className="mt-6" onClick={onRetry}>
            Intentar de nuevo
          </Button>
        )}
      </Card>
    );
  }
  const status = ATTENDANCE_STATUS[result.record.status];
  return (
    <Card className="flex flex-col items-center p-8 text-center">
      <CheckCircle2 className="mb-3 size-16 text-emerald-600" />
      <p className="text-lg font-semibold">{result.already ? 'Ya estabas registrado' : '¡Asistencia registrada!'}</p>
      <p className="mt-1 text-sm text-slate-600">
        {result.courseName} · {result.sessionTitle}
      </p>
      <p className="mt-3 text-sm">
        Estado: <b>{status.label}</b> · {new Date(result.record.markedAt).toLocaleTimeString('es-CO', { timeStyle: 'short' })}
      </p>
      <Button className="mt-6" to="/app">
        Ir al inicio
      </Button>
    </Card>
  );
}

export default function ScanAttendance() {
  const [result, setResult] = useState(null);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async (text) => {
    const code = parseAttendanceCode(text);
    if (!code) return setResult({ error: 'El código no es válido para asistencia.' });
    setBusy(true);
    try {
      setResult(await api.post('/attendance/scan', code));
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <>
      <PageHeader title="Registrar asistencia" subtitle="Apunta la cámara al código QR que proyecta tu profesor." />
      <div className="mx-auto max-w-md">
        {result ? (
          <AttendanceResult result={result} onRetry={() => setResult(null)} />
        ) : (
          <>
            <Card className="p-4">
              <QrScanner onResult={submit} paused={busy} />
              {busy && <p className="mt-3 text-center text-sm text-slate-500">Validando…</p>}
            </Card>
            <Card className="mt-4 p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit(manual);
                }}
                className="flex items-end gap-2"
              >
                <Field label="¿Sin cámara? Escribe el código manual" className="flex-1">
                  <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="12-AbCdEf123456" className="font-mono" />
                </Field>
                <Button type="submit" loading={busy}>
                  Enviar
                </Button>
              </form>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
