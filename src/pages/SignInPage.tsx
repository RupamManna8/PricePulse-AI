import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function SignInPage() {
  const navigate = useNavigate();
  const { signIn, startGoogleOAuth } = useAuth();
  const [email, setEmail] = useState('admin@pricepulse.dev');
  const [password, setPassword] = useState('Admin@123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-panel/60 p-6">
      <h2 className="text-2xl font-semibold text-text">Sign in</h2>
      <p className="text-sm text-muted">Use hardcoded admin credentials or OAuth2.</p>

      <div className="space-y-2">
        <label className="text-sm text-slate-300">Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-border bg-black/30 px-3 py-2" />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-slate-300">Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-border bg-black/30 px-3 py-2" />
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <button type="submit" disabled={loading} className="w-full rounded-lg bg-primary px-4 py-2 font-medium text-white disabled:opacity-60">
        {loading ? 'Signing in...' : 'Sign in'}
      </button>

      <button type="button" onClick={startGoogleOAuth} className="w-full rounded-lg border border-border px-4 py-2 text-sm text-slate-200">
        Continue with Google (OAuth2)
      </button>

      <button type="button" onClick={() => navigate('/auth/sign-up')} className="w-full text-sm text-sky-300">
        Need an account? Sign up
      </button>
    </form>
  );
}
