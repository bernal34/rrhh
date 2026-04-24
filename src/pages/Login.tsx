import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

type LocState = { from?: { pathname?: string } };

export default function Login() {
  const { signIn, user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = (loc.state as LocState | null)?.from?.pathname ?? '/';
  if (user) {
    nav(from, { replace: true });
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) setErr(error);
    else nav(from, { replace: true });
  }

  return (
    <div className="flex h-full items-center justify-center bg-slate-50 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="mb-1 text-xl font-semibold text-brand-700">Portal RRHH</h1>
        <p className="mb-5 text-sm text-slate-500">Inicia sesión con tu cuenta.</p>

        <div className="flex flex-col gap-3">
          <Input
            label="Correo"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {err && <div className="text-sm text-red-600">{err}</div>}
          <Button type="submit" loading={busy} className="mt-2 w-full">
            Entrar
          </Button>
        </div>
      </form>
    </div>
  );
}
