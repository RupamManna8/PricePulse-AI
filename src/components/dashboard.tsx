import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, Button, GlassCard, MetricPill, SectionHeader } from './ui';
import type { ApiProductWatchlistGroup } from '../lib/api';
import { formatCurrency } from '../lib/currency';
import type { AlertItem, TimelineEvent, WatchlistItem } from '../lib/liveData';

type ProductWatchRow = {
  id: string;
  productKey: string;
  name: string;
  competitor: string;
  previousPrice: number;
  currentPrice: number;
  difference: number;
  rating: number;
  lastUpdated: string;
  actionProductId: string;
};

type CompetitorWatchRow = {
  id: string;
  productKey: string;
  productId: string;
  competitor: string;
  yourPrice: number;
  competitorPrice: number;
  difference: number;
  ratingPosition: 'Leading' | 'At Risk' | 'Lagging';
  threatLevel: 'Low' | 'Medium' | 'High';
  lastUpdated: string;
  rating: number;
};

function toCurrency(value: number) {
  return formatCurrency(value);
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Now';
  }

  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function buildProductRows(items: WatchlistItem[], groups: ApiProductWatchlistGroup[]): ProductWatchRow[] {
  const groupedRows = groups.map((group) => ({
    id: group.productKey,
    productKey: group.productKey,
    name: group.productName,
    competitor: group.competitors[0]?.competitorName || 'Scraped',
    previousPrice: group.previousPrice,
    currentPrice: group.currentPrice,
    difference: group.difference,
    rating: group.rating,
    lastUpdated: formatDateTime(group.lastUpdatedAt),
    actionProductId: group.primaryProductId || group.competitors[0]?.productId || ''
  }));

  const itemRows = items.map((item) => {
    const previousPrice = item.oldPrice;
    const currentPrice = item.latestPrice;
    const difference = Number((currentPrice - previousPrice).toFixed(2));

    return {
      id: item.id,
      productKey: item.id,
      name: item.name,
      competitor: item.competitor || (item.isCompetitor ? 'Scraped' : 'Own Store'),
      previousPrice: Number(previousPrice.toFixed(2)),
      currentPrice: Number(currentPrice.toFixed(2)),
      difference,
      rating: item.rating,
      lastUpdated: item.updatedAt,
      actionProductId: item.id
    };
  });

  const rowsByKey = new Map<string, ProductWatchRow>();
  groupedRows.forEach((row) => rowsByKey.set(row.id, row));
  itemRows.forEach((row) => rowsByKey.set(row.id, row));

  return Array.from(rowsByKey.values());
}

function buildCompetitorRows(items: WatchlistItem[]): CompetitorWatchRow[] {
  console.log(items)
  return items.filter((item) => Boolean(item.isCompetitor)).map((item) => {
    const pricingSignal = ((item.sentiment - 55) / 100) * 6 - item.change24h * 0.2;
    const yourPrice = Math.max(0.01, item.latestPrice + pricingSignal);
    const competitorPrice = item.latestPrice;
    const difference = Number((yourPrice - competitorPrice).toFixed(2));
    const ratingPosition: CompetitorWatchRow['ratingPosition'] = item.rating >= 4.4 ? 'Leading' : item.rating >= 4 ? 'At Risk' : 'Lagging';
    const threatLevel: CompetitorWatchRow['threatLevel'] = difference >= 3 || item.availability.toLowerCase().includes('in stock') && item.sentiment < 45
      ? 'High'
      : difference >= 1
        ? 'Medium'
        : 'Low';

    return {
      id: item.id,
      productKey: item.id,
      productId: item.id,
      competitor: item.competitor,
      yourPrice: Number(yourPrice.toFixed(2)),
      competitorPrice: Number(competitorPrice.toFixed(2)),
      difference,
      ratingPosition,
      threatLevel,
      lastUpdated: item.updatedAt,
      rating: item.rating
    };
  });
}

function buildCompetitorRowsFromGroups(groups: ApiProductWatchlistGroup[]): CompetitorWatchRow[] {
  console.log("groups", groups);
  return groups.flatMap((group) => group.competitors.map((entry) => ({
    id: entry.id,
    productKey: group.productKey,
    productId: entry.productId,
    competitor: entry.competitorName,
    yourPrice: entry.yourPrice,
    competitorPrice: entry.competitorPrice,
    difference: entry.difference,
    ratingPosition: entry.ratingPosition,
    threatLevel: entry.threatLevel,
    lastUpdated: formatDateTime(entry.lastUpdatedAt),
    rating: entry.rating
  })));
}

export function IntelligenceRibbon({ items = [] }: { items?: string[] }) {
  return (
    <GlassCard className="px-0 py-0 overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="h-2.5 w-2.5 rounded-full bg-primary shadow-glow" />
        <div>
          <div className="text-sm font-medium text-text">Live Intelligence Ribbon</div>
          <div className="text-xs text-muted">Subtle streaming signal feed</div>
        </div>
      </div>
      <div className="overflow-hidden px-5 py-4">
        <div className="flex w-[200%] gap-8 whitespace-nowrap animate-marquee">
          {items.length ? [...items, ...items].map((item, index) => (
            <div key={`${item}-${index}`} className="rounded-full border border-border bg-white/5 px-4 py-2 text-sm text-slate-200">
              {item}
            </div>
          )) : <div className="rounded-full border border-border bg-white/5 px-4 py-2 text-sm text-slate-200">Connect a tracked product to populate live signals.</div>}
        </div>
      </div>
    </GlassCard>
  );
}

export function MetricStrip({ items = [], alerts = [] }: { items?: WatchlistItem[]; alerts?: AlertItem[] }) {
  const rows = buildCompetitorRows(items);
  const now = Date.now();
  const competitorsMonitored = new Set(items.map((item) => item.competitor)).size;
  const criticalAlertsToday = alerts.filter((alert) => alert.tone === 'danger').length;
  const productsLosingPricePosition = rows.filter((row) => row.difference > 0).length;
  const productsUpdatedRecently = items.filter((item) => {
    const updated = new Date(item.updatedAtIso).getTime();
    return Number.isFinite(updated) && (now - updated) <= 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <MetricPill label="Total Products Tracked" value={String(items.length)} tone="default" />
      <MetricPill label="Critical Alerts Today" value={String(criticalAlertsToday)} tone="danger" />
      <MetricPill label="Products Losing Price Position" value={String(productsLosingPricePosition)} tone="warning" />
      <MetricPill label="Competitors Monitored" value={String(competitorsMonitored)} tone="default" />
      <MetricPill label="Products Updated Recently" value={String(productsUpdatedRecently)} tone="success" />
    </div>
  );
}

export function AlertsFeed({ alerts = [], events = [] }: { alerts?: AlertItem[]; events?: TimelineEvent[] }) {
  const derivedFromEvents = events.map((event) => ({ title: event.label, detail: event.detail, tone: event.tone, time: event.when }));
  const stream = [...alerts, ...derivedFromEvents].slice(0, 12);

  return (
    <GlassCard>
      <SectionHeader eyebrow="Live feed" title="Alerts feed" description="Scrollable portfolio feed of price, stock, review, and category movement." />
      <div className="mt-5 max-h-[24rem] space-y-3 overflow-auto pr-1">
        {stream.length ? stream.map((alert, index) => (
          <div key={`${alert.title}-${index}`} className="rounded-2xl border border-border/70 bg-white/4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-text">{alert.title}</div>
                <div className="mt-1 text-sm leading-6 text-slate-300">{alert.detail}</div>
              </div>
              <Badge tone={alert.tone}>{alert.time}</Badge>
            </div>
          </div>
        )) : <div className="rounded-2xl border border-border/70 bg-white/4 p-4 text-sm text-slate-300">Alerts feed activates when products and competitors start moving.</div>}
      </div>
    </GlassCard>
  );
}

export function WatchlistTable({ items = [], groups = [] }: { items?: WatchlistItem[]; groups?: ApiProductWatchlistGroup[] }) {
  const navigate = useNavigate();
  const productRows = buildProductRows(items, groups);
  const competitorRows = groups.length ? buildCompetitorRowsFromGroups(groups) : buildCompetitorRows(items);

  const [selectedProductId, setSelectedProductId] = useState<string | null>(productRows[0]?.id ?? null);

  useEffect(() => {
    if (!productRows.length) {
      setSelectedProductId(null);
      return;
    }

    if (!selectedProductId || !productRows.some((row) => row.id === selectedProductId)) {
      setSelectedProductId(productRows[0].id);
    }
  }, [productRows, selectedProductId]);

  const activeProductId = selectedProductId;
  const activeProduct = productRows.find((row) => row.id === activeProductId) ?? null;
  const activeCompetitorRows = competitorRows.filter((row) => row.productKey === activeProductId);
  const priceBars = activeCompetitorRows.length
    ? [
        { name: 'Your Store', price: activeCompetitorRows[0].yourPrice, color: '#17C964' },
        ...activeCompetitorRows.map((row) => ({ name: row.competitor, price: row.competitorPrice, color: '#5B8CFF' }))
      ]
    : [];

  return (
    <div className="space-y-6">
      <GlassCard>
        <SectionHeader eyebrow="Main watchlist" title="Product watchlist" description="Primary product pricing watchlist." />
        <div className="mt-5 overflow-hidden rounded-2xl border border-border">
          <div className="grid grid-cols-[1.3fr_1.3fr_1fr_1fr_1fr_0.8fr_1fr_0.8fr] gap-3 border-b border-border bg-white/5 px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-muted">
            <div>Product Name</div>
            <div>Competitor Name</div>
            <div>Previous Price</div>
            <div>Current Price</div>
            <div>Difference</div>
            <div>Rating</div>
            <div>Last Updated</div>
            <div>Action</div>
          </div>
          {productRows.length ? productRows.map((row) => (
            <div
              key={row.id}
              className={`grid cursor-pointer grid-cols-[1.3fr_1.3fr_1fr_1fr_1fr_0.8fr_1fr_0.8fr] gap-3 border-b border-border/60 px-4 py-4 transition last:border-none ${row.id === activeProductId ? 'bg-white/8' : 'hover:bg-white/4'}`}
              onClick={() => setSelectedProductId(row.id)}
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-text">{row.name}</div>
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm text-muted">{row.competitor}</div>
              </div>
              <div className="text-sm text-text">{toCurrency(row.previousPrice)}</div>
              <div className="text-sm font-medium text-text">{toCurrency(row.currentPrice)}</div>
              <div className={`text-sm font-medium ${row.difference > 0 ? 'text-danger' : row.difference < 0 ? 'text-success' : 'text-muted'}`}>
                {row.difference > 0 ? '+' : ''}
                {toCurrency(row.difference)}
              </div>
              <div className="text-sm text-text">{row.rating.toFixed(1)}</div>
              <div className="text-sm text-muted">{row.lastUpdated}</div>
              <div>
                <Button variant="ghost" type="button" onClick={() => navigate(`/products/${row.actionProductId || row.id}`)}>Open</Button>
              </div>
            </div>
          )) : <div className="px-4 py-10 text-center text-sm text-slate-300">No tracked products yet. Add a live URL in Trackers to populate this table.</div>}
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader
          eyebrow="Main watchlist"
          title="Competitor watchlist"
          description={activeProduct ? `Based on ${activeProduct.name}` : 'Competitor pricing relative to your selected product.'}
        />
        <div className="mt-4 max-w-lg">
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-muted">Product selection</div>
          <select
            value={activeProductId ?? ''}
            onChange={(event) => setSelectedProductId(event.target.value || null)}
            className="w-full rounded-xl border border-border bg-black/20 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
          >
            {productRows.length ? productRows.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            )) : <option value="">No products available</option>}
          </select>
        </div>
        <div className="mt-5 overflow-hidden rounded-2xl border border-border">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1fr_1fr_0.8fr] gap-3 border-b border-border bg-white/5 px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-muted">
            <div>Competitor Name</div>
            <div>Your Price</div>
            <div>Competitor Price</div>
            <div>Difference</div>
            <div>Rating Position</div>
            <div>Threat Level</div>
            <div>Last Updated</div>
            <div>Action</div>
          </div>
          {activeCompetitorRows.length ? (
            activeCompetitorRows.map((row) => (
              <div key={row.id} className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1fr_1fr_0.8fr] gap-3 border-b border-border/60 px-4 py-4 transition last:border-none">
                <div className="min-w-0">
                  <div className="truncate font-medium text-text">{row.competitor}</div>
                </div>
                <div className="text-sm font-medium text-text">{toCurrency(row.yourPrice)}</div>
                <div className="text-sm text-text">{toCurrency(row.competitorPrice)}</div>
                <div className={`text-sm font-medium ${row.difference > 0 ? 'text-danger' : 'text-success'}`}>
                  {row.difference > 0 ? '+' : ''}
                  {toCurrency(row.difference)}
                </div>
                <div><Badge tone={row.ratingPosition === 'Leading' ? 'success' : row.ratingPosition === 'At Risk' ? 'warning' : 'danger'}>{row.ratingPosition}</Badge></div>
                <div><Badge tone={row.threatLevel === 'High' ? 'danger' : row.threatLevel === 'Medium' ? 'warning' : 'success'}>{row.threatLevel}</Badge></div>
                <div className="text-sm text-muted">{row.lastUpdated}</div>
                <div>
                  <Button variant="ghost" type="button" onClick={() => navigate(`/products/${row.productId}`)}>Open</Button>
                </div>
              </div>
            ))
          ) : <div className="px-4 py-10 text-center text-sm text-slate-300">Select a product to view competitor pricing context.</div>}
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-white/4 p-4">
          <div className="mb-3 text-xs uppercase tracking-[0.22em] text-muted">Competitor price comparison</div>
          {priceBars.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={priceBars}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'rgba(9, 11, 15, 0.96)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, color: '#F8FAFC' }} />
                <Bar dataKey="price" radius={[10, 10, 0, 0]}>
                  {priceBars.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="py-12 text-center text-sm text-slate-300">Price chart will appear once competitor pricing is available.</div>}
        </div>
      </GlassCard>
    </div>
  );
}
