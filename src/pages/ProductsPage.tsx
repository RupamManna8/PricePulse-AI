import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiProduct, fetchProducts, trackProduct } from '../lib/api';
import { formatCurrency } from '../lib/currency';
import { applyProductOverrides, ProductOverride, setProductOverride } from '../lib/productOverrides';
import { Badge, Button, GlassCard, Input, LoadingSkeleton, SectionHeader } from '../components/ui';
import { useLiveRefresh } from '../lib/useLiveRefresh';

type AddProductForm = {
  name: string;
  category: string;
  price: string;
  availability: string;
};

type EditDraft = {
  name: string;
  category: string;
  price: string;
  availability: string;
};

function toNumberOrUndefined(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function lookupText(value: string) {
  return String(value || '').trim().toLowerCase();
}

export function ProductsPage() {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState('Add a product using the form below.');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [minRating, setMinRating] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [watchlistIds, setWatchlistIds] = useState<string[]>(() => {
    try {
      const stored = window.localStorage.getItem('pricepulse-watchlist');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [form, setForm] = useState<AddProductForm>({
    name: '',
    category: '',
    price: '',
    availability: ''
  });
  const [editDraft, setEditDraft] = useState<EditDraft>({
    name: '',
    category: '',
    price: '',
    availability: ''
  });

  const loadProducts = useCallback(async () => {
    try {
      const data = await fetchProducts();
      setProducts(applyProductOverrides(data));
      setLastUpdatedAt(new Date().toISOString());
    } catch {
      setProducts([]);
      setStatus('Unable to load products from backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const { isRefreshing, lastRefreshedAt } = useLiveRefresh(
    async () => {
      await loadProducts();
    },
    { intervalMs: 20000, immediate: false }
  );

  useEffect(() => {
    window.localStorage.setItem('pricepulse-watchlist', JSON.stringify(watchlistIds));
  }, [watchlistIds]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = lookupText(search);

    return [...products]
      .filter((product) => {
        const matchesSearch = !normalizedSearch || [
          product.name,
          product.category,
          product.competitor,
          product.availability
        ].some((value) => lookupText(value).includes(normalizedSearch));
        const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
        const matchesSentiment = sentimentFilter === 'all'
          || (sentimentFilter === 'positive' && product.sentimentScore >= 67)
          || (sentimentFilter === 'neutral' && product.sentimentScore >= 34 && product.sentimentScore < 67)
          || (sentimentFilter === 'negative' && product.sentimentScore < 34);
        const matchesRating = !minRating || product.rating >= Number(minRating);
        const matchesPrice = (!minPrice || product.latestPrice >= Number(minPrice)) && (!maxPrice || product.latestPrice <= Number(maxPrice));
        return matchesSearch && matchesCategory && matchesSentiment && matchesRating && matchesPrice;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [products, search, categoryFilter, sentimentFilter, minRating, minPrice, maxPrice]);

  const ownStoreProducts = useMemo(
    () => filteredProducts.filter((product) => !product.isCompetitor),
    [filteredProducts]
  );

  const categories = useMemo(() => Array.from(new Set(products.map((product) => product.category))).sort(), [products]);

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader
          eyebrow="Product center"
          title="Manage products dynamically"
          description="Loading your live catalog and watchlist state."
        />
        <GlassCard>
          <LoadingSkeleton className="h-40" />
        </GlassCard>
        <GlassCard>
          <LoadingSkeleton className="h-48" />
        </GlassCard>
        <GlassCard>
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <LoadingSkeleton key={`product-skel-${index}`} className="h-32" />
            ))}
          </div>
        </GlassCard>
      </div>
    );
  }

  function toggleWatchlist(productId: string) {
    setWatchlistIds((current) => current.includes(productId) ? current.filter((id) => id !== productId) : [productId, ...current]);
  }

  async function handleAddProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (adding) {
      return;
    }

    if (!form.name.trim()) {
      setStatus('Product name is required.');
      return;
    }

    if (!form.price.trim()) {
      setStatus('Price is required.');
      return;
    }

    if (!form.category.trim()) {
      setStatus('Category is required.');
      return;
    }

    if (!form.availability.trim()) {
      setStatus('Availability is required.');
      return;
    }

    setAdding(true);
    setStatus('Adding own store product...');

    try {
      const created = await trackProduct({
        name: form.name.trim(),
        category: form.category.trim(),
        price: form.price.trim(),
        availability: form.availability.trim(),
        isCompetitor: false
      });

      const override: ProductOverride = {
        latestPrice: toNumberOrUndefined(form.price),
        availability: form.availability.trim() || undefined,
        category: form.category.trim() || undefined,
        name: form.name.trim() || undefined
      };

      if (Object.values(override).some((value) => value !== undefined && value !== '')) {
        setProductOverride(created.id, override);
      }

      const mergedProduct = {
        ...created,
        ...(override.latestPrice !== undefined ? { latestPrice: override.latestPrice } : {}),
        ...(override.availability ? { availability: override.availability } : {})
      };

      setProducts((current) => [mergedProduct, ...current]);
      setForm({
        name: '',
        category: '',
        price: '',
        availability: ''
      });
      setStatus(`Added own product ${mergedProduct.name} successfully.`);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setStatus(`Add failed: ${error.message}`);
      } else {
        setStatus('Add failed due to an unknown error.');
      }
    } finally {
      setAdding(false);
    }
  }

  function startEdit(product: ApiProduct) {
    setEditingId(product.id);
    setEditDraft({
      name: product.name,
      category: product.category,
      price: String(product.latestPrice ?? ''),
      availability: product.availability ?? ''
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft({
      name: '',
      category: '',
      price: '',
      availability: ''
    });
  }

  function saveEdit(productId: string) {
    const override: ProductOverride = {
      name: editDraft.name.trim(),
      category: editDraft.category.trim(),
      latestPrice: toNumberOrUndefined(editDraft.price),
      availability: editDraft.availability.trim()
    };

    setProductOverride(productId, override);
    setProducts((current) => current.map((product) => (product.id === productId ? { ...product, ...override } : product)));
    setStatus('Product updated in frontend.');
    cancelEdit();
  }

  function renderProductCards(items: ApiProduct[], emptyMessage: string) {
    if (!items.length) {
      return <div className="rounded-2xl border border-border bg-white/5 p-4 text-sm text-slate-300">{emptyMessage}</div>;
    }

    return items.map((product) => {
      const isEditing = editingId === product.id;

      return (
        <div key={product.id} className="rounded-2xl border border-border bg-white/5 p-4">
          {isEditing ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={editDraft.name} onChange={(event) => setEditDraft((current) => ({ ...current, name: event.target.value }))} />
                <Input value={editDraft.category} onChange={(event) => setEditDraft((current) => ({ ...current, category: event.target.value }))} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={editDraft.price} onChange={(event) => setEditDraft((current) => ({ ...current, price: event.target.value }))} />
                <Input value={editDraft.availability} onChange={(event) => setEditDraft((current) => ({ ...current, availability: event.target.value }))} />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="primary" type="button" onClick={() => saveEdit(product.id)}>Save</Button>
                <Button variant="ghost" type="button" onClick={cancelEdit}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-text">{product.name}</div>
                  <div className="text-sm text-muted">{product.category}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="success">Own store</Badge>
                  <Badge tone={product.availability.toLowerCase().includes('out') ? 'danger' : 'success'}>{product.availability}</Badge>
                </div>
              </div>
              <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                <div>Latest price: {formatCurrency(product.latestPrice, product.currency)}</div>
                <div>Rating: {product.rating} · Reviews: {product.reviewCount}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" type="button" onClick={() => startEdit(product)}>Edit</Button>
                <Button variant="ghost" type="button" onClick={() => toggleWatchlist(product.id)}>{watchlistIds.includes(product.id) ? 'Unwatch' : 'Watch'}</Button>
                <Link to={`/products/${product.id}`}>
                  <Button variant="ghost" type="button">Open Product</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      );
    });
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Product center"
        title="Manage products dynamically"
        description="Add products with the input form, review all added products below, and edit product details from a single place."
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white/5 px-4 py-3 text-sm text-slate-300">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-muted">Live sync</div>
          <div>{isRefreshing ? 'Refreshing catalog in the background...' : lastUpdatedAt ? `Last updated ${new Date(lastUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for first sync'}</div>
        </div>
        <Badge tone="success">{isRefreshing ? 'Updating' : 'Live catalog'}</Badge>
        {lastRefreshedAt ? <span className="text-xs text-muted">{new Date(lastRefreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> : null}
      </div>

      <GlassCard>
        <div className="grid gap-4 xl:grid-cols-[1.6fr_0.8fr_0.8fr_0.7fr_0.7fr_0.7fr]">
          <Input placeholder="Search brand, category, or product" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-xl border border-border bg-black/20 px-4 py-3 text-sm text-text outline-none">
            <option value="all">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select value={sentimentFilter} onChange={(event) => setSentimentFilter(event.target.value)} className="rounded-xl border border-border bg-black/20 px-4 py-3 text-sm text-text outline-none">
            <option value="all">All sentiment</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
          <Input type="number" step="0.1" min="0" placeholder="Min rating" value={minRating} onChange={(event) => setMinRating(event.target.value)} />
          <Input type="number" step="0.01" min="0" placeholder="Min price" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} />
          <Input type="number" step="0.01" min="0" placeholder="Max price" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
          <Badge tone="success">{filteredProducts.length} visible</Badge>
          <Badge tone="default">{ownStoreProducts.length} own</Badge>
          <Badge tone="warning">{watchlistIds.length} watched</Badge>
          <Button variant="ghost" type="button" onClick={() => setWatchlistIds([])}>Clear watchlist</Button>
        </div>
      </GlassCard>

      <GlassCard>
        <form onSubmit={handleAddProduct} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              placeholder="Product name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
            <Input
              placeholder="Price"
              value={form.price}
              onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              placeholder="Category"
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
            />
            <Input
              placeholder="Availability"
              value={form.availability}
              onChange={(event) => setForm((current) => ({ ...current, availability: event.target.value }))}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" type="submit" loading={adding} disabled={adding}>{adding ? 'Adding...' : 'Add Product'}</Button>
            <Badge tone="success">{status}</Badge>
          </div>
        </form>
      </GlassCard>

      <GlassCard>
        <SectionHeader
          eyebrow="Own store"
          title="Own store products"
          description="Products you manually add for your own catalog."
        />

        <div className="mt-5 space-y-4">
          {renderProductCards(ownStoreProducts, 'No own-store products yet. Add your first product above.')}
        </div>
      </GlassCard>
    </div>
  );
}
