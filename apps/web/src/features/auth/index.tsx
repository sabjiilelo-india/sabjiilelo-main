import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Lock, Phone, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { canAutoFocus } from '../../lib/device';
import { homeFor, useAuth } from '../../lib/auth';
import { Button, Field, Input, PageLoader } from '../../components/ui';

export default function Auth({ page }: { page: 'otp' | 'superadmin' }) {
  return page === 'otp' ? <OtpLogin /> : <SuperAdminLogin />;
}

function AuthShell({ children, side }: { children: React.ReactNode; side?: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-dark-green via-primary to-deep lg:block">
        <img src="/images/hero-banner.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-luminosity" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <img src="/images/logo-full-dark.webp" alt="Sabjii Le Lo" className="h-12 w-fit" onError={(e) => (e.currentTarget.src = '/images/logo-full.webp')} />
          {side ?? (
            <div>
              <p className="font-script text-5xl leading-tight">Fresh from the farm,</p>
              <p className="font-script text-5xl leading-tight text-[#9be36f]">at your door every morning.</p>
              <ul className="mt-8 space-y-3 text-white/85">
                <li>🌱 Picked at dawn, delivered in your slot</li>
                <li>🤝 Not fresh? Return it right at the door</li>
                <li>💸 Pay online or cash on delivery</li>
              </ul>
            </div>
          )}
          <img src="/icons/brand-truck.webp" alt="" className="animate-truck h-24 w-fit" />
        </div>
      </div>
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}

function OtpLogin() {
  const { status, user, loginWithOtp } = useAuth();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  if (status === 'loading') return <PageLoader />;
  if (user) {
    const next = params.get('next');
    return <Navigate to={user.role === 'CUSTOMER' && next ? next : homeFor(user.role)} replace />;
  }

  async function sendOtp() {
    setError(null);
    if (!/^[6-9]\d{9}$/.test(phone)) return setError('Enter a valid 10-digit mobile number');
    setBusy(true);
    try {
      const r = await api.auth.requestOtp(phone);
      setHint(r.devHint ? `Testing mode: use OTP ${r.devHint}` : null);
      setStep('otp');
      setResendIn(30);
      if (canAutoFocus) setTimeout(() => otpRef.current?.focus(), 50);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(otp = code) {
    if (otp.length !== 4) return setError('Enter the 4-digit OTP');
    setError(null);
    setBusy(true);
    try {
      const u = await loginWithOtp(phone, otp);
      const next = params.get('next');
      nav(u.role === 'CUSTOMER' && next ? next : homeFor(u.role), { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setCode('');
      if (canAutoFocus) otpRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <Link to="/" className="mb-8 inline-block lg:hidden">
        <img src="/images/logo-full.webp" alt="Sabjii Le Lo" className="h-11" />
      </Link>
      {step === 'phone' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendOtp();
          }}
        >
          <h1 className="text-2xl">Login or sign up</h1>
          <p className="mt-1 text-sm text-muted">Customers, staff and partners all sign in with their mobile number.</p>
          <Field label="Mobile number" className="mt-6">
            <div className="flex">
              <span className="flex items-center gap-1 rounded-l-xl border border-r-0 border-line bg-beige/60 px-3 text-sm text-muted">
                <Phone size={14} /> +91
              </span>
              <Input
                autoFocus={canAutoFocus}
                inputMode="numeric"
                maxLength={10}
                placeholder="98765 43210"
                className="rounded-l-none text-base tracking-wider"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </Field>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          <Button type="submit" size="lg" block className="mt-6" loading={busy}>
            Get OTP
          </Button>
          <p className="mt-4 text-center text-xs text-muted">By continuing you agree to our terms and privacy policy.</p>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
        >
          <button type="button" onClick={() => setStep('phone')} className="mb-4 flex items-center gap-1 text-sm text-muted hover:text-primary">
            <ArrowLeft size={16} /> Change number
          </button>
          <h1 className="text-2xl">Enter OTP</h1>
          <p className="mt-1 text-sm text-muted">Sent to +91 {phone}</p>
          {hint && <p className="mt-3 rounded-lg bg-light-green px-3 py-2 text-sm text-primary">{hint}</p>}
          {/* Four boxes backed by one input, so paste and SMS autofill keep working. */}
          <label className="relative mt-6 grid cursor-text grid-cols-4 gap-3" onClick={() => otpRef.current?.focus()}>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`flex h-14 items-center justify-center rounded-2xl border-2 bg-white text-2xl font-bold text-ink transition ${
                  code.length === i ? 'border-primary ring-4 ring-primary/10' : code[i] ? 'border-primary/40' : 'border-line'
                }`}
              >
                {code[i] ?? ''}
              </span>
            ))}
            <input
              ref={otpRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              aria-label="4-digit OTP"
              className="absolute inset-0 opacity-0"
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                setCode(v);
                if (v.length === 4 && !busy) verify(v);
              }}
            />
          </label>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          <Button type="submit" size="lg" block className="mt-6" loading={busy} disabled={code.length < 4}>
            Verify & continue
          </Button>
          <button type="button" disabled={resendIn > 0 || busy} onClick={sendOtp} className="mt-4 w-full text-center text-sm text-primary disabled:text-muted">
            {resendIn > 0 ? `Resend OTP in ${resendIn}s` : 'Resend OTP'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

function SuperAdminLogin() {
  const { status, user, adminLogin } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'loading') return <PageLoader />;
  if (user?.role === 'SUPERADMIN') return <Navigate to="/admin/overview" replace />;

  return (
    <AuthShell
      side={
        <div>
          <ShieldCheck size={56} className="mb-4 text-[#9be36f]" />
          <p className="text-3xl font-semibold">Super admin console</p>
          <p className="mt-2 max-w-sm text-white/80">Create areas, assign area admins and keep an eye on every city.</p>
        </div>
      }
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setBusy(true);
          try {
            await adminLogin(username, password);
            nav('/admin/overview', { replace: true });
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-light-green text-primary">
          <Lock size={22} />
        </div>
        <h1 className="text-2xl">Super admin login</h1>
        <p className="mt-1 text-sm text-muted">Restricted area. Area staff should use the OTP login.</p>
        {user && <p className="mt-3 rounded-lg bg-accent/10 px-3 py-2 text-sm text-[#c25a14]">You are signed in as {user.role.toLowerCase()}. Log out first to use this page.</p>}
        <Field label="Username" className="mt-6">
          <Input autoFocus={canAutoFocus} autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </Field>
        <Field label="Password" className="mt-4">
          <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" block className="mt-6" loading={busy} disabled={!username || !password}>
          Sign in
        </Button>
        <Link to="/login" className="mt-4 block text-center text-sm text-primary">
          Staff / customer login with OTP
        </Link>
      </form>
    </AuthShell>
  );
}
