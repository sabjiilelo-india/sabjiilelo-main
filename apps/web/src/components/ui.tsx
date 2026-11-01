import { createPortal } from 'react-dom';
import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Loader2, X } from 'lucide-react';
import clsx from 'clsx';
import { ORDER_STATUS_LABEL, type OrderStatus } from '@sabjiilelo/shared';
import { confirm } from './confirm';

// ---------------------------------------------------------------- button

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-dark-green shadow-sm',
  accent: 'bg-accent text-white hover:brightness-95 shadow-sm',
  secondary: 'bg-light-green text-primary hover:bg-light-green/70',
  outline: 'border border-line bg-white text-ink hover:border-primary hover:text-primary',
  ghost: 'text-body hover:bg-beige/70',
  danger: 'bg-danger text-white hover:brightness-95',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2 rounded-xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, block, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" size={size === 'sm' ? 14 : 18} /> : icon}
      {children}
    </button>
  );
});

// ---------------------------------------------------------------- form fields

export function Field({ label, hint, error, children, className }: { label?: string; hint?: string; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      {label && <span className="label">{label}</span>}
      {children}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={clsx('input', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={clsx('input min-h-[80px]', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={clsx('input appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', className)} style={{ backgroundImage: CHEVRON }} {...rest}>
      {children}
    </select>
  );
});
const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7a70' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;

/** Rupee amount input that works in paise. */
export function MoneyInput({ value, onChange, ...rest }: { value: number; onChange: (paise: number) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">₹</span>
      <Input
        type="number"
        inputMode="decimal"
        step="0.01"
        min={0}
        className="pl-7"
        value={Number.isFinite(value) ? value / 100 : ''}
        onChange={(e) => onChange(Math.round(Number(e.target.value || 0) * 100))}
        {...rest}
      />
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-sm disabled:opacity-50"
    >
      <span className={clsx('relative h-6 w-11 rounded-full transition', checked ? 'bg-primary' : 'bg-line')}>
        <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', checked ? 'left-[22px]' : 'left-0.5')} />
      </span>
      {label}
    </button>
  );
}

// ---------------------------------------------------------------- display

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('card', className)} {...rest}>
      {children}
    </div>
  );
}

type Tone = 'green' | 'orange' | 'red' | 'gray' | 'blue' | 'yellow';
const tones: Record<Tone, string> = {
  green: 'bg-light-green text-primary',
  orange: 'bg-accent/15 text-[#c25a14]',
  red: 'bg-danger/10 text-danger',
  gray: 'bg-beige text-muted',
  blue: 'bg-sky-100 text-sky-700',
  yellow: 'bg-amber-100 text-amber-700',
};

export function Badge({ tone = 'gray', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>;
}

const STATUS_TONE: Record<OrderStatus, Tone> = {
  PAYMENT_PENDING: 'yellow',
  PLACED: 'blue',
  CONFIRMED: 'blue',
  PACKING: 'orange',
  PACKED: 'orange',
  ASSIGNED: 'orange',
  OUT_FOR_DELIVERY: 'orange',
  DELIVERED: 'green',
  PARTIALLY_DELIVERED: 'green',
  CANCELLED: 'red',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{ORDER_STATUS_LABEL[status]}</Badge>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('animate-spin text-primary', className)} size={22} />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />;
}

export function EmptyState({ title, text, action, icon = '/icons/leaf.webp' }: { title: string; text?: string; action?: ReactNode; icon?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <img src={icon} alt="" className="animate-leaf mb-4 h-20 w-20 object-contain" />
      <h3 className="text-lg">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center">
      <p className="text-sm text-danger">{(error as Error)?.message ?? 'Something went wrong'}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon, tone = 'green' }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: 'green' | 'orange' | 'red' }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
        {icon && (
          <span className={clsx('rounded-xl p-2', tone === 'green' && 'bg-light-green text-primary', tone === 'orange' && 'bg-accent/15 text-accent', tone === 'red' && 'bg-danger/10 text-danger')}>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2 text-2xl font-semibold text-ink">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-beige/70 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={clsx('rounded-lg px-3 py-1.5 text-sm font-medium transition', value === o.value ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- modal

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  // Portal to <body>: an animated (transformed) ancestor would otherwise trap the fixed overlay
  // inside itself, clipping the dialog and breaking its scrolling.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={clsx('dialog-in flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-lift sm:max-h-[88vh] sm:rounded-3xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-beige" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && <div className="flex shrink-0 justify-end gap-2 border-t border-line bg-white px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmButton({ onConfirm, confirmText = 'Are you sure?', ...props }: ButtonProps & { onConfirm: () => void; confirmText?: string }) {
  return <Button {...props} onClick={async () => (await confirm({ title: confirmText })) && onConfirm()} />;
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('card overflow-x-auto', className)}>
      <table className="table-base">{children}</table>
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted">
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
