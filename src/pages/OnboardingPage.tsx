import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, GlassCard, Input, LoadingSkeleton, PulseLoader, SectionHeader } from '../components/ui';
import { scrapeProduct, trackProduct } from '../lib/api';

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

export function OnboardingPage() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const [step, setStep] = useState<Step>('welcome');
  const [isLoading, setIsLoading] = useState(false);

  const [yourName, setYourName] = useState('');
  const [yourPrice, setYourPrice] = useState('');
  const [yourCategory, setYourCategory] = useState('Electronics');

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

  const allValidDone = validCompetitors.length > 0 && validCompetitors.every((item) => item.status === 'done');

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
    setCompetitors((current) => [...current, createCompetitor()]);
  };

  const handleRemoveCompetitor = (id: string) => {
    setCompetitors((current) => current.length > 1 ? current.filter((item) => item.id !== id) : current);
  };

  const handleCompetitorChange = (id: string, field: 'url' | 'companyName', value: string) => {
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

  const handleSetupCompetitors = async () => {
    if (isLoading) {
      return;
    }

    if (!validCompetitors.length) {
      addLog('Please add at least one competitor URL and company name.', 'warning');
      return;
    }

    if (allValidDone) {
      setStep('complete');
      return;
    }

    setIsLoading(true);
    addLog(`Starting queue processing for ${validCompetitors.length} competitor(s).`);

    const queuedIds = new Set(validCompetitors.filter((item) => item.status !== 'done').map((item) => item.id));
    setCompetitors((current) => current.map((item) => (queuedIds.has(item.id) ? { ...item, status: 'queued', detail: 'Waiting in queue...' } : item)));

    let hasFailures = false;

    for (const competitor of validCompetitors) {
      if (competitor.status === 'done') {
        continue;
      }

      const normalizedUrl = normalizeUrl(competitor.url);
      if (!normalizedUrl) {
        hasFailures = true;
        setCompetitors((current) => current.map((item) => item.id === competitor.id ? { ...item, status: 'error', detail: 'Invalid URL' } : item));
        addLog(`Invalid URL for ${competitor.companyName || 'competitor'}.`, 'danger');
        continue;
      }

      setCompetitors((current) => current.map((item) => item.id === competitor.id ? { ...item, status: 'processing', detail: 'Scraping competitor details...' } : item));

      try {
        // First, scrape the competitor URL to get actual data
        let scrapeData = undefined;
        try {
          scrapeData = await scrapeProduct(normalizedUrl);
          setCompetitors((current) => current.map((item) => item.id === competitor.id ? { ...item, detail: 'Tracking competitor...' } : item));
        } catch (scrapeError) {
          // If scraping fails, continue without scrape data - backend will handle it
          addLog(`Warning: Could not scrape ${competitor.companyName}, using fallback data.`, 'warning');
        }

        // Then track the product with the scraped data
        const created = await trackProduct({
          url: normalizedUrl,
          competitor: competitor.companyName.trim(),
          category: yourCategory,
          name: yourName ? `${yourName} rival` : undefined,
          isCompetitor: true,
          scrape: scrapeData
        });

        setCompetitors((current) => current.map((item) => item.id === competitor.id ? { ...item, status: 'done', detail: `Tracked ${created.name}` } : item));
        addLog(`Tracked ${competitor.companyName.trim()} successfully.`, 'success');
      } catch (error: unknown) {
        hasFailures = true;
        const detail = error instanceof Error ? error.message : 'Unknown error';
        setCompetitors((current) => current.map((item) => item.id === competitor.id ? { ...item, status: 'error', detail } : item));
        addLog(`Failed ${competitor.companyName.trim()}: ${detail}`, 'danger');
      }
    }

    setIsLoading(false);

    if (!hasFailures) {
      addLog('Queue processing complete. You can launch dashboard now.', 'success');
      setStep('complete');
    } else {
      addLog('Queue completed with some failures. Fix and retry.', 'warning');
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

            <Button variant="primary" size="lg" className="w-full" onClick={() => setStep('your-product')}>
              Get Started
            </Button>
          </GlassCard>
        </motion.div>
      )}

      {step === 'your-product' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <GlassCard className="space-y-6 p-8">
            <h2 className="text-2xl font-semibold">Your Product Details</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Product Name</label>
                <input
                  type="text"
                  value={yourName}
                  onChange={(e) => setYourName(e.target.value)}
                  placeholder="e.g., Premium Wireless Headphones"
                  className="w-full rounded-lg border border-border bg-black/30 px-4 py-3 text-text placeholder-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">Your Current Price</label>
                  <div className="flex items-center">
                    <span className="mr-2 text-muted">₹</span>
                    <input
                      type="number"
                      value={yourPrice}
                      onChange={(e) => setYourPrice(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 rounded-lg border border-border bg-black/30 px-4 py-3 text-text placeholder-muted focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Category</label>
                  <select
                    value={yourCategory}
                    onChange={(e) => setYourCategory(e.target.value)}
                    className="w-full rounded-lg border border-border bg-black/30 px-4 py-3 text-text focus:border-primary focus:outline-none"
                  >
                    <option>Electronics</option>
                    <option>Fashion</option>
                    <option>Home & Garden</option>
                    <option>Sports</option>
                    <option>Books</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('welcome')}>Back</Button>
              <Button variant="primary" className="flex-1" disabled={!yourName} onClick={() => setStep('competitors')}>
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
              <p className="text-muted">Queue processing now runs here. Add URL and company, then process the queue.</p>
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
                      {competitors.length > 1 ? <Button variant="ghost" size="sm" onClick={() => handleRemoveCompetitor(competitor.id)}>Remove</Button> : null}
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
              + Add Another Competitor
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
              <Button
                variant="primary"
                className="flex-1"
                loading={isLoading}
                disabled={isLoading || (!validCompetitors.length && !allValidDone)}
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
