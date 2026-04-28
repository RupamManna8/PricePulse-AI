import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { finishOAuthFromUrl } = useAuth();

  useEffect(() => {
    let active = true;

    async function complete() {
      const ok = await finishOAuthFromUrl();
      if (!active) {
        return;
      }
      navigate(ok ? '/dashboard' : '/auth/sign-in', { replace: true });
    }

    void complete();

    return () => {
      active = false;
    };
  }, [finishOAuthFromUrl, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="rounded-2xl border border-border bg-panel/70 p-6 text-center">
        <p className="text-sm text-muted">Finishing OAuth2 sign-in...</p>
      </div>
    </div>
  );
}
