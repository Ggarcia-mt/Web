// Escáner QR con la cámara del celular (requiere HTTPS o localhost).
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function QrScanner({ onResult, paused }) {
  const scannerRef = useRef(null);
  const handled = useRef(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    handled.current = false;
    if (paused) return undefined;
    const scanner = new Html5Qrcode('qr-reader', { verbose: false });
    scannerRef.current = scanner;
    let started = false;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: (w, h) => ({ width: Math.min(w, h) * 0.7, height: Math.min(w, h) * 0.7 }) },
        (text) => {
          if (handled.current) return;
          handled.current = true;
          onResult(text);
        },
        () => {},
      )
      .then(() => {
        started = true;
      })
      .catch(() => setError('No se pudo acceder a la cámara. Revisa los permisos del navegador o usa el código manual.'));

    return () => {
      if (started) scanner.stop().catch(() => {});
    };
  }, [paused, onResult]);

  return (
    <div>
      <div id="qr-reader" className="mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl bg-slate-900" />
      {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
