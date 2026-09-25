import { Button } from '../components/ui.jsx';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-6xl font-extrabold text-brand-700">404</p>
      <p className="text-slate-600">La página que buscas no existe.</p>
      <Button to="/">Ir al inicio</Button>
    </div>
  );
}
