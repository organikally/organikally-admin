import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Wordmark } from '@/components/ui/Logo';
import { Button, Field, Spinner } from '@/components/ui/primitives';
import { errorMessage } from '@/lib/errors';

const DEMO_ACCOUNTS = [
  { email: 'admin@organikally.in', role: 'Admin' },
  { email: 'asm.delhi@organikally.in', role: 'ASM' },
  { email: 'head@organikally.in', role: 'Regional Head' },
  { email: 'wh@organikally.in', role: 'Warehouse' },
  { email: 'finance@organikally.in', role: 'Finance' },
];
const DEMO_PASSWORD = 'Organikally@123';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between bg-ink p-10 text-paper lg:flex">
        <Wordmark className="[&_.font-display]:!text-paper [&_.text-gold-ink]:!text-yellow" showSub />
        <div className="max-w-md">
          <h2 className="font-display text-3xl leading-tight text-paper">
            Field sales control, end to end.
          </h2>
          <p className="mt-3 text-sm text-paper/70">
            Coverage, strike rate, receivables and live rep activity in one calm, dense console,
            scoped to your role and territory.
          </p>
        </div>
        <div className="flex gap-6 text-xs text-paper/60">
          <span>Pre-sales lifecycle</span>
          <span>Per-warehouse stock</span>
          <span>Receivables aging</span>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-yellow/15 blur-3xl"
        />
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-paper p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <Wordmark />
          </div>
          <h1 className="font-display text-2xl leading-tight text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-ink-faint">Use your Organikally staff credentials.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Field label="Email" required>
              <input
                className="input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@organikally.in"
                required
              />
            </Field>
            <Field label="Password" required>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </Field>

            {error && (
              <div className="rounded-chip border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? <Spinner className="text-ink" /> : 'Sign in'}
            </Button>
          </form>

          <div className="mt-8 rounded-card border border-line bg-surface p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
              Demo accounts, password {DEMO_PASSWORD}
            </div>
            <div className="grid grid-cols-1 gap-1">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword(DEMO_PASSWORD);
                  }}
                  className="flex cursor-pointer items-center justify-between rounded-chip px-2 py-1.5 text-left text-xs hover:bg-surface"
                >
                  <span className="font-medium text-ink">{a.email}</span>
                  <span className="text-ink-faint">{a.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
