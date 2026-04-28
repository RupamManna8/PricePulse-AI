export type ProductCard = {
  id: string;
  name: string;
  competitor: string;
  category: string;
  url: string;
  latestPrice: number;
  oldPrice: number;
  rating: number;
  reviewCount: number;
  availability: 'In stock' | 'Low stock' | 'Out of stock';
  change24h: number;
  sentiment: number;
  image: string;
  updatedAt: string;
};

export type AlertItem = {
  title: string;
  detail: string;
  tone: 'danger' | 'warning' | 'success';
  time: string;
};

export const dashboardStats = {
  totalTrackedCompetitors: 128,
  averageCompetitorPrice: 84.7,
  biggestPriceDropToday: 18.4,
  averageReviewSentiment: 71,
  trendingCategories: ['Sneakers', 'Skincare', 'Home Audio', 'Desk Accessories']
};

export const liveRibbonItems = [
  'Amazon dropped price 12%',
  '2 negative reviews detected',
  'Nike trending upward',
  'Best margin opportunity found',
  'Low stock warning on flagship SKUs',
  'Discount velocity accelerating'
];

export const priceHistory = [
  { day: 'Mon', competitor: 92, yourStore: 98 },
  { day: 'Tue', competitor: 91, yourStore: 98 },
  { day: 'Wed', competitor: 89, yourStore: 97 },
  { day: 'Thu', competitor: 88, yourStore: 97 },
  { day: 'Fri', competitor: 85, yourStore: 96 },
  { day: 'Sat', competitor: 83, yourStore: 96 },
  { day: 'Sun', competitor: 84, yourStore: 95 }
];

export const sentimentBreakdown = [
  { name: 'Positive', value: 61, color: '#17C964' },
  { name: 'Neutral', value: 24, color: '#F5A524' },
  { name: 'Negative', value: 15, color: '#FF5D73' }
];

export const competitorComparison = [
  { name: 'Amazon', price: 82, reviews: 4800 },
  { name: 'Nike', price: 109, reviews: 3900 },
  { name: 'Target', price: 76, reviews: 2500 },
  { name: 'Shopify Store', price: 98, reviews: 1500 },
  { name: 'Walmart', price: 74, reviews: 2800 }
];

export const ratingTrend = [
  { week: 'W1', rating: 4.6 },
  { week: 'W2', rating: 4.5 },
  { week: 'W3', rating: 4.4 },
  { week: 'W4', rating: 4.3 },
  { week: 'W5', rating: 4.5 },
  { week: 'W6', rating: 4.6 }
];

export const alerts: AlertItem[] = [
  {
    title: 'Competitor price drop > 10%',
    detail: 'Amazon reduced the primary SKU by 12% in the last 4 hours.',
    tone: 'danger',
    time: '2m ago'
  },
  {
    title: 'Low stock signal',
    detail: 'Nike inventory indicator suggests a likely stockout window.',
    tone: 'warning',
    time: '17m ago'
  },
  {
    title: 'Sentiment recovery',
    detail: 'Recent reviews on a tracked product turned positive after a packaging fix.',
    tone: 'success',
    time: '1h ago'
  }
];

export const timelineEvents = [
  {
    label: 'Price shock',
    detail: 'Primary competitor slashed price by 12% after a weekend promo.',
    when: '2h ago',
    tone: 'danger'
  },
  {
    label: 'Review spike',
    detail: 'Negative comments clustered around shipping delays and missing accessories.',
    when: '6h ago',
    tone: 'warning'
  },
  {
    label: 'Low stock',
    detail: 'Offer pages began surfacing low-stock notices across mobile sessions.',
    when: '11h ago',
    tone: 'warning'
  },
  {
    label: 'New launch',
    detail: 'A rival launched a refreshed variant with improved bundle pricing.',
    when: '1d ago',
    tone: 'success'
  }
];

export const suggestions = [
  'Raise price 3%. Competitor stock weak.',
  'Launch a bundle offer before the weekend traffic spike.',
  'Add a review response for shipping complaints.',
  'Track the new variant for price parity within 24h.'
];

export const watchlist: ProductCard[] = [
  {
    id: 'prod-1',
    name: 'Air Zoom Nova',
    competitor: 'Nike',
    category: 'Sneakers',
    url: 'https://example.com/nike-air-zoom',
    latestPrice: 109,
    oldPrice: 124,
    rating: 4.5,
    reviewCount: 3912,
    availability: 'Low stock',
    change24h: -12.1,
    sentiment: 78,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
    updatedAt: '2m ago'
  },
  {
    id: 'prod-2',
    name: 'Ultra Desk Lamp',
    competitor: 'Amazon',
    category: 'Home Audio',
    url: 'https://example.com/desk-lamp',
    latestPrice: 64,
    oldPrice: 72,
    rating: 4.3,
    reviewCount: 1863,
    availability: 'In stock',
    change24h: -8.3,
    sentiment: 65,
    image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80',
    updatedAt: '18m ago'
  },
  {
    id: 'prod-3',
    name: 'Matte Recovery Serum',
    competitor: 'Sephora',
    category: 'Skincare',
    url: 'https://example.com/serum',
    latestPrice: 48,
    oldPrice: 48,
    rating: 4.8,
    reviewCount: 2311,
    availability: 'In stock',
    change24h: 0,
    sentiment: 89,
    image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=800&q=80',
    updatedAt: '1h ago'
  }
];

export const reviewSamples = [
  {
    text: 'Amazing build quality, but the packaging felt rushed and the delivery was late.',
    sentiment: 'Negative',
    reviewer: 'Mia',
    date: '2h ago',
    stars: 2
  },
  {
    text: 'Excellent comfort and premium materials. Would buy again without hesitation.',
    sentiment: 'Positive',
    reviewer: 'Dylan',
    date: '5h ago',
    stars: 5
  },
  {
    text: 'Pretty good overall. Price is fair, though the app pairing could be smoother.',
    sentiment: 'Neutral',
    reviewer: 'Sara',
    date: '1d ago',
    stars: 4
  }
];
