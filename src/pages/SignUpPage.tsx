import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function SignUpPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signUp(fullName, email, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-panel/60 p-6">
      <h2 className="text-2xl font-semibold text-text">Create account</h2>
      <p className="text-sm text-muted">Local hardcoded-style authentication with JWT.</p>

      <div className="space-y-2">
        <label className="text-sm text-slate-300">Full name</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-lg border border-border bg-black/30 px-3 py-2" />
      </div>

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
        {loading ? 'Creating account...' : 'Sign up'}
      </button>

      <button type="button" onClick={() => navigate('/auth/sign-in')} className="w-full text-sm text-sky-300">
        Already have an account? Sign in
      </button>
    </form>
  );
}
