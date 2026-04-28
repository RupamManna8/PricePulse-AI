import { type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Shell } from './components/layout/Shell';
import { GlassCard, PageLoader } from './components/ui';
import { DashboardPage } from './pages/DashboardPage';
import { InsightsPage } from './pages/InsightsPage';
import { LandingPage } from './pages/LandingPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { ProductPage } from './pages/ProductPage.jsx';
import { ProductsPage } from './pages/ProductsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { TrackersPage } from './pages/TrackersPage';

function AuthShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-shell min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="auth-hero rounded-3xl p-8 sm:p-10">
          <div className="auth-badge">PricePulse AI</div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">{subtitle}</p>
          <div className="mt-8 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <div className="auth-point">Live price tracking across competitor catalogs</div>
            <div className="auth-point">AI-powered review sentiment intelligence</div>
            <div className="auth-point">Predictive signals for discount probability</div>
            <div className="auth-point">Daily snapshots and dashboard reporting</div>
          </div>
        </section>

        <section className="auth-panel rounded-3xl p-4 sm:p-6">{children}</section>
      </div>
    </main>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoading } = useAuth();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <GlassCard className="w-full max-w-md space-y-4 p-6 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/15 text-lg font-semibold text-primary flex items-center justify-center">PP</div>
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-muted">Signing you in</div>
            <div className="mt-2 text-xl font-semibold text-text">Preparing your intelligence workspace</div>
          </div>
          <PageLoader message="Preparing your intelligence workspace" />
        </GlassCard>
      </main>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/auth/sign-in" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const signInElement = (
    <AuthShell title="Welcome back" subtitle="Sign in to continue monitoring market movement, pricing pressure, and review trends in one place.">
      <SignInPage />
    </AuthShell>
  );

  const signUpElement = (
    <AuthShell title="Create your workspace" subtitle="Set up your account to start tracking competitor products and get actionable pricing insights.">
      <SignUpPage />
    </AuthShell>
  );

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth/sign-in" element={signInElement} />
      <Route path="/auth/sign-up" element={signUpElement} />
      <Route path="/auth/oauth2/callback" element={<OAuthCallbackPage />} />
      <Route path="/login" element={<Navigate to="/auth/sign-in" replace />} />
      <Route path="/signup" element={<Navigate to="/auth/sign-up" replace />} />
      <Route path="/sign-in" element={<Navigate to="/auth/sign-in" replace />} />
      <Route path="/sign-up" element={<Navigate to="/auth/sign-up" replace />} />
      <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
      <Route element={<ProtectedRoute><Shell /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/trackers" element={<TrackersPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:id" element={<ProductPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
