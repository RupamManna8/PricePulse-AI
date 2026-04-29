import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ApiProduct, fetchProducts, scrapeProduct, ScrapeResult, trackProduct } from '../lib/api';
import { Badge, Button, GlassCard, Input, LoadingSkeleton, SectionHeader } from '../components/ui';
import { applyProductOverrides } from '../lib/productOverrides';

type TrackerForm = {
  productUrl: string;
  companyName: string;
  category: string;
};

type ProgressState = {
  value: number;
  status: 'idle' | 'extracting' | 'tracking' | 'making' | 'done' | 'error';
  label: string;
};

function normalizeUrl(url: string) {
  const value = url.trim();
  if (!value) {
    return '';
  }

  return value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`;
}

export function TrackersPage() {
  const [form, setForm] = useState<TrackerForm>({ productUrl: '', companyName: '', category: '' });
  const [extracting, setExtracting] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [makingCompetitor, setMakingCompetitor] = useState(false);
  const [productsLoading, setProductsLoading] = useState(true);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [selectedOwnProductId, setSelectedOwnProductId] = useState('');
  const [extracted, setExtracted] = useState<ScrapeResult | null>(null);
  const [progress, setProgress] = useState<ProgressState>({ value: 0, status: 'idle', label: 'Ready' });
  const [feedback, setFeedback] = useState<{ tone: 'default' | 'success' | 'warning' | 'danger'; message: string } | null>(null);

  const extractingRef = useRef(false);
  const trackingRef = useRef(false);
  const makingRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function loadRecentProducts() {
      try {
        const data = await fetchProducts();
        if (active) {
          setProducts(applyProductOverrides(data));
        }
      } catch {
        if (active) {
          setProducts([]);
        }
      } finally {
        if (active) {
          setProductsLoading(false);
        }
      }
    }

    void loadRecentProducts();
    return () => {
      active = false;
    };
  }, []);

  const recentItems = useMemo(() => {
    return products.slice(0, 4).map((product) => ({
      id: product.id,
      name: product.name,
      competitor: product.competitor,
      category: product.category,
      availability: product.availability,
      latestPrice: product.latestPrice,
      oldPrice: product.oldPrice,
      currency: product.currency || 'INR'
    }));
  }, [products]);

  const ownProducts = useMemo(
    () => products.filter((product) => !product.isCompetitor),
    [products]
  );

  const selectedOwnProduct = useMemo(
    () => ownProducts.find((product) => product.id === selectedOwnProductId) || ownProducts[0] || null,
    [ownProducts, selectedOwnProductId]
  );

  useEffect(() => {
    if (!ownProducts.length) {
      setSelectedOwnProductId('');
      return;
    }

    if (!selectedOwnProductId || !ownProducts.some((product) => product.id === selectedOwnProductId)) {
      setSelectedOwnProductId(ownProducts[0].id);
    }
  }, [ownProducts, selectedOwnProductId]);

  function setProgressCheckpoint(value: number, status: ProgressState['status'], label: string) {
    setProgress({
      value: Math.max(0, Math.min(100, value)),
      status,
      label
    });
  }

  function finishProgress(success: boolean, label: string) {
    setProgress({ value: 100, status: success ? 'done' : 'error', label });
  }

  async function handleExtractDetails() {
    if (extractingRef.current || trackingRef.current || makingRef.current) {
      return;
    }

    const normalizedUrl = normalizeUrl(form.productUrl);
    if (!normalizedUrl) {
      setFeedback({ tone: 'warning', message: 'Product URL is required.' });
      return;
    }

    if (!form.companyName.trim()) {
      setFeedback({ tone: 'warning', message: 'Company name is required.' });
      return;
    }

    extractingRef.current = true;
    setExtracting(true);
    setFeedback(null);
    setProgressCheckpoint(12, 'extracting', 'Validating extraction payload');

    try {
      setProgressCheckpoint(34, 'extracting', 'Sending request to scraper');
      const result = await scrapeProduct(normalizedUrl);
      setProgressCheckpoint(76, 'extracting', 'Processing extracted response');
      setExtracted(result);
      setProgressCheckpoint(92, 'extracting', 'Preparing extracted preview');
      finishProgress(true, 'Extraction complete');
      setFeedback({ tone: 'success', message: 'Details extracted. Choose Track Product or Make Competitor.' });
    } catch (error: unknown) {
      if (error instanceof Error) {
        finishProgress(false, 'Extraction failed');
        setFeedback({ tone: 'danger', message: `Extraction failed: ${error.message}` });
      } else {
        finishProgress(false, 'Extraction failed');
        setFeedback({ tone: 'danger', message: 'Extraction failed unexpectedly.' });
      }
    } finally {
      extractingRef.current = false;
      setExtracting(false);
    }
  }

  async function submitTrackedProduct(mode: 'track' | 'make') {
    if (trackingRef.current || extractingRef.current || makingRef.current) {
      return;
    }

    if (!extracted) {
      setFeedback({ tone: 'warning', message: 'Extract details first before continuing.' });
      return;
    }

    const normalizedUrl = normalizeUrl(form.productUrl);
    if (!normalizedUrl) {
      setFeedback({ tone: 'warning', message: 'Product URL is required.' });
      return;
    }

    if (!form.companyName.trim()) {
      setFeedback({ tone: 'warning', message: 'Company name is required.' });
      return;
    }

    if (mode === 'make' && !selectedOwnProduct) {
      setFeedback({ tone: 'warning', message: 'Select an own-store product before adding a competitor.' });
      return;
    }

    const existing = mode === 'make'
      ? products.some((product) => Boolean(product.isCompetitor)
          && product.name.trim().toLowerCase() === (selectedOwnProduct?.name || '').trim().toLowerCase()
          && product.competitor.trim().toLowerCase() === form.companyName.trim().toLowerCase())
      : products.some((product) => normalizeUrl(product.url) === normalizedUrl
          && product.competitor.trim().toLowerCase() === form.companyName.trim().toLowerCase());
    if (existing) {
      setFeedback({ tone: 'warning', message: mode === 'make' ? 'This competitor is already linked to the selected own product.' : 'This product already exists for the selected URL/company.' });
      return;
    }

    setFeedback(null);

    if (mode === 'track') {
      trackingRef.current = true;
      setTracking(true);
      setProgressCheckpoint(12, 'tracking', 'Validating tracking payload');
    } else {
      makingRef.current = true;
      setMakingCompetitor(true);
      setProgressCheckpoint(12, 'making', 'Validating competitor payload');
    }


    try {
      setProgressCheckpoint(mode === 'track' ? 36 : 34, mode === 'track' ? 'tracking' : 'making', mode === 'track' ? 'Sending track request' : 'Sending make competitor request');
      const tracked = await trackProduct({
        url: normalizedUrl,
        name: mode === 'make' ? (selectedOwnProduct?.name || extracted?.title || undefined) : (extracted?.title || undefined),
        competitor: form.companyName.trim(),
        category: mode === 'make'
          ? (selectedOwnProduct?.category || form.category.trim() || extracted?.category || 'General')
          : (form.category.trim() || extracted?.category || 'General'),
        isCompetitor: true,
        scrape: extracted
      });

      setProgressCheckpoint(mode === 'track' ? 80 : 78, mode === 'track' ? 'tracking' : 'making', 'Applying tracked product changes');
      setProducts((current) => [tracked, ...current]);
      setProgressCheckpoint(mode === 'track' ? 92 : 90, mode === 'track' ? 'tracking' : 'making', 'Refreshing tracker list');
      finishProgress(true, mode === 'track' ? 'Product tracking started' : 'Competitor created successfully');
      setFeedback({
        tone: 'success',
        message: mode === 'track'
          ? `Now tracking ${tracked.name}.`
          : `${tracked.competitor} is now added as a competitor.`
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        finishProgress(false, mode === 'track' ? 'Track failed' : 'Make competitor failed');
        setFeedback({ tone: 'danger', message: error.message });
      } else {
        finishProgress(false, mode === 'track' ? 'Track failed' : 'Make competitor failed');
        setFeedback({ tone: 'danger', message: 'Operation failed unexpectedly.' });
      }
    } finally {
      if (mode === 'track') {
        trackingRef.current = false;
        setTracking(false);
      } else {
        makingRef.current = false;
        setMakingCompetitor(false);
      }
    }
  }

  async function handleTrackProduct() {
    await submitTrackedProduct('track');
  }

  async function handleMakeCompetitor() {
    await submitTrackedProduct('make');
  }

  const isBusy = extracting || tracking || makingCompetitor;
  const progressTone: 'default' | 'success' | 'warning' | 'danger' = progress.status === 'done' ? 'success' : progress.status === 'error' ? 'danger' : progress.status === 'idle' ? 'default' : 'warning';
  const progressBarClass = progress.status === 'done'
    ? 'bg-success'
    : progress.status === 'error'
      ? 'bg-danger'
      : 'bg-primary';
  const extractedName = extracted?.title || extracted?.name || extracted?.matched_title || 'N/A';
  const extractedImage = extracted?.image || (Array.isArray(extracted?.images) && extracted.images.length ? extracted.images[0] : '');
  const extractedReviews = Array.isArray(extracted?.reviews) ? extracted.reviews : [];

  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Competitor tracker" title="URL-first competitor tracking" description="Queue handling now lives in onboarding. Use this page for direct single competitor extraction and tracking." />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <GlassCard>
          <div className="space-y-4">
            <Input
              placeholder="Competitor product URL (required)"
              value={form.productUrl}
              onChange={(event) => setForm((current) => ({ ...current, productUrl: event.target.value }))}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                placeholder="Company name (required)"
                value={form.companyName}
                onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))}
              />
              <Input
                placeholder="Category (optional)"
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              />
            </div>

            {extracted ? (
              <div className="rounded-2xl border border-border bg-white/5 p-4">
                <div className="mb-2 text-xs uppercase tracking-[0.22em] text-muted">Own product selection (for Make Competitor)</div>
                <select
                  value={selectedOwnProduct?.id || ''}
                  onChange={(event) => setSelectedOwnProductId(event.target.value)}
                  className="w-full rounded-xl border border-border bg-black/20 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                >
                  {ownProducts.length ? ownProducts.map((product) => (
                    <option key={product.id} value={product.id}>{product.name} · {product.category}</option>
                  )) : <option value="">No own-store products found. Add one from Products page.</option>}
                </select>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                type="button"
                onClick={() => void handleExtractDetails()}
                loading={extracting}
                disabled={tracking || makingCompetitor}
              >
                {extracting ? 'Extracting...' : 'Extract Details'}
              </Button>
              {extracted ? (
                <>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => void handleTrackProduct()}
                    loading={tracking}
                    disabled={extracting || makingCompetitor}
                  >
                    {tracking ? 'Tracking...' : 'Track Product'}
                  </Button>
                  <Button
                    variant="accent"
                    type="button"
                    onClick={() => void handleMakeCompetitor()}
                    loading={makingCompetitor}
                    disabled={extracting || tracking}
                  >
                    {makingCompetitor ? 'Creating...' : 'Make Competitor'}
                  </Button>
                </>
              ) : null}
            </div>

            {isBusy ? (
              <div className="rounded-2xl border border-border bg-white/5 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-text">Operation Progress</div>
                  <div className="text-sm font-semibold text-text">{Math.round(progress.value)}%</div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-black/30">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${progressBarClass}`}
                    style={{ width: `${Math.max(0, Math.min(100, progress.value))}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted">{progress.label}</div>
                  <Badge tone={progressTone}>{progress.status.toUpperCase()}</Badge>
                </div>
              </div>
            ) : null}

            {feedback ? (
              <div className="rounded-xl border border-border bg-black/30 p-3">
                <Badge tone={feedback.tone}>{feedback.tone.toUpperCase()}</Badge>
                <div className="mt-2 text-sm text-slate-200">{feedback.message}</div>
              </div>
            ) : null}

            {!isBusy && extracted ? (
              <div className="rounded-xl border border-success/35 bg-success/10 p-3 text-sm text-slate-200">
                Extraction is complete. Choose one action to continue.
              </div>
            ) : null}
          </div>
        </GlassCard>

        <GlassCard>
          <SectionHeader eyebrow="Action flow" title="How this tracker works" description="Professional one-by-one flow with clear stages and safe actions." />
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-border bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted">Step 1</div>
              <div className="mt-1 text-sm text-slate-200">Enter URL and company name, then extract details.</div>
            </div>
            <div className="rounded-2xl border border-border bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted">Step 2</div>
              <div className="mt-1 text-sm text-slate-200">After extraction, choose either Track Product or Make Competitor.</div>
            </div>
            <div className="rounded-2xl border border-border bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted">Step 3</div>
              <div className="mt-1 text-sm text-slate-200">Progress bar reaches 100% once the action is completed.</div>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <GlassCard>
          <SectionHeader eyebrow="Extracted preview" title="Latest extracted details" description="Only the key details you need before tracking." />
          {extracted ? (
            <div className="mt-5 grid gap-4 md:grid-cols-[0.85fr_1.15fr]">
              <div className="rounded-2xl border border-border bg-white/5 p-4">
                <div className="aspect-[4/3] overflow-hidden rounded-xl border border-border bg-black/25">
                  {extractedImage ? (
                    <img src={extractedImage} alt={extractedName || 'Extracted product'} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.2em] text-muted">No image</div>
                  )}
                </div>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-xl border border-border bg-black/20 p-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted">Name</div>
                    <div className="mt-1 text-sm font-medium text-text">{extractedName}</div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border bg-black/20 p-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted">Price</div>
                      <div className="mt-1 text-sm font-medium text-text">{extracted.price || 'N/A'}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-black/20 p-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted">Rating</div>
                      <div className="mt-1 text-sm font-medium text-text">{extracted.rating || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-white/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold text-text">Last 5 Reviews</div>
                  <Badge tone="default">{Math.min(5, extractedReviews.length)} items</Badge>
                </div>
                <div className="space-y-3">
                  {extractedReviews.slice(0, 5).map((review, index) => (
                    <div key={`${review.reviewer || 'reviewer'}-${review.date || index}`} className="rounded-xl border border-border bg-black/25 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-slate-100">{review.reviewer || 'Anonymous'}</div>
                        <div className="text-xs text-muted">{review.date || 'Unknown date'}</div>
                      </div>
                      <div className="mt-1 text-xs text-warning">{`★`.repeat(Math.max(0, Math.min(5, review.stars || 0))) || 'No rating'}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-300">{review.text || 'No review text available.'}</div>
                    </div>
                  ))}
                  {!extractedReviews.length ? (
                    <div className="rounded-xl border border-border bg-black/25 p-3 text-sm text-slate-300">No reviews were extracted for this product.</div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-border bg-white/5 p-5 text-sm text-slate-300">
              No extraction yet. Enter URL and company name, then click Extract Details.
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <SectionHeader eyebrow="Recent coverage" title="Tracked competitor set" description="Latest tracked products after successful add." />
          <div className="mt-5 space-y-4">
            {productsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => <LoadingSkeleton key={`recent-skeleton-${index}`} className="h-24" />)}
              </div>
            ) : recentItems.length ? recentItems.map((item) => (
              <motion.div key={item.id} whileHover={{ y: -2 }} className="rounded-2xl border border-border bg-white/5 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-text">{item.name}</div>
                    <div className="text-sm text-muted">{item.competitor} · {item.category}</div>
                  </div>
                  <Badge tone={item.availability === 'Low stock' ? 'warning' : 'success'}>{item.availability}</Badge>
                </div>
                <div className="mt-3 text-sm text-slate-300">{item.currency} {item.latestPrice} tracked against {item.currency} {item.oldPrice} baseline</div>
              </motion.div>
            )) : <div className="rounded-2xl border border-border bg-white/5 p-4 text-sm text-slate-300">No tracked products yet. Add a competitor to populate this panel.</div>}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
