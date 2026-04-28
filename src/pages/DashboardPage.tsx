import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertsFeed, IntelligenceRibbon, MetricStrip, WatchlistTable } from '../components/dashboard';
import { LoadingSkeleton } from '../components/ui';
import { ApiProduct, ApiProductWatchlistGroup, fetchProducts, fetchProductWatchlists } from '../lib/api';
import { useLiveRefresh } from '../lib/useLiveRefresh';
import { buildAlerts, buildRibbonItems, buildTimelineEvents, buildWatchlistItems } from '../lib/liveData';
import { applyProductOverrides } from '../lib/productOverrides';

export function DashboardPage() {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [watchlistGroups, setWatchlistGroups] = useState<ApiProductWatchlistGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const [productsData, groupedData] = await Promise.all([fetchProducts(), fetchProductWatchlists()]);
      const mergedProducts = applyProductOverrides(productsData);
      setProducts(mergedProducts);
      setWatchlistGroups(groupedData);
      setLastUpdatedAt(new Date().toISOString());
    } catch {
      setProducts([]);
      setWatchlistGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const { isRefreshing, lastRefreshedAt } = useLiveRefresh(
    async () => {
      await loadDashboard();
    },
    { intervalMs: 20000, immediate: false }
  );

  const dynamicWatchlist = useMemo(() => buildWatchlistItems(products), [products]);
  const alerts = useMemo(() => buildAlerts(products), [products]);
  const ribbonItems = useMemo(() => buildRibbonItems(products), [products]);
  const timelineEvents = useMemo(() => buildTimelineEvents(products), [products]);

  const dashboardHeader = (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white/5 px-4 py-3">
      <div>
        <div className="text-xs uppercase tracking-[0.24em] text-muted">Live sync</div>
        <div className="mt-1 text-sm text-slate-300">
          {isRefreshing ? 'Refreshing market data in the background...' : lastUpdatedAt ? `Last updated ${new Date(lastUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for first sync'}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-success shadow-[0_0_0_6px_rgba(23,201,100,0.12)]" />
        <span className="text-xs uppercase tracking-[0.24em] text-success">{isRefreshing ? 'Updating' : 'Live'}</span>
        {lastRefreshedAt ? <span className="text-xs text-muted">{new Date(lastRefreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> : null}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {dashboardHeader}
        <LoadingSkeleton className="h-[6rem]" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => <LoadingSkeleton key={`metric-${index}`} className="h-28" />)}
        </div>
        <LoadingSkeleton className="h-[30rem]" />
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <LoadingSkeleton className="h-[24rem]" />
          <LoadingSkeleton className="h-[24rem]" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <LoadingSkeleton key={`trend-${index}`} className="h-40" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {dashboardHeader}
      <IntelligenceRibbon items={ribbonItems} />
      <MetricStrip items={dynamicWatchlist} alerts={alerts} />
      <WatchlistTable items={dynamicWatchlist} groups={watchlistGroups} />
      <AlertsFeed alerts={alerts} events={timelineEvents} />
    </div>
  );
}
