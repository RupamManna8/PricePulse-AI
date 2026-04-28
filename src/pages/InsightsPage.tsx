import { useEffect, useMemo, useState } from 'react';
import { GlassCard, SectionHeader, Button, Badge } from '../components/ui';
import { RatingTrendChart, SentimentPieChart } from '../components/charts';
import { ApiProduct, analyzeReviewList, fetchProductReviews, fetchProducts, predictPrice, scrapeProduct } from '../lib/api';
import { formatCurrency } from '../lib/currency';
import { buildCompetitorComparison, buildCurrencyComparison, buildRatingTrend, buildSentimentBreakdown, buildSummaryReport, buildDiscountWarSignals } from '../lib/liveData';
import { toCsv, toTsv, triggerDownload } from '../lib/download';
import { applyProductOverrides } from '../lib/productOverrides';

function toLookupKey(value: string) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function InsightsPage() {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [aiSummary, setAiSummary] = useState<{ sentiment: string; average_score: number; common_complaints: string[]; top_praised_features: string[] } | null>(null);
  const [priceForecast, setPriceForecast] = useState<{ next_week_price: number; discount_probability: number; trend: string } | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analyzedReviewCount, setAnalyzedReviewCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      try {
        const data = await fetchProducts();
        const productData = applyProductOverrides(data);
        if (active) {
          setProducts(productData);
          if (!selectedProductId && productData.length) {
            setSelectedProductId(productData[0].id);
          }
        }
      } catch {
        if (active) {
          setProducts([]);
          setSelectedProductId('');
        }
      }
    }

    void loadProducts();
    return () => {
      active = false;
    };
  }, []);

  const selectedProduct = useMemo(() => {
    if (!products.length) {
      return null;
    }

    return products.find((product) => product.id === selectedProductId) || products[0];
  }, [products, selectedProductId]);

  useEffect(() => {
    if (!products.length) {
      setSelectedProductId('');
      return;
    }

    if (!selectedProductId || !products.some((product) => product.id === selectedProductId)) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  const scopedProducts = useMemo(() => {
    if (!selectedProduct) {
      return [] as ApiProduct[];
    }

    const key = toLookupKey(selectedProduct.name);
    const related = products.filter((product) => toLookupKey(product.name) === key);
    return related.length ? related : [selectedProduct];
  }, [products, selectedProduct]);

  useEffect(() => {
    let active = true;

    async function loadSelectedProductInsights() {
      if (!selectedProduct) {
        if (active) {
          setAiSummary(null);
          setPriceForecast(null);
          setAnalysisLoading(false);
          setAnalyzedReviewCount(0);
        }
        return;
      }

      setAnalysisLoading(true);

      try {
        const scopedReviewGroups = await Promise.all(
          scopedProducts.map(async (product) => {
            const reviewsFromDb = await fetchProductReviews(product.id).catch(() => []);
            const mappedDbReviews = reviewsFromDb.map((review) => ({
              text: review.text || '',
              stars: Number(review.stars) || 0,
              reviewer: review.reviewer || 'Anonymous',
              date: review.date || 'Unknown date',
              sentiment: review.sentiment || undefined
            }));

            if (mappedDbReviews.length) {
              return mappedDbReviews;
            }

            const scrapeInput = product.url && product.url.startsWith('http') ? product.url : '';
            if (!scrapeInput) {
              return [];
            }

            const scrapeData = await scrapeProduct(scrapeInput).catch(() => null);
            return (scrapeData?.reviews ?? []).map((review) => ({
              text: review.text || '',
              stars: Number(review.stars) || 0,
              reviewer: review.reviewer || 'Anonymous',
              date: review.date || 'Unknown date',
              sentiment: review.sentiment || undefined
            }));
          })
        );

        const analysisSource = scopedReviewGroups
          .flat()
          .filter((review) => Boolean(review.text?.trim()));

        const uniqueReviews = Array.from(
          new Map(
            analysisSource.map((review) => [
              `${review.text.trim()}|${review.reviewer}|${review.date}`,
              review
            ])
          ).values()
        );

        const reviewAnalysis = uniqueReviews.length ? await analyzeReviewList(uniqueReviews).catch(() => null) : null;
        const priceHistoryInput = [
          { price: selectedProduct.oldPrice > 0 ? selectedProduct.oldPrice : Math.max(1, selectedProduct.latestPrice * 1.08) },
          { price: selectedProduct.latestPrice }
        ];
        const predictionData = await predictPrice(priceHistoryInput).catch(() => null);

        if (active) {
          setAiSummary(reviewAnalysis);
          setPriceForecast(predictionData);
          setAnalyzedReviewCount(uniqueReviews.length);
        }
      } catch {
        if (active) {
          setAiSummary(null);
          setPriceForecast(null);
          setAnalyzedReviewCount(0);
        }
      } finally {
        if (active) {
          setAnalysisLoading(false);
        }
      }
    }

    void loadSelectedProductInsights();

    return () => {
      active = false;
    };
  }, [selectedProduct, scopedProducts]);

  const competitiveRows = useMemo(() => buildCompetitorComparison(scopedProducts), [scopedProducts]);
  const sentimentData = useMemo(() => buildSentimentBreakdown(scopedProducts), [scopedProducts]);
  const ratingData = useMemo(() => buildRatingTrend(scopedProducts), [scopedProducts]);
  const currencyComparison = useMemo(() => buildCurrencyComparison(scopedProducts), [scopedProducts]);
  const summaryReport = useMemo(() => buildSummaryReport(scopedProducts), [scopedProducts]);
  const discountWarSignals = useMemo(() => buildDiscountWarSignals(scopedProducts), [scopedProducts]);

  function exportCsv() {
    const rows = competitiveRows.map((item) => ({
      competitor: item.name,
      price: item.price,
      reviews: item.reviews,
      sentiment: aiSummary?.sentiment ?? 'Neutral',
      next_week_price: priceForecast?.next_week_price ?? 84.7,
      discount_probability: priceForecast ? Math.round(priceForecast.discount_probability * 100) : 42
    }));
    triggerDownload('pricepulse-ai-report.csv', toCsv(rows));
  }

  function exportExcel() {
    const rows = competitiveRows.map((item) => ({
      competitor: item.name,
      price: item.price,
      reviews: item.reviews,
      sentiment: aiSummary?.sentiment ?? 'Neutral',
      next_week_price: priceForecast?.next_week_price ?? 84.7,
      discount_probability: priceForecast ? Math.round(priceForecast.discount_probability * 100) : 42
    }));
    triggerDownload('pricepulse-ai-report.xls', toTsv(rows), 'application/vnd.ms-excel;charset=utf-8;');
  }

  function exportPdf() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-muted">Insights</div>
            <h1 className="mt-2 text-3xl font-semibold text-text">AI reports and export center</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">A premium reporting surface for pricing, sentiment, and competitor movement analysis per selected product.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedProduct?.id || ''}
              onChange={(event) => setSelectedProductId(event.target.value)}
              className="min-w-[18rem] rounded-xl border border-border bg-black/20 px-4 py-2.5 text-sm text-text outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
            >
              {products.length ? products.map((product) => (
                <option key={product.id} value={product.id}>{product.name} • {product.competitor}</option>
              )) : <option value="">No products available</option>}
            </select>
            <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
            <Button variant="primary" onClick={exportExcel}>Export Excel</Button>
            <Button variant="ghost" onClick={exportPdf}>Export PDF</Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone="default">Scope: {selectedProduct ? `${selectedProduct.name} (${selectedProduct.competitor})` : 'No product selected'}</Badge>
          <Badge tone={analysisLoading ? 'warning' : 'success'}>{analysisLoading ? 'Analyzing reviews...' : 'Python sentiment API ready'}</Badge>
          <Badge tone="default">Reviews analyzed: {analyzedReviewCount}</Badge>
        </div>
      </GlassCard>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <GlassCard>
          <SectionHeader eyebrow="Sentiment" title="Customer mood" description="Blend of positive, neutral, and negative review signals." />
          {sentimentData.length ? <SentimentPieChart data={sentimentData} /> : <div className="mt-4 rounded-2xl border border-border bg-white/5 p-6 text-sm text-slate-300">Tracked products will populate the sentiment view.</div>}
        </GlassCard>
        <GlassCard>
          <SectionHeader eyebrow="Trend" title="Rating movement" description="Weekly average rating changes for the tracked category." />
          {ratingData.length ? <RatingTrendChart data={ratingData} /> : <div className="mt-4 rounded-2xl border border-border bg-white/5 p-6 text-sm text-slate-300">Rating data will appear after products are tracked.</div>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="success">Top praised feature: {aiSummary?.top_praised_features?.[0] ?? 'awaiting live reviews'}</Badge>
            <Badge tone="warning">Common complaint: {aiSummary?.common_complaints?.[0] ?? 'awaiting live reviews'}</Badge>
            <Badge tone="danger">{aiSummary?.sentiment === 'Negative' ? 'Review spike detected' : 'Review signal stable'}</Badge>
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <GlassCard>
          <SectionHeader eyebrow="Python NLP" title="Review intelligence summary" description="These signals are generated by the FastAPI /analyze-reviews endpoint." />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted">Overall sentiment</div>
              <div className="mt-2 text-2xl font-semibold text-text">{aiSummary?.sentiment ?? 'No live review data yet'}</div>
              <div className="mt-1 text-sm text-slate-300">Average score: {aiSummary?.average_score?.toFixed?.(3) ?? '0.000'}</div>
            </div>
            <div className="rounded-2xl border border-border bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted">Next complaint cluster</div>
              <div className="mt-2 text-lg font-medium text-text">{aiSummary?.common_complaints?.[0] ?? 'No complaints yet'}</div>
              <div className="mt-1 text-sm text-slate-300">Most positive signal: {aiSummary?.top_praised_features?.[0] ?? 'No praised features yet'}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <SectionHeader eyebrow="Python forecast" title="Price prediction summary" description="The /predict-price endpoint estimates where pricing may move next week." />
          <div className="mt-5 rounded-2xl border border-border bg-black/30 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-muted">Projected next week price</div>
            <div className="mt-2 text-4xl font-semibold text-text">{formatCurrency(priceForecast?.next_week_price ?? 0)}</div>
            <div className="mt-2 text-sm text-success">Discount probability: {Math.round((priceForecast?.discount_probability ?? 0) * 100)}%</div>
            <div className="mt-1 text-sm text-slate-300">Trend: {priceForecast?.trend ?? 'No forecast yet'}</div>
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <SectionHeader eyebrow="Competitive readout" title="Category spread" description="The bar lane below helps map where your price sits against the market." />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {competitiveRows.length ? competitiveRows.map((item) => (
            <div key={item.name} className="rounded-2xl border border-border bg-white/5 p-4">
              <div className="text-sm font-medium text-text">{item.name}</div>
              <div className="mt-2 text-2xl font-semibold">{formatCurrency(item.price)}</div>
              <div className="mt-2 text-xs text-muted">{item.reviews.toLocaleString()} reviews</div>
            </div>
          )) : <div className="text-sm text-slate-300">Add a live product to populate the category spread.</div>}
        </div>
      </GlassCard>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <GlassCard>
          <SectionHeader eyebrow="AI summary" title="Top threats and opportunities" description="A concise board-ready summary for the current competitive set." />
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted">Top threats</div>
              <div className="mt-3 space-y-2 text-sm text-slate-300">{summaryReport.threats.length ? summaryReport.threats.map((item) => <div key={item}>{item}</div>) : <div>No threats yet.</div>}</div>
            </div>
            <div className="rounded-2xl border border-border bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted">Margin opportunities</div>
              <div className="mt-3 space-y-2 text-sm text-slate-300">{summaryReport.opportunities.length ? summaryReport.opportunities.map((item) => <div key={item}>{item}</div>) : <div>No opportunities yet.</div>}</div>
            </div>
            <div className="rounded-2xl border border-border bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted">Weak rivals</div>
              <div className="mt-3 space-y-2 text-sm text-slate-300">{summaryReport.vulnerable.length ? summaryReport.vulnerable.map((item) => <div key={item}>{item}</div>) : <div>No weak rivals yet.</div>}</div>
            </div>
          </div>
        </GlassCard>
        <GlassCard>
          <SectionHeader eyebrow="Market watch" title="Discount war detector" description="Shows when several competitors start cutting price together." />
          <div className="mt-5 space-y-3 rounded-2xl border border-border bg-black/30 p-4 font-mono text-sm text-slate-300">
            {discountWarSignals.map((item) => <div key={item}>{item}</div>)}
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <SectionHeader eyebrow="Global pricing" title="Currency comparison" description="Quickly compare the market across USD, INR, EUR, and GBP." />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {currencyComparison.length ? currencyComparison.map((item) => (
            <div key={item.name} className="rounded-2xl border border-border bg-white/5 p-4">
              <div className="text-sm font-medium text-text">{item.name}</div>
              <div className="mt-2 text-sm text-slate-300">USD {item.usd}</div>
              <div className="text-xs text-muted">INR {item.inr} · EUR {item.eur} · GBP {item.gbp}</div>
            </div>
          )) : <div className="text-sm text-slate-300">Currency comparisons will appear after live products are loaded.</div>}
        </div>
      </GlassCard>
    </div>
  );
}
