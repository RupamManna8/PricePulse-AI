import type { ApiProduct, DashboardStats } from './api';

export type WatchlistItem = {
  id: string;
  name: string;
  competitor: string;
  isCompetitor: boolean;
  category: string;
  latestPrice: number;
  oldPrice: number;
  rating: number;
  reviewCount: number;
  availability: 'In stock' | 'Low stock' | 'Out of stock';
  change24h: number;
  sentiment: number;
  image: string;
  currency: string;
  updatedAt: string;
  updatedAtIso: string;
};

export type AlertItem = {
  title: string;
  detail: string;
  tone: 'danger' | 'warning' | 'success';
  time: string;
};

export type TimelineEvent = {
  label: string;
  detail: string;
  when: string;
  tone: 'danger' | 'warning' | 'success';
};

export type ReviewLike = {
  text: string;
  reviewer: string;
  date: string;
  stars: number;
  sentiment?: string;
};

export type PriceHistoryLike = {
  price: number;
  timestamp?: string;
};

type ChartPoint = {
  day: string;
  competitor: number;
  yourStore: number;
};

function roundPrice(value: number) {
  return Number(value.toFixed(2));
}

function formatDateLabel(timestamp: string, fallback: string) {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function safeArray<T>(items: T[] | undefined | null) {
  return Array.isArray(items) ? items : [];
}

function getPriceSeriesPoints(history: PriceHistoryLike[]) {
  return safeArray(history)
    .filter((point) => Number.isFinite(point.price))
    .map((point) => ({
      price: Number(point.price),
      timestamp: point.timestamp ? new Date(point.timestamp) : new Date()
    }))
    .sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
}

function formatBucketLabel(date: Date, bucket: 'day' | 'week' | 'month') {
  if (bucket === 'month') {
    return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }

  if (bucket === 'week') {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  }

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function aggregateHistory(history: PriceHistoryLike[], bucket: 'day' | 'week' | 'month') {
  const series = getPriceSeriesPoints(history);
  if (!series.length) {
    return [];
  }

  const buckets = new Map<string, { total: number; count: number; latest: number }>();

  series.forEach((point) => {
    const date = new Date(point.timestamp);
    const key = bucket === 'month'
      ? `${date.getFullYear()}-${date.getMonth()}`
      : bucket === 'week'
        ? `${date.getFullYear()}-${Math.floor(date.getDate() / 7)}`
        : date.toISOString().slice(0, 10);
    const current = buckets.get(key) ?? { total: 0, count: 0, latest: point.price };
    current.total += point.price;
    current.count += 1;
    current.latest = point.price;
    buckets.set(key, current);
  });

  return Array.from(buckets.entries()).map(([key, stats]) => {
    const [year, remainder] = key.split('-').map((value) => Number(value));
    const date = bucket === 'month'
      ? new Date(year, remainder, 1)
      : bucket === 'week'
        ? new Date(year, 0, remainder * 7)
        : new Date(key);

    return {
      label: formatBucketLabel(date, bucket),
      average: Number((stats.total / Math.max(1, stats.count)).toFixed(2)),
      latest: roundPrice(stats.latest)
    };
  });
}

export function buildDashboardStats(products: ApiProduct[]): DashboardStats {
  const totalTrackedCompetitors = products.length;
  const averageCompetitorPrice = products.length ? products.reduce((sum, product) => sum + product.latestPrice, 0) / products.length : 0;
  const biggestPriceDropToday = products.length ? Math.max(...products.map((product) => Math.max(0, product.oldPrice - product.latestPrice))) : 0;
  const averageReviewSentiment = products.length ? Math.round(products.reduce((sum, product) => sum + (product.sentimentScore ?? 0), 0) / products.length) : 0;
  const trendingCategories = Array.from(new Set(products.map((product) => product.category))).slice(0, 4);

  return {
    totalTrackedCompetitors,
    averageCompetitorPrice: Number(averageCompetitorPrice.toFixed(2)),
    biggestPriceDropToday: Number(biggestPriceDropToday.toFixed(2)),
    averageReviewSentiment,
    trendingCategories
  };
}

export function buildWatchlistItems(products: ApiProduct[]): WatchlistItem[] {
  return [...products]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map((product) => ({
      id: product.id,
      name: product.name,
      competitor: product.competitor,
      isCompetitor: Boolean(product.isCompetitor),
      category: product.category,
      latestPrice: product.latestPrice,
      oldPrice: product.oldPrice,
      rating: product.rating,
      reviewCount: product.reviewCount,
      availability: product.availability as 'In stock' | 'Low stock' | 'Out of stock',
      change24h: Number((product.discountPct * -1).toFixed(1)),
      sentiment: product.sentimentScore,
      image: product.image,
      currency: product.currency || 'INR',
      updatedAt: (product.lastScrapedAt || product.createdAt) ? formatDateLabel(product.lastScrapedAt || product.createdAt, 'Now') : 'Now',
      updatedAtIso: product.lastScrapedAt || product.createdAt || new Date().toISOString()
    }));
}

export function buildCompetitorComparison(products: ApiProduct[]) {
  const grouped = new Map<string, { totalPrice: number; totalReviews: number; count: number }>();

  products.forEach((product) => {
    const current = grouped.get(product.competitor) ?? { totalPrice: 0, totalReviews: 0, count: 0 };
    current.totalPrice += product.latestPrice;
    current.totalReviews += product.reviewCount;
    current.count += 1;
    grouped.set(product.competitor, current);
  });

  return Array.from(grouped.entries())
    .map(([name, stats]) => ({
      name,
      price: Number((stats.totalPrice / Math.max(1, stats.count)).toFixed(2)),
      reviews: Math.round(stats.totalReviews / Math.max(1, stats.count))
    }))
    .slice(0, 5);
}

export function buildPriceHistorySeries(products: ApiProduct[]): ChartPoint[] {
  if (!products.length) {
    return [];
  }

  const source = [...products].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  const firstProduct = source[0];
  const lastProduct = source[source.length - 1];
  const startPrice = firstProduct.oldPrice > 0 ? firstProduct.oldPrice : Math.max(1, firstProduct.latestPrice * 1.08);
  const endPrice = lastProduct.latestPrice;
  const competitorStart = startPrice * 0.98;
  const competitorEnd = endPrice;
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return labels.map((day, index) => {
    const progress = index / Math.max(1, labels.length - 1);
    const competitor = roundPrice(competitorStart + (competitorEnd - competitorStart) * progress);
    const yourStore = roundPrice(startPrice + (endPrice - startPrice) * progress + Math.max(0.5, firstProduct.discountPct / 10));

    return {
      day,
      competitor,
      yourStore: Math.max(0, yourStore)
    };
  });
}

export function buildPriceHistoryDaily(history: PriceHistoryLike[]) {
  return aggregateHistory(history, 'day').slice(-14);
}

export function buildPriceHistoryWeekly(history: PriceHistoryLike[]) {
  return aggregateHistory(history, 'week').slice(-8).map((point) => ({
    week: point.label,
    price: point.average
  }));
}

export function buildPriceHistoryMonthly(history: PriceHistoryLike[]) {
  return aggregateHistory(history, 'month').slice(-6).map((point) => ({
    month: point.label,
    price: point.average
  }));
}

export function buildCurrencyComparison(products: ApiProduct[]) {
  const rates = {
    USD: 1,
    INR: 83,
    EUR: 0.92,
    GBP: 0.79
  };

  return products.slice(0, 4).map((product) => {
    const currency = (product.currency ?? 'USD').toUpperCase();
    const usdValue = product.latestPrice / (rates[currency as keyof typeof rates] ?? 1);
    return {
      name: product.name,
      usd: Number(usdValue.toFixed(2)),
      inr: Number((usdValue * rates.INR).toFixed(2)),
      eur: Number((usdValue * rates.EUR).toFixed(2)),
      gbp: Number((usdValue * rates.GBP).toFixed(2))
    };
  });
}

export function buildSentimentBreakdown(products: ApiProduct[]) {
  if (!products.length) {
    return [];
  }

  const positive = products.filter((product) => product.sentimentScore >= 67).length;
  const neutral = products.filter((product) => product.sentimentScore >= 34 && product.sentimentScore < 67).length;
  const negative = Math.max(0, products.length - positive - neutral);

  return [
    { name: 'Positive', value: positive, color: '#17C964' },
    { name: 'Neutral', value: neutral, color: '#F5A524' },
    { name: 'Negative', value: negative, color: '#FF5D73' }
  ].filter((entry) => entry.value > 0);
}

export function buildRatingTrend(products: ApiProduct[]) {
  if (!products.length) {
    return [];
  }

  const sorted = [...products].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  const firstRating = sorted[0].rating;
  const lastRating = sorted[sorted.length - 1].rating;
  const weeks = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'];

  return weeks.map((week, index) => {
    const progress = index / Math.max(1, weeks.length - 1);
    const rating = roundPrice(firstRating + (lastRating - firstRating) * progress);
    return { week, rating: clamp(rating, 1, 5) };
  });
}

export function buildAlerts(products: ApiProduct[]): AlertItem[] {
  if (!products.length) {
    return [];
  }

  const sortedByDrop = [...products].sort((left, right) => (right.oldPrice - right.latestPrice) - (left.oldPrice - left.latestPrice));
  const sortedBySentiment = [...products].sort((left, right) => right.sentimentScore - left.sentimentScore);
  const lowStock = products.find((product) => product.availability.toLowerCase().includes('low'));
  const alerts: AlertItem[] = [];

  if (sortedByDrop[0] && sortedByDrop[0].oldPrice > sortedByDrop[0].latestPrice) {
    const product = sortedByDrop[0];
    alerts.push({
      title: 'Largest live discount',
      detail: `${product.competitor} moved ${product.name} from $${product.oldPrice} to $${product.latestPrice}.`,
      tone: 'danger',
      time: formatDateLabel(product.createdAt, 'Recently')
    });
  }

  if (lowStock) {
    alerts.push({
      title: 'Stock pressure detected',
      detail: `${lowStock.competitor} is showing a low-stock signal on ${lowStock.name}.`,
      tone: 'warning',
      time: formatDateLabel(lowStock.createdAt, 'Recently')
    });
  }

  if (sortedBySentiment[0]) {
    const product = sortedBySentiment[0];
    alerts.push({
      title: 'Strongest sentiment reading',
      detail: `${product.name} is holding a ${product.sentimentScore}% sentiment score across tracked reviews.`,
      tone: 'success',
      time: formatDateLabel(product.createdAt, 'Recently')
    });
  }

  return alerts.slice(0, 3);
}

export function buildTimelineEvents(products: ApiProduct[]): TimelineEvent[] {
  if (!products.length) {
    return [];
  }

  const sorted = [...products].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  return sorted.slice(0, 4).map((product, index) => {
    const tone: TimelineEvent['tone'] = product.discountPct > 8 ? 'danger' : product.availability.toLowerCase().includes('low') ? 'warning' : 'success';
    return {
      label: index === 0 ? 'Current price pulse' : index === 1 ? 'Sentiment shift' : index === 2 ? 'Stock watch' : 'Market watch',
      detail: `${product.competitor} · ${product.name} at $${product.latestPrice} with ${product.reviewCount.toLocaleString()} reviews.`,
      when: formatDateLabel(product.createdAt, 'Now'),
      tone
    };
  });
}

export function buildSuggestions(products: ApiProduct[]): string[] {
  if (!products.length) {
    return [];
  }

  const strongestDrop = [...products].sort((left, right) => (right.oldPrice - right.latestPrice) - (left.oldPrice - left.latestPrice))[0];
  const strongestSentiment = [...products].sort((left, right) => right.sentimentScore - left.sentimentScore)[0];
  const highestReviews = [...products].sort((left, right) => right.reviewCount - left.reviewCount)[0];
  const lowStock = products.find((product) => product.availability.toLowerCase().includes('low'));

  const suggestions = [
    strongestDrop && strongestDrop.oldPrice > strongestDrop.latestPrice
      ? `Match ${strongestDrop.competitor}'s price move on ${strongestDrop.name}.`
      : null,
    lowStock ? `Lean into demand while ${lowStock.competitor} is low on ${lowStock.name}.` : null,
    strongestSentiment ? `Protect margin on ${strongestSentiment.name}; sentiment is holding at ${strongestSentiment.sentimentScore}%.` : null,
    highestReviews ? `Prioritize review response flow for ${highestReviews.name}, where demand is strongest.` : null
  ];

  return suggestions.filter((item): item is string => Boolean(item)).slice(0, 4);
}

export function buildSummaryReport(products: ApiProduct[]) {
  if (!products.length) {
    return {
      threats: [],
      opportunities: [],
      vulnerable: []
    };
  }

  const threats = [...products]
    .sort((left, right) => (right.oldPrice - right.latestPrice) - (left.oldPrice - left.latestPrice))
    .slice(0, 3)
    .map((product) => `${product.competitor} cut ${product.name} by $${Math.max(0, product.oldPrice - product.latestPrice).toFixed(2)}`);

  const opportunities = [...products]
    .sort((left, right) => right.sentimentScore - left.sentimentScore)
    .slice(0, 3)
    .map((product) => `${product.name} is maintaining ${product.sentimentScore}% sentiment, so margin headroom is still strong`);

  const vulnerable = [...products]
    .sort((left, right) => left.sentimentScore - right.sentimentScore)
    .slice(0, 3)
    .map((product) => `${product.competitor} is weakest on ${product.name} with ${product.sentimentScore}% sentiment`);

  return { threats, opportunities, vulnerable };
}

export function buildDiscountWarSignals(products: ApiProduct[]) {
  const discounted = products.filter((product) => product.discountPct >= 8);
  if (discounted.length < 2) {
    return ['No broad discount war detected right now.'];
  }

  return [
    `${discounted.length} competitors are discounting aggressively`,
    `${discounted[0].competitor} is leading the pressure cycle on ${discounted[0].name}`,
    'Protect margin or counter with a narrower price move'
  ];
}

export function buildRibbonItems(products: ApiProduct[]): string[] {
  if (!products.length) {
    return ['Connect a product URL to populate live pricing signals', 'Tracked products will appear here as soon as they are added'];
  }

  const strongestDrop = [...products].sort((left, right) => (right.oldPrice - right.latestPrice) - (left.oldPrice - left.latestPrice))[0];
  const strongestSentiment = [...products].sort((left, right) => right.sentimentScore - left.sentimentScore)[0];
  const lowStock = products.find((product) => product.availability.toLowerCase().includes('low'));

  return [
    `${products.length} live competitor products tracked`,
    strongestDrop && strongestDrop.oldPrice > strongestDrop.latestPrice ? `${strongestDrop.competitor} dropped ${strongestDrop.name} by $${(strongestDrop.oldPrice - strongestDrop.latestPrice).toFixed(2)}` : 'No active price drops at the moment',
    strongestSentiment ? `${strongestSentiment.name} sentiment at ${strongestSentiment.sentimentScore}%` : 'Sentiment data updates with each tracked product',
    lowStock ? `${lowStock.competitor} showing low stock on ${lowStock.name}` : 'Low-stock signals appear here when present',
    'Live scraping updates the dashboard without seeded fixtures',
    'Track a new URL to expand the analysis surface'
  ];
}

export function buildReviewSentimentBreakdown(reviews: ReviewLike[]) {
  const normalized = safeArray(reviews);
  if (!normalized.length) {
    return [];
  }

  const positive = normalized.filter((review) => (review.sentiment ?? '').toLowerCase() === 'positive' || review.stars >= 4).length;
  const negative = normalized.filter((review) => (review.sentiment ?? '').toLowerCase() === 'negative' || review.stars <= 2).length;
  const neutral = Math.max(0, normalized.length - positive - negative);

  return [
    { name: 'Positive', value: positive, color: '#17C964' },
    { name: 'Neutral', value: neutral, color: '#F5A524' },
    { name: 'Negative', value: negative, color: '#FF5D73' }
  ].filter((entry) => entry.value > 0);
}

export function buildPriceHistoryFromProduct(product?: ApiProduct | null) {
  if (!product) {
    return [];
  }

  const startPrice = product.oldPrice > 0 ? product.oldPrice : Math.max(1, product.latestPrice * 1.08);
  const endPrice = product.latestPrice;
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return labels.map((day, index) => {
    const progress = index / Math.max(1, labels.length - 1);
    return {
      day,
      competitor: roundPrice(startPrice + (endPrice - startPrice) * progress),
      yourStore: roundPrice(startPrice + (endPrice - startPrice) * progress + Math.max(0.5, product.discountPct / 8))
    };
  });
}

export function buildRatingTrendFromProduct(product?: ApiProduct | null) {
  if (!product) {
    return [];
  }

  const weeks = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'];
  const start = clamp(product.rating - Math.min(0.4, product.discountPct / 40), 1, 5);
  const end = clamp(product.rating, 1, 5);

  return weeks.map((week, index) => {
    const progress = index / Math.max(1, weeks.length - 1);
    return {
      week,
      rating: roundPrice(start + (end - start) * progress)
    };
  });
}
