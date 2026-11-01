import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, HelpCircle, LogOut, Trash2 } from 'lucide-react';
import clsx from 'clsx';

type Tone = 'primary' | 'danger';
type IconName = 'warning' | 'logout' | 'delete' | 'question';

interface Request {
  title: string;
  message?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: Tone;
  icon?: IconName;
  /** Ask for text input instead of a yes/no (e.g. a rejection reason). */
  input?: { placeholder?: string; required?: boolean; defaultValue?: string };
  /** The user must type this exact word to enable the confirm button. */
  typeToConfirm?: string;
}

type Pending = Request & { resolve: (v: string | boolean | null) => void };

let open: ((r: Pending) => void) | null = null;

/** Promise-based confirmation dialog: `if (await confirm({ title: 'Delete?' })) ...` */
export function confirm(r: Omit<Request, 'input'>): Promise<boolean> {
  return new Promise((resolve) => {
    if (!open) return resolve(window.confirm(r.title));
    open({ ...r, resolve: (v) => resolve(v === true) });
  });
}

/** Asks for a line of text; resolves null when cancelled. */
export function askText(r: Request & { input: NonNullable<Request['input']> }): Promise<string | null> {
  return new Promise((resolve) => {
    if (!open) return resolve(window.prompt(r.title));
    open({ ...r, resolve: (v) => resolve(typeof v === 'string' ? v : null) });
  });
}

const ICONS: Record<IconName, typeof HelpCircle> = { warning: AlertTriangle, logout: LogOut, delete: Trash2, question: HelpCircle };

export function ConfirmHost() {
  const [req, setReq] = useState<Pending | null>(null);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    open = (r) => {
      setText(r.input?.defaultValue ?? '');
      setReq(r);
    };
    return () => {
      open = null;
    };
  }, []);
  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(null);
    document.addEventListener('keydown', onKey);
    setTimeout(() => inputRef.current?.focus(), 50);
    return () => document.removeEventListener('keydown', onKey);
  });

  function close(v: string | boolean | null) {
    req?.resolve(v);
    setReq(null);
  }
  if (!req) return null;

  const tone = req.tone ?? 'primary';
  const Icon = ICONS[req.icon ?? (tone === 'danger' ? 'warning' : 'question')];
  const blocked = (req.typeToConfirm && text.trim().toUpperCase() !== req.typeToConfirm) || (req.input?.required && !text.trim());

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/45 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={() => close(null)}>
      <div className="dialog-in w-full rounded-t-3xl bg-white p-6 shadow-lift sm:max-w-sm sm:rounded-3xl" role="alertdialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className={clsx('mx-auto flex h-14 w-14 items-center justify-center rounded-2xl', tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-light-green text-primary')}>
          <Icon size={26} />
        </div>
        <h2 className="mt-4 text-center text-lg">{req.title}</h2>
        {req.message && <div className="mt-1.5 text-center text-sm text-muted">{req.message}</div>}
        {(req.input || req.typeToConfirm) && (
          <input
            ref={inputRef}
            className="input mt-4"
            placeholder={req.input?.placeholder ?? (req.typeToConfirm ? `Type ${req.typeToConfirm} to confirm` : '')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !blocked && close(req.input ? text.trim() : true)}
          />
        )}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button className="h-11 rounded-xl border border-line font-medium text-ink transition hover:bg-beige/60" onClick={() => close(null)}>
            {req.cancelText ?? 'Cancel'}
          </button>
          <button
            disabled={!!blocked}
            className={clsx(
              'h-11 rounded-xl font-semibold text-white transition active:scale-[0.98] disabled:opacity-40',
              tone === 'danger' ? 'bg-danger hover:brightness-95' : 'bg-primary hover:bg-dark-green',
            )}
            onClick={() => close(req.input ? text.trim() : true)}
          >
            {req.confirmText ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
