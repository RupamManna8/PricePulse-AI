import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Button } from '../ui';

const ribbonItems = [
  'Live pricing intelligence',
  'Multi-user analytics workspace',
  'Real-time sentiment tracking',
  'Automated market monitoring system'
];

const navItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Trackers', to: '/trackers' },
  { label: 'Products', to: '/products' },
  { label: 'Insights', to: '/insights' },
  { label: 'Settings', to: '/settings' }
];

export function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSignedIn, user, signOut } = useAuth();

  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Please sign in to continue</h2>
          <Button variant="primary" onClick={() => navigate('/auth/sign-in')}>Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-text">
      <div className="border-b border-border/70 bg-panel/80 backdrop-blur-xl">
        <div className="marquee-mask overflow-hidden border-b border-border/60 px-4 py-2 text-xs text-slate-300">
          <div className="flex w-[200%] items-center gap-8 whitespace-nowrap animate-marquee">
            {[...ribbonItems, ...ribbonItems].map((item, index) => (
              <span key={`${item}-${index}`} className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-2.6rem)]">
        <aside className="group sticky top-0 flex h-screen w-18 flex-col border-r border-border/70 bg-panel/70 px-3 py-4 transition-all duration-300 hover:w-64">
          <div className="mb-6 flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-sm font-semibold text-primary">PP</div>
            <div className="overflow-hidden whitespace-nowrap opacity-0 transition group-hover:opacity-100">
              <div className="text-sm font-semibold">PricePulse AI</div>
              <div className="text-xs text-muted">Enterprise Intelligence</div>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition',
                    isActive || location.pathname === item.to ? 'bg-white/8 text-white glow-border' : 'text-slate-400 hover:bg-white/5 hover:text-text'
                  ].join(' ')
                }
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white/5 text-[11px] font-semibold text-slate-300">
                  {item.label.slice(0, 2)}
                </span>
                <span className="overflow-hidden whitespace-nowrap opacity-0 transition group-hover:opacity-100">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto space-y-3 px-1">
            <Badge tone="success">Auto-Monitoring Active</Badge>
            <div className="overflow-hidden rounded-2xl border border-border bg-white/5 p-3 opacity-0 transition group-hover:opacity-100">
              <div className="text-xs uppercase tracking-[0.24em] text-muted">Next update</div>
              <div className="mt-2 text-sm text-slate-300">In 4 hours 23 minutes</div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border/70 bg-bg/80 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 lg:px-8">
              <div className="min-w-[220px] flex-1">
                <div className="text-xs uppercase tracking-[0.28em] text-muted">Quick search</div>
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-border bg-white/5 px-4 py-3 text-sm text-slate-300">
                  <span className="text-slate-500">⌘K</span>
                  <div className="h-4 w-px bg-border" />
                  <span className="truncate">Products, competitors, reports...</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="accent" onClick={() => navigate('/onboarding')}>+ Add Competitor</Button>
                <Button variant="outline" onClick={() => navigate('/settings')}>Preferences</Button>
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-white/5 px-3 py-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white/10 text-[11px] font-semibold text-slate-200">
                    {(user?.fullName || user?.email || 'U').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="hidden sm:block">
                    <div className="text-sm font-medium text-text">{user?.fullName || 'User'}</div>
                    <div className="text-xs text-muted">{user?.email?.split('@')[0] || 'account'}</div>
                  </div>
                  <Button variant="ghost" onClick={() => { signOut(); navigate('/auth/sign-in'); }}>Sign Out</Button>
                </div>
              </div>
            </div>
          </header>

          <motion.main initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
            <Outlet />
          </motion.main>
        </div>
      </div>
    </div>
  );
}
