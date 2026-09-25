// Destino del QR cuando se escanea con la cámara nativa del celular.
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Logo } from '../components/Layout.jsx';
import { Button, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { AttendanceResult } from './ScanAttendance.jsx';

export default function MarkAttendance() {
  const [params] = useSearchParams();
  const [result, setResult] = useState(null);
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const sessionId = Number(params.get('s'));
    const token = params.get('t');
    if (!sessionId || !token) {
      setResult({ error: 'El enlace de asistencia está incompleto.' });
      return;
    }
    api
      .post('/attendance/scan', { sessionId, token })
      .then(setResult)
      .catch((err) => setResult({ error: err.message }));
  }, [params]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-4">
      <Logo className="mb-6 text-lg" />
      <div className="w-full max-w-md">
        {result ? (
          <>
            <AttendanceResult result={result} />
            {result.error && (
              <div className="mt-4 text-center">
                <Button variant="secondary" to="/app/escanear">
                  Escanear de nuevo
                </Button>
              </div>
            )}
          </>
        ) : (
          <Spinner label="Registrando asistencia…" />
        )}
      </div>
    </div>
  );
}
