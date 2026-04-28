import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CompactSeriesChart } from '../components/charts';
import { Badge, Button, GlassCard, LoadingSkeleton, SectionHeader } from '../components/ui';
import { formatCurrency } from '../lib/currency';
import { ApiProduct, analyzeReviewList, fetchProductById, fetchProductHistory, fetchProductReviews, predictPrice, refreshProduct, scrapeProduct, ScrapeResult } from '../lib/api';
import { buildPriceHistoryDaily, buildPriceHistoryMonthly, buildPriceHistoryWeekly, buildReviewSentimentBreakdown } from '../lib/liveData';
import { applyProductOverride } from '../lib/productOverrides';
import { useLiveRefresh } from '../lib/useLiveRefresh';

type ReviewSummary = {
  sentiment: string;
  average_score: number;
  common_complaints: string[];
  top_praised_features: string[];
};

type PriceForecast = {
  next_week_price: number;
  discount_probability: number;
  trend: string;
};

export function ProductPage() {
  const params = useParams();
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrape, setScrape] = useState<ScrapeResult | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; productId: string; price: number; timestamp: string }>>([]);
  const [reviews, setReviews] = useState<Array<{ id: string; productId: string; text: string; sentiment: string; stars: number; reviewer: string; date: string }>>([]);
  const [analysis, setAnalysis] = useState<ReviewSummary | null>(null);
  const [prediction, setPrediction] = useState<PriceForecast | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [refreshCadence, setRefreshCadence] = useState<'off' | '6h' | '12h' | 'daily'>(() => {
    const stored = window.localStorage.getItem('pricepulse-refresh-cadence');
    return stored === '6h' || stored === '12h' || stored === 'daily' ? stored : 'off';
  });

  useEffect(() => {
    window.localStorage.setItem('pricepulse-refresh-cadence', refreshCadence);
  }, [refreshCadence]);

  const loadProduct = useCallback(async (forceRefresh = false) => {
    if (!params.id) {
      setLoading(false);
      return;
    }

    try {
      const baseProduct = applyProductOverride(await fetchProductById(params.id));
      setProduct(baseProduct);

      const productAfterRefresh = forceRefresh ? applyProductOverride(await refreshProduct(params.id)) : baseProduct;
      const [historyData, reviewData] = await Promise.all([
        fetchProductHistory(params.id).catch(() => []),
        fetchProductReviews(params.id).catch(() => [])
      ]);

      setHistory(historyData);
      setReviews(reviewData);

      if (productAfterRefresh?.url) {
        const scrapeInput = productAfterRefresh.url && productAfterRefresh.url.startsWith('http') ? productAfterRefresh.url : '';
        const scrapeData = scrapeInput ? await scrapeProduct(scrapeInput).catch(() => null) : null;
        const analysisData = reviewData.length ? await analyzeReviewList(reviewData.map((review) => ({ text: review.text, stars: review.stars, reviewer: review.reviewer, date: review.date, sentiment: review.sentiment }))).catch(() => null) : null;
        const predictionData = await predictPrice([
          { price: historyData[0]?.price ?? (productAfterRefresh.oldPrice > 0 ? productAfterRefresh.oldPrice : Math.max(1, productAfterRefresh.latestPrice * 1.08)), timestamp: historyData[0]?.timestamp ?? new Date(Date.now() - 86400000).toISOString() },
          { price: historyData[historyData.length - 1]?.price ?? productAfterRefresh.latestPrice, timestamp: historyData[historyData.length - 1]?.timestamp ?? new Date().toISOString() }
        ]).catch(() => null);

        if (scrapeData) {
          setScrape(scrapeData);
        }
        if (analysisData) {
          setAnalysis(analysisData);
        }
        if (predictionData) {
          setPrediction(predictionData);
        }
      }
      setLastUpdatedAt(new Date().toISOString());
    } catch {
      setProduct(null);
      setHistory([]);
      setReviews([]);
      setScrape(null);
      setAnalysis(null);
      setPrediction(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.id]);

  useEffect(() => {
    let active = true;

    void loadProduct(false).then(() => {
      if (!active) {
        return;
      }
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const { isRefreshing: liveRefreshing, lastRefreshedAt } = useLiveRefresh(
    async () => {
      await loadProduct(true);
    },
    { intervalMs: 45000, immediate: false, enabled: Boolean(params.id) }
  );

  useEffect(() => {
    if (!params.id || refreshCadence === 'off') {
      return;
    }

    const cadenceMs = {
      '6h': 6 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000
    }[refreshCadence];

    const timer = window.setInterval(() => {
      setRefreshing(true);
      void loadProduct(true);
    }, cadenceMs);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, refreshCadence]);

  const displayName = product?.name ?? 'Air Zoom Nova';
  const displayCompetitor = product?.competitor ?? 'Nike';
  const predictedValue = prediction?.next_week_price ?? (product ? Math.max(0, Number((product.latestPrice * (1 - product.discountPct / 100 / 2)).toFixed(2))) : 0);
  const probabilityValue = prediction ? Math.round(prediction.discount_probability * 100) : (product ? Math.max(20, Math.min(95, Math.round(product.discountPct * 7))) : 0);
  const analysisTone = analysis?.sentiment ?? 'No live review data yet';

  const reviewFeed = useMemo(() => reviews.length ? reviews : scrape?.reviews ?? [], [reviews, scrape]);
  const reviewSentimentData = useMemo(() => buildReviewSentimentBreakdown(reviewFeed), [reviewFeed]);
  const dailyHistory = useMemo(() => buildPriceHistoryDaily(history), [history]);
  const weeklyHistory = useMemo(() => buildPriceHistoryWeekly(history), [history]);
  const monthlyHistory = useMemo(() => buildPriceHistoryMonthly(history), [history]);

  const detailHeader = (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white/5 px-4 py-3">
      <div>
        <div className="text-xs uppercase tracking-[0.24em] text-muted">Live sync</div>
        <div className="mt-1 text-sm text-slate-300">
          {liveRefreshing || refreshing ? 'Refreshing product intelligence...' : lastUpdatedAt ? `Last updated ${new Date(lastUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for first sync'}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone="success">{liveRefreshing || refreshing ? 'Syncing' : 'Live'}</Badge>
        {lastRefreshedAt ? <span className="text-xs text-muted">{new Date(lastRefreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> : null}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {detailHeader}
        <GlassCard>
          <LoadingSkeleton className="h-24" />
        </GlassCard>
        <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
          <GlassCard>
            <LoadingSkeleton className="h-[28rem]" />
          </GlassCard>
          <LoadingSkeleton className="h-[28rem]" />
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => <LoadingSkeleton key={`product-chart-${index}`} className="h-72" />)}
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <LoadingSkeleton className="h-[26rem]" />
          <LoadingSkeleton className="h-[26rem]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {detailHeader}
      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-muted">Product details</div>
            {loading ? <LoadingSkeleton className="mt-2 h-8 w-56" /> : <h1 className="mt-2 text-3xl font-semibold text-text">{displayName}</h1>}
            <div className="mt-2 text-sm text-slate-300">Product id: {params.id ?? 'prod-1'} · {displayCompetitor} intelligence and review detail.</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="success">Active watch</Badge>
            <Button variant="outline" type="button" onClick={() => { setRefreshing(true); void loadProduct(true); }} disabled={refreshing || liveRefreshing}>{refreshing || liveRefreshing ? 'Refreshing...' : 'Refresh scrape'}</Button>
            <select value={refreshCadence} onChange={(event) => setRefreshCadence(event.target.value as 'off' | '6h' | '12h' | 'daily')} className="rounded-xl border border-border bg-black/20 px-4 py-2 text-sm text-text outline-none">
              <option value="off">Auto refresh off</option>
              <option value="6h">Every 6h</option>
              <option value="12h">Every 12h</option>
              <option value="daily">Daily</option>
            </select>
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <GlassCard>
          <SectionHeader eyebrow="Live scrape" title="Python scraping result" description="This panel is powered by the FastAPI + Playwright service and the tracked product URL." />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted">Scraped title</div>
              <div className="mt-2 text-lg font-medium text-text">{scrape?.title || displayName}</div>
            </div>
            <div className="rounded-2xl border border-border bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted">Scraped price</div>
              <div className="mt-2 text-lg font-medium text-text">{scrape?.price || formatCurrency(product?.latestPrice ?? 0, product?.currency)}</div>
            </div>
            <div className="rounded-2xl border border-border bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted">Availability</div>
              <div className="mt-2 text-lg font-medium text-text">{scrape?.stock_status || scrape?.availability || product?.availability || 'In stock'}</div>
            </div>
            <div className="rounded-2xl border border-border bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted">Category</div>
              <div className="mt-2 text-lg font-medium text-text">{scrape?.category || product?.category || 'General'}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <SectionHeader eyebrow="AI readout" title="Python intelligence summary" description="Review NLP and next-price prediction are computed by the FastAPI service." />
          <div className="mt-5 space-y-4 rounded-2xl border border-border bg-black/30 p-5">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-muted">Sentiment</div>
              <div className="mt-2 text-2xl font-semibold text-text">{analysisTone}</div>
              <div className="text-sm text-slate-300">Average score: {analysis?.average_score?.toFixed?.(3) ?? '0.000'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-muted">Next week price</div>
              <div className="mt-2 text-2xl font-semibold text-text">{formatCurrency(predictedValue, product?.currency)}</div>
              <div className="text-sm text-success">Discount probability: {probabilityValue}%</div>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <GlassCard>
          <SectionHeader eyebrow="History" title="Daily chart" description="Latest price points grouped by day." />
          {dailyHistory.length ? <CompactSeriesChart data={dailyHistory} xKey="label" yKey="average" stroke="#5B8CFF" /> : <div className="mt-4 rounded-2xl border border-border bg-white/5 p-6 text-sm text-slate-300">Track a product to generate live pricing history.</div>}
        </GlassCard>
        <GlassCard>
          <SectionHeader eyebrow="History" title="Weekly trend" description="Smoothed week-over-week movement." />
          {weeklyHistory.length ? <CompactSeriesChart data={weeklyHistory} xKey="week" yKey="price" stroke="#17C964" /> : <div className="mt-4 rounded-2xl border border-border bg-white/5 p-6 text-sm text-slate-300">Weekly trend will appear once multiple price snapshots exist.</div>}
        </GlassCard>
        <GlassCard>
          <SectionHeader eyebrow="History" title="Monthly average" description="Longer-range average price by month." />
          {monthlyHistory.length ? <CompactSeriesChart data={monthlyHistory} xKey="month" yKey="price" stroke="#F5A524" /> : <div className="mt-4 rounded-2xl border border-border bg-white/5 p-6 text-sm text-slate-300">Monthly averages populate after repeated scrapes.</div>}
        </GlassCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <GlassCard>
          <SectionHeader eyebrow="Ratings" title="Review intelligence" description="Breakdown of sentiment and weekly rating trend." />
          {reviewSentimentData.length ? <CompactSeriesChart data={reviewSentimentData.map((item) => ({ name: item.name, value: item.value }))} xKey="name" yKey="value" stroke="#FF5D73" /> : <div className="mt-4 rounded-2xl border border-border bg-white/5 p-6 text-sm text-slate-300">Scrape reviews to populate live sentiment.</div>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="success">Top praised feature: {analysis?.top_praised_features?.[0] ?? 'awaiting live reviews'}</Badge>
            <Badge tone="warning">Common complaint: {analysis?.common_complaints?.[0] ?? 'awaiting live reviews'}</Badge>
            <Badge tone="danger">{analysis?.sentiment === 'Negative' ? 'Review spike detected' : 'Review signal stable'}</Badge>
          </div>
        </GlassCard>

        <GlassCard>
          <SectionHeader eyebrow="Snapshot" title="Price and review summary" description="The latest refresh and review counts in one place." />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted">Last scraped</div>
              <div className="mt-2 text-lg font-medium text-text">{product?.lastScrapedAt ? new Date(product.lastScrapedAt).toLocaleString() : 'Not yet scraped'}</div>
            </div>
            <div className="rounded-2xl border border-border bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted">Review count</div>
              <div className="mt-2 text-lg font-medium text-text">{reviews.length.toLocaleString()} reviews</div>
            </div>
            <div className="rounded-2xl border border-border bg-white/5 p-4 md:col-span-2">
              <div className="text-xs uppercase tracking-[0.24em] text-muted">Currency comparison</div>
              <div className="mt-2 text-sm text-slate-300">{product?.currency ?? 'INR'} base pricing stays visible across global currencies in Insights.</div>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <GlassCard>
          <SectionHeader eyebrow="NLP feed" title="Recent reviews" description="Scraped review examples with sentiment tagging and timestamps." />
          <div className="mt-5 space-y-4">
            {reviewFeed.length ? reviewFeed.map((review) => (
              <div key={`${review.reviewer}-${review.date}`} className="rounded-2xl border border-border bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-text">{review.reviewer}</div>
                  <div className="text-xs text-muted">{review.date}</div>
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-300">{review.text}</div>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                  <Badge tone={review.sentiment === 'Positive' ? 'success' : review.sentiment === 'Negative' ? 'danger' : 'warning'}>{review.sentiment}</Badge>
                  <span>{review.stars} stars</span>
                </div>
              </div>
            )) : <div className="rounded-2xl border border-border bg-white/5 p-4 text-sm text-slate-300">No live reviews yet. Run a scrape on a tracked product to populate this feed.</div>}
          </div>
        </GlassCard>
        <GlassCard>
          <SectionHeader eyebrow="Prediction" title="Next move estimate" description="Historical prices feed a simple linear projection for the next week." />
          <div className="mt-5 rounded-2xl border border-border bg-black/30 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-muted">Likely next week price</div>
            <div className="mt-2 text-4xl font-semibold text-text">{formatCurrency(predictedValue, product?.currency)}</div>
            <div className="mt-2 text-sm text-success">Discount probability: {probabilityValue}%</div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
