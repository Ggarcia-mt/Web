// Componentes de interfaz reutilizables (Tailwind).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';

const cx = (...c) => c.filter(Boolean).join(' ');

const BUTTON_VARIANTS = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  soft: 'bg-brand-50 text-brand-800 hover:bg-brand-100',
};

export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, className, children, to, ...props }) {
  const classes = cx(
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
    size === 'sm' ? 'px-3 py-1.5 text-sm' : size === 'lg' ? 'px-5 py-3 text-base' : 'px-4 py-2 text-sm',
    BUTTON_VARIANTS[variant],
    className,
  );
  const content = (
    <>
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4 shrink-0" /> : null}
      {children}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  }
  return (
    <button className={classes} disabled={loading || props.disabled} {...props}>
      {content}
    </button>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <div className={cx('rounded-xl border border-slate-200 bg-white shadow-sm', className)} {...props}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className="mb-1 inline-block text-sm text-brand-700 hover:underline">
            ← {back.label}
          </Link>
        )}
        <h1 className="truncate text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

const inputClasses =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-slate-100';

export function Input({ className, ...props }) {
  return <input className={cx(inputClasses, className)} {...props} />;
}

export function Textarea({ className, ...props }) {
  return <textarea className={cx(inputClasses, 'min-h-20', className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cx(inputClasses, 'pr-8', className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ label, className, ...props }) {
  return (
    <label className={cx('inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700', className)}>
      <input type="checkbox" className="size-4 rounded border-slate-300 accent-brand-700" {...props} />
      {label}
    </label>
  );
}

const BADGE_TONES = {
  slate: 'bg-slate-100 text-slate-700',
  green: 'bg-emerald-100 text-emerald-800',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-800',
  blue: 'bg-sky-100 text-sky-800',
  violet: 'bg-violet-100 text-violet-800',
};

export function Badge({ tone = 'slate', children, className }) {
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', BADGE_TONES[tone], className)}>{children}</span>;
}

export function Alert({ tone = 'error', children, onClose }) {
  const styles = {
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    info: 'border-sky-200 bg-sky-50 text-sky-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  };
  const Icon = tone === 'success' ? CheckCircle2 : AlertCircle;
  if (!children) return null;
  return (
    <div className={cx('mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm', styles[tone])} role="alert">
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="flex-1">{children}</div>
      {onClose && (
        <button onClick={onClose} className="opacity-60 hover:opacity-100" aria-label="Cerrar">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

export function Spinner({ label = 'Cargando…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
      <Loader2 className="size-5 animate-spin" /> {label}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      {Icon && <Icon className="mb-3 size-10 text-slate-300" />}
      <p className="font-medium text-slate-700">{title}</p>
      {children && <p className="mt-1 max-w-md text-sm text-slate-500">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={cx('flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            'flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            active === t.id ? 'border-brand-700 text-brand-800' : 'border-transparent text-slate-500 hover:text-slate-800',
          )}
        >
          {t.icon && <t.icon className="size-4" />}
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, icon: Icon, tone = 'brand' }) {
  const tones = { brand: 'bg-brand-50 text-brand-700', blue: 'bg-sky-50 text-sky-700', amber: 'bg-amber-50 text-amber-700', violet: 'bg-violet-50 text-violet-700' };
  return (
    <Card className="flex items-center gap-4 p-4">
      {Icon && (
        <div className={cx('rounded-lg p-2.5', tones[tone])}>
          <Icon className="size-5" />
        </div>
      )}
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </Card>
  );
}

/** Carga datos con estado de carga/error y permite recargar. */
export function useLoad(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    loader()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => alive && setState({ data: null, loading: false, error: error.message }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1), setData: (data) => setState((s) => ({ ...s, data })) };
}

/** Diálogo que muestra contraseñas temporales para compartir con los usuarios. */
export function CredentialsList({ items }) {
  if (!items?.length) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
      <p className="mb-2 font-medium text-amber-900">Cuentas nuevas y sus contraseñas temporales (compártelas; se pedirá cambiarlas al entrar):</p>
      <ul className="max-h-48 space-y-1 overflow-y-auto font-mono text-xs">
        {items.map((c) => (
          <li key={c.email}>
            {c.email} — <b>{c.tempPassword}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
