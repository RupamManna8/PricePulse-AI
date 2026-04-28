import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, GlassCard, PulseLoader } from '../components/ui';
import { ApiProduct, fetchProducts, scrapeProduct, trackProduct } from '../lib/api';

type Step = 'welcome' | 'your-product' | 'competitors' | 'complete';

type CompetitorStatus = 'idle' | 'queued' | 'processing' | 'done' | 'error';

interface CompetitorInput {
  id: string;
  url: string;
  companyName: string;
  status: CompetitorStatus;
  detail?: string;
}

type ActivityLog = {
  id: string;
  message: string;
  tone: 'default' | 'success' | 'warning' | 'danger';
  timestamp: string;
};

interface OwnProductDraft {
  name: string;
  url: string;
  price: string;
  category: string;
}

function createCompetitor(): CompetitorInput {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    url: '',
    companyName: '',
    status: 'idle'
  };
}

function normalizeUrl(url: string) {
  const value = url.trim();
  if (!value) {
    return '';
  }

  return value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`;
}

const EMPTY_OWN_PRODUCT_DRAFT: OwnProductDraft = {
  name: '',
  url: '',
  price: '',
  category: ''
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const [step, setStep] = useState<Step>('welcome');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOwnProducts, setIsLoadingOwnProducts] = useState(false);
  const [isSavingOwnProduct, setIsSavingOwnProduct] = useState(false);

  const [ownProducts, setOwnProducts] = useState<ApiProduct[]>([]);
  const [selectedOwnProductId, setSelectedOwnProductId] = useState('');
  const [showAddNewOwnProduct, setShowAddNewOwnProduct] = useState(false);
  const [ownProductDraft, setOwnProductDraft] = useState<OwnProductDraft>(EMPTY_OWN_PRODUCT_DRAFT);

  const [competitors, setCompetitors] = useState<CompetitorInput[]>([createCompetitor()]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  function addLog(message: string, tone: ActivityLog['tone'] = 'default') {
    setActivityLogs((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        message,
        tone,
        timestamp: new Date().toISOString()
      },
      ...current
    ]);
  }

  const validCompetitors = useMemo(
    () => competitors.filter((item) => item.url.trim() && item.companyName.trim()),
    [competitors]
  );
  const failedCompetitors = useMemo(
    () => competitors.filter((item) => item.status === 'error' && item.url.trim() && item.companyName.trim()),
    [competitors]
  );
  const selectedOwnProduct = useMemo(
    () => ownProducts.find((product) => product.id === selectedOwnProductId) ?? null,
    [ownProducts, selectedOwnProductId]
  );

  const isAnyAsyncAction = isLoading || isLoadingOwnProducts || isSavingOwnProduct;

  const allValidDone = validCompetitors.length > 0 && validCompetitors.every((item) => item.status === 'done');

  useEffect(() => {
    void loadOwnProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runWithRetry<T>(task: () => Promise<T>, contextLabel: string, retries = 2) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
      try {
        return await task();
      } catch (error) {
        lastError = error;
        if (attempt <= retries) {
          addLog(`${contextLabel} failed on attempt ${attempt}. Retrying...`, 'warning');
        }
      }
    }

    throw lastError;
  }

  async function loadOwnProducts() {
    setIsLoadingOwnProducts(true);

    try {
      const products = await fetchProducts();
      const ownStoreProducts = products.filter((product) => !product.isCompetitor);
      setOwnProducts(ownStoreProducts);

      setSelectedOwnProductId((current) => {
        if (current && ownStoreProducts.some((product) => product.id === current)) {
          return current;
        }
        return ownStoreProducts[0]?.id ?? '';
      });

      if (!ownStoreProducts.length) {
        setShowAddNewOwnProduct(true);
      }
    } catch (error) {
      addLog(`Failed to load your own products: ${getErrorMessage(error)}`, 'danger');
    } finally {
      setIsLoadingOwnProducts(false);
    }
  }

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <GlassCard className="space-y-6 p-8">
          <h2 className="text-2xl font-semibold">Authentication Required</h2>
          <p className="text-muted">Please sign in to set up your competitive intelligence dashboard.</p>
          <Button variant="primary" onClick={() => navigate('/auth/sign-in')}>Go to Sign In</Button>
        </GlassCard>
      </div>
    );
  }

  const handleAddCompetitor = () => {
    if (isAnyAsyncAction) {
      return;
    }
    setCompetitors((current) => [...current, createCompetitor()]);
  };

  const handleRemoveCompetitor = (id: string) => {
    if (isAnyAsyncAction) {
      return;
    }
    setCompetitors((current) => current.length > 1 ? current.filter((item) => item.id !== id) : current);
  };

  const handleCompetitorChange = (id: string, field: 'url' | 'companyName', value: string) => {
    if (isAnyAsyncAction) {
      return;
    }

    setCompetitors((current) => current.map((item) => {
      if (item.id !== id) {
        return item;
      }

      return {
        ...item,
        [field]: value,
        status: item.status === 'done' ? 'queued' : item.status,
        detail: undefined
      };
    }));
  };

  const handleCreateOwnProduct = async () => {
    if (isSavingOwnProduct) {
      return;
    }

    const trimmedName = ownProductDraft.name.trim();
    const trimmedCategory = ownProductDraft.category.trim();
    if (!trimmedName) {
      addLog('Product name is required for your own store product.', 'warning');
      return;
    }

    if (!trimmedCategory) {
      addLog('Category is required for your own store product.', 'warning');
      return;
    }

    const trimmedUrl = ownProductDraft.url.trim();
    const normalizedOwnUrl = trimmedUrl ? normalizeUrl(trimmedUrl) : '';
    if (trimmedUrl && !normalizedOwnUrl) {
      addLog('Own product URL is invalid.', 'warning');
      return;
    }

    const trimmedPrice = ownProductDraft.price.trim();
    let numericPrice: number | undefined;
    if (trimmedPrice) {
      const parsed = Number(trimmedPrice);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        addLog('Own product price must be a positive number.', 'warning');
        return;
      }
      numericPrice = parsed;
    }

    setIsSavingOwnProduct(true);

    try {
      const payload: Parameters<typeof trackProduct>[0] = {
        name: trimmedName,
        category: trimmedCategory,
        isCompetitor: false
      };

      if (normalizedOwnUrl) {
        payload.url = normalizedOwnUrl;
      }
      if (typeof numericPrice === 'number') {
        payload.price = numericPrice;
      }

      const createdOwnProduct = await runWithRetry(
        () => trackProduct(payload),
        `Saving own product ${trimmedName}`
      );

      addLog(`Own product ${createdOwnProduct.name} saved successfully.`, 'success');
      await loadOwnProducts();
      setSelectedOwnProductId(createdOwnProduct.id);
      setOwnProductDraft(EMPTY_OWN_PRODUCT_DRAFT);
      setShowAddNewOwnProduct(false);
    } catch (error) {
      addLog(`Failed to save own product: ${getErrorMessage(error)}`, 'danger');
    } finally {
      setIsSavingOwnProduct(false);
    }
  };

  const handleSetupCompetitors = async (retryFailedOnly = false) => {
    if (isLoading) {
      return;
    }

    if (!selectedOwnProduct) {
      addLog('Please select your own product first.', 'warning');
      setStep('your-product');
      return;
    }

    const queueItems = retryFailedOnly
      ? validCompetitors.filter((item) => item.status === 'error')
      : validCompetitors.filter((item) => item.status !== 'done');

    if (!validCompetitors.length) {
      addLog('Please add at least one competitor URL and company name.', 'warning');
      return;
    }

    if (!retryFailedOnly && allValidDone) {
      setStep('complete');
      return;
    }

    if (!queueItems.length) {
      addLog(retryFailedOnly ? 'No failed competitors available to retry.' : 'No competitors pending in queue.', 'warning');
      return;
    }

    setIsLoading(true);
    addLog(`${retryFailedOnly ? 'Retrying' : 'Starting'} queue processing for ${queueItems.length} competitor(s).`);

    const queuedIds = new Set(queueItems.map((item) => item.id));
    setCompetitors((current) => current.map((item) => (queuedIds.has(item.id) ? { ...item, status: 'queued', detail: 'Waiting in queue...' } : item)));

    let hasFailures = false;

    for (const competitor of queueItems) {
      const company = competitor.companyName.trim();

      const normalizedUrl = normalizeUrl(competitor.url);
      if (!normalizedUrl) {
        hasFailures = true;
        setCompetitors((current) => current.map((item) => item.id === competitor.id ? { ...item, status: 'error', detail: 'Invalid URL' } : item));
        addLog(`Invalid URL for ${company || 'competitor'}.`, 'danger');
        continue;
      }

      setCompetitors((current) => current.map((item) => item.id === competitor.id ? { ...item, status: 'processing', detail: 'Scraping competitor details...' } : item));

      try {
        const scrapeData = await runWithRetry(
          () => scrapeProduct(normalizedUrl),
          `Scraping ${company || 'competitor'}`
        );

        setCompetitors((current) => current.map((item) => item.id === competitor.id ? { ...item, detail: 'Tracking competitor...' } : item));

        const payload: Parameters<typeof trackProduct>[0] = {
          url: normalizedUrl,
          competitor: company,
          name: selectedOwnProduct.name,
          isCompetitor: true,
          scrape: scrapeData
        };

        const selectedCategory = selectedOwnProduct.category?.trim();
        if (selectedCategory) {
          payload.category = selectedCategory;
        }

        const created = await runWithRetry(
          () => trackProduct(payload),
          `Tracking ${company || 'competitor'}`
        );

        setCompetitors((current) => current.map((item) => item.id === competitor.id ? { ...item, status: 'done', detail: `Tracked ${created.name}` } : item));
        addLog(`Tracked ${company} successfully.`, 'success');
      } catch (error: unknown) {
        hasFailures = true;
        const detail = getErrorMessage(error);
        setCompetitors((current) => current.map((item) => item.id === competitor.id ? { ...item, status: 'error', detail: `${detail}. Retry available.` } : item));
        addLog(`Failed ${company}: ${detail}`, 'danger');
      }
    }

    setIsLoading(false);

    if (!hasFailures) {
      addLog('Queue processing complete. You can launch dashboard now.', 'success');
      setStep('complete');
    } else {
      addLog('Queue completed with failures. Use retry to process failed competitors.', 'warning');
    }
  };

  const progressPercent = {
    welcome: 20,
    'your-product': 40,
    competitors: 80,
    complete: 100
  }[step];

  const queueCounts = competitors.reduce((acc, item) => {
    acc[item.status] += 1;
    return acc;
  }, { idle: 0, queued: 0, processing: 0, done: 0, error: 0 } as Record<CompetitorStatus, number>);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8 space-y-3">
        <div className="h-1 w-full overflow-hidden rounded-full bg-border">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className="text-sm text-muted">
          Step {step === 'welcome' ? 1 : step === 'your-product' ? 2 : step === 'competitors' ? 3 : 4} of 4
        </div>
      </div>

      {step === 'welcome' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <GlassCard className="space-y-6 p-8">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold">Welcome to PricePulse AI</h1>
              <p className="text-lg text-muted">Let's set up your competitive intelligence dashboard in 3 steps.</p>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-black/40 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">1</div>
                  <div>
                    <div className="font-medium">Your Product Details</div>
                    <div className="text-sm text-muted">Name, starting price, and category</div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-black/40 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">2</div>
                  <div>
                    <div className="font-medium">Add Competitors</div>
                    <div className="text-sm text-muted">URL + company name queue processing</div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-black/40 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">3</div>
                  <div>
                    <div className="font-medium">Launch Dashboard</div>
                    <div className="text-sm text-muted">Live monitoring and insights ready to go</div>
                  </div>
                </div>
              </div>
            </div>

            <Button variant="primary" size="lg" className="w-full" onClick={() => setStep('your-product')} disabled={isAnyAsyncAction}>
              Get Started
            </Button>
          </GlassCard>
        </motion.div>
      )}

      {step === 'your-product' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <GlassCard className="space-y-6 p-8">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold">Select Your Own Product</h2>
              <Button
                variant="accent"
                onClick={() => setShowAddNewOwnProduct((current) => !current)}
                disabled={isAnyAsyncAction}
              >
                Add New
              </Button>
            </div>

            <p className="text-sm text-muted">
              Choose your own store product first. Competitors will be linked to the selected product.
            </p>

            {isLoadingOwnProducts ? (
              <div className="rounded-lg border border-border bg-black/25 p-4">
                <PulseLoader label="Loading your own products..." />
              </div>
            ) : null}

            {!isLoadingOwnProducts && ownProducts.length > 0 ? (
              <div className="space-y-3">
                {ownProducts.map((product) => {
                  const selected = selectedOwnProductId === product.id;
                  return (
                    <div
                      key={product.id}
                      className={`rounded-lg border p-4 ${selected ? 'border-primary bg-primary/10' : 'border-border bg-black/25'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-text">{product.name}</div>
                          <div className="mt-1 text-xs text-muted">Category: {product.category || 'Uncategorized'}</div>
                          <div className="mt-1 text-xs text-muted">Price: {product.latestPrice || 0}</div>
                        </div>
                        <Button
                          variant={selected ? 'outline' : 'primary'}
                          size="sm"
                          onClick={() => setSelectedOwnProductId(product.id)}
                          disabled={isAnyAsyncAction || selected}
                        >
                          {selected ? 'Selected' : 'Select'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {!isLoadingOwnProducts && !ownProducts.length && !showAddNewOwnProduct ? (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
                No own store products found. Click Add New to create one.
              </div>
            ) : null}

            {showAddNewOwnProduct ? (
              <div className="space-y-4 rounded-lg border border-border bg-black/25 p-4">
                <div className="text-sm font-medium text-text">Add Own Store Product</div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Product Name</label>
                  <input
                    type="text"
                    value={ownProductDraft.name}
                    onChange={(e) => setOwnProductDraft((current) => ({ ...current, name: e.target.value }))}
                    placeholder="e.g., Premium Wireless Headphones"
                    className="w-full rounded-lg border border-border bg-black/30 px-4 py-3 text-text placeholder-muted focus:border-primary focus:outline-none"
                    disabled={isAnyAsyncAction}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Product URL (optional)</label>
                  <input
                    type="text"
                    value={ownProductDraft.url}
                    onChange={(e) => setOwnProductDraft((current) => ({ ...current, url: e.target.value }))}
                    placeholder="https://yourstore.com/product"
                    className="w-full rounded-lg border border-border bg-black/30 px-4 py-3 text-text placeholder-muted focus:border-primary focus:outline-none"
                    disabled={isAnyAsyncAction}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Price (optional)</label>
                    <input
                      type="number"
                      value={ownProductDraft.price}
                      onChange={(e) => setOwnProductDraft((current) => ({ ...current, price: e.target.value }))}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-border bg-black/30 px-4 py-3 text-text placeholder-muted focus:border-primary focus:outline-none"
                      disabled={isAnyAsyncAction}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">Category</label>
                    <select
                      value={ownProductDraft.category}
                      onChange={(e) => setOwnProductDraft((current) => ({ ...current, category: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-black/30 px-4 py-3 text-text focus:border-primary focus:outline-none"
                      disabled={isAnyAsyncAction}
                    >
                      <option value="">Select category</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Fashion">Fashion</option>
                      <option value="Home & Garden">Home & Garden</option>
                      <option value="Sports">Sports</option>
                      <option value="Books">Books</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddNewOwnProduct(false);
                      setOwnProductDraft(EMPTY_OWN_PRODUCT_DRAFT);
                    }}
                    disabled={isAnyAsyncAction}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1"
                    loading={isSavingOwnProduct}
                    disabled={isAnyAsyncAction}
                    onClick={() => void handleCreateOwnProduct()}
                  >
                    Save Own Product
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('welcome')} disabled={isAnyAsyncAction}>Back</Button>
              <Button variant="primary" className="flex-1" disabled={!selectedOwnProduct || isAnyAsyncAction} onClick={() => setStep('competitors')}>
                Next: Add Competitors
              </Button>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {step === 'competitors' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <GlassCard className="space-y-6 p-8">
            <div>
              <h2 className="mb-2 text-2xl font-semibold">Add Competitors to Monitor</h2>
              <p className="text-muted">
                Selected own product: {selectedOwnProduct ? selectedOwnProduct.name : 'None selected'}
              </p>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {competitors.map((competitor) => (
                <div key={competitor.id} className="rounded-lg border border-border bg-black/25 p-3">
                  <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <input
                      type="text"
                      value={competitor.url}
                      onChange={(e) => handleCompetitorChange(competitor.id, 'url', e.target.value)}
                      placeholder="https://competitor.com/product"
                      className="w-full rounded-lg border border-border bg-black/30 px-4 py-2 text-sm text-text placeholder-muted focus:border-primary focus:outline-none"
                    />
                    <input
                      type="text"
                      value={competitor.companyName}
                      onChange={(e) => handleCompetitorChange(competitor.id, 'companyName', e.target.value)}
                      placeholder="Company name"
                      className="w-full rounded-lg border border-border bg-black/30 px-4 py-2 text-sm text-text placeholder-muted focus:border-primary focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <Badge tone={competitor.status === 'done' ? 'success' : competitor.status === 'error' ? 'danger' : competitor.status === 'processing' ? 'warning' : 'default'}>{competitor.status.toUpperCase()}</Badge>
                      {competitors.length > 1 ? <Button variant="ghost" size="sm" onClick={() => handleRemoveCompetitor(competitor.id)} disabled={isAnyAsyncAction}>Remove</Button> : null}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted">{competitor.detail || (competitor.status === 'idle' ? 'Not queued yet' : 'Waiting...')}</div>
                  {competitor.status === 'processing' ? <div className="mt-2"><PulseLoader size="sm" label="Processing" /></div> : null}
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-5">
              <Badge tone="default">Idle: {queueCounts.idle}</Badge>
              <Badge tone="warning">Queued: {queueCounts.queued}</Badge>
              <Badge tone="warning">Processing: {queueCounts.processing}</Badge>
              <Badge tone="success">Done: {queueCounts.done}</Badge>
              <Badge tone="danger">Error: {queueCounts.error}</Badge>
            </div>

            <Button variant="accent" className="w-full" onClick={handleAddCompetitor} disabled={isLoading}>
              Add New
            </Button>

            <div className="rounded-2xl border border-border bg-black/20 p-4">
              <div className="mb-3 text-xs uppercase tracking-[0.2em] text-muted">Queue activity</div>
              <div className="max-h-40 space-y-2 overflow-auto pr-1">
                {activityLogs.length ? activityLogs.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border/70 bg-white/5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Badge tone={item.tone === 'danger' ? 'danger' : item.tone === 'warning' ? 'warning' : item.tone === 'success' ? 'success' : 'default'}>{item.tone.toUpperCase()}</Badge>
                      <span className="text-xs text-muted">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                    <div className="mt-2 text-sm text-slate-300">{item.message}</div>
                  </div>
                )) : <div className="text-sm text-slate-300">No queue activity yet.</div>}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('your-product')} disabled={isLoading}>Back</Button>
              {failedCompetitors.length ? (
                <Button
                  variant="outline"
                  loading={isLoading}
                  disabled={isLoading || !failedCompetitors.length || !selectedOwnProduct}
                  onClick={() => void handleSetupCompetitors(true)}
                >
                  Retry Failed ({failedCompetitors.length})
                </Button>
              ) : null}
              <Button
                variant="primary"
                className="flex-1"
                loading={isLoading}
                disabled={isLoading || (!validCompetitors.length && !allValidDone) || !selectedOwnProduct}
                onClick={() => void handleSetupCompetitors()}
              >
                {allValidDone ? 'Continue to Dashboard' : 'Process Competitor Queue'}
              </Button>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {step === 'complete' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <GlassCard className="space-y-6 p-8 text-center">
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
                  <svg className="h-8 w-8 text-success" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <h2 className="text-3xl font-semibold">Dashboard Ready!</h2>
              <p className="text-lg text-muted">Your competitive intelligence system is now live and monitoring.</p>
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-black/40 p-4">
              <div className="text-left">
                <div className="mb-3"><Badge tone="success">Next Steps</Badge></div>
                <ul className="space-y-2 text-sm text-muted">
                  <li className="flex items-center gap-2">
                    <span className="text-success">✓</span>
                    Live price tracking across all competitors
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-success">✓</span>
                    Sentiment analysis of customer reviews
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-success">✓</span>
                    Automated alerts for price changes
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-success">✓</span>
                    Market trend predictions
                  </li>
                </ul>
              </div>
            </div>

            <Button variant="primary" size="lg" className="w-full" onClick={() => navigate('/dashboard')}>
              View Dashboard
            </Button>
          </GlassCard>
        </motion.div>
      )}
    </div>
  );
}
