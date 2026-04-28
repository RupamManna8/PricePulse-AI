import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, GlassCard } from '../components/ui';
import { ApiProduct, fetchDashboardStats, fetchProducts } from '../lib/api';
import { formatCurrency } from '../lib/currency';
import { buildDashboardStats } from '../lib/liveData';

const features = [
  'Live price monitoring',
  'Review sentiment intelligence',
  'Trend prediction',
  'Automated alerts',
  'Export-ready reports'
];

export function LandingPage() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [stats, setStats] = useState(buildDashboardStats([]));

  useEffect(() => {
    let active = true;

    async function loadLiveSummary() {
      try {
        const [statsData, productsData] = await Promise.all([fetchDashboardStats(), fetchProducts()]);
        if (!active) {
          return;
        }
        setStats(statsData);
        setProducts(productsData);
      } catch {
        if (!active) {
          return;
        }
        setStats(buildDashboardStats([]));
        setProducts([]);
      }
    }

    if (isSignedIn) {
      void loadLiveSummary();
    }
    return () => {
      active = false;
    };
  }, [isSignedIn]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-10">
      <div className="overflow-hidden rounded-[2rem] border border-border bg-[radial-gradient(circle_at_top_left,rgba(91,140,255,0.18),transparent_35%),linear-gradient(180deg,rgba(17,21,27,0.95),rgba(11,13,16,0.94))] p-6 shadow-soft md:p-10">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-sm font-semibold text-primary">PP</div>
            <div>
              <div className="text-lg font-semibold">PricePulse AI</div>
              <div className="text-sm text-muted">Track competitor pricing. Predict trends. Win faster.</div>
            </div>
          </div>
          <Badge tone="success">Neo Commerce Intelligence</Badge>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="max-w-2xl space-y-6">
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="text-5xl font-semibold tracking-tight text-text md:text-7xl">
              Outprice competitors before they move.
            </motion.h1>
            <p className="max-w-xl text-lg leading-8 text-slate-300">
              Live pricing intelligence for modern commerce teams. Track market shifts, catch sentiment drops early, and make sharper pricing decisions from one premium command center.
            </p>
            <div className="flex flex-wrap gap-3">
              {isSignedIn ? (
                <>
                  <Button variant="primary" onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
                  <Button variant="outline" onClick={() => navigate('/trackers')}>Add Competitors</Button>
                </>
              ) : (
                <>
                  <Button variant="primary" onClick={() => navigate('/auth/sign-up')}>Get Started Free</Button>
                  <Button variant="outline" onClick={() => navigate('/auth/sign-in')}>Sign In</Button>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {features.map((feature) => (
                <span key={feature} className="rounded-full border border-border bg-white/5 px-3 py-2 text-sm text-slate-300">
                  {feature}
                </span>
              ))}
            </div>
          </div>
          <div>
            <GlassCard className="relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(91,140,255,0.22),transparent_35%)]" />
              <div className="relative space-y-4">
                <div className="flex items-center justify-between">
                  <Badge tone="success">{products.length} live products tracked</Badge>
                  <span className="text-xs text-muted">Updated just now</span>
                </div>
                <div className="rounded-2xl border border-border bg-black/30 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-muted">Pricing pulse</div>
                  <div className="mt-3 text-3xl font-semibold text-text">{formatCurrency(stats.averageCompetitorPrice)}</div>
                  <div className="mt-2 text-sm text-success">{stats.totalTrackedCompetitors} tracked competitors live</div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <GlassCard>
                    <div className="text-xs uppercase tracking-[0.24em] text-muted">Sentiment</div>
                    <div className="mt-2 text-2xl font-semibold text-success">{stats.averageReviewSentiment}%</div>
                  </GlassCard>
                  <GlassCard>
                    <div className="text-xs uppercase tracking-[0.24em] text-muted">Price Shifts</div>
                    <div className="mt-2 text-2xl font-semibold text-warning">{formatCurrency(stats.biggestPriceDropToday)}</div>
                  </GlassCard>
                  <GlassCard>
                    <div className="text-xs uppercase tracking-[0.24em] text-muted">Categories</div>
                    <div className="mt-2 text-2xl font-semibold text-text">{stats.trendingCategories.length}</div>
                  </GlassCard>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        <GlassCard>
          <div className="text-xs uppercase tracking-[0.24em] text-muted">Competitive Intelligence</div>
          <div className="mt-3 text-xl font-semibold">Built for commerce teams who need market insights, not guesswork.</div>
        </GlassCard>
        <GlassCard>
          <div className="text-xs uppercase tracking-[0.24em] text-muted">Enterprise Ready</div>
          <div className="mt-3 text-xl font-semibold">Vercel, Render, and Railway deployments. Multi-user & secure.</div>
        </GlassCard>
        <GlassCard>
          <div className="text-xs uppercase tracking-[0.24em] text-muted">Intelligent Engine</div>
          <div className="mt-3 text-xl font-semibold">Advanced analytics, forecasting, and market automation in one platform.</div>
        </GlassCard>
      </div>
    </div>
  );
}
