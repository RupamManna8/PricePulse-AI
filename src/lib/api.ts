import axios from 'axios';
import { scheduleDataRefresh } from './realtime';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
const pythonBaseURL = import.meta.env.VITE_PYTHON_API_BASE_URL ?? 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL,
  timeout: 120000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add response error interceptor to extract backend error messages
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.data?.message) {
      const message = error.response.data.message;
      const newError = new Error(message);
      return Promise.reject(newError);
    }
    return Promise.reject(error);
  }
);

export const pythonClient = axios.create({
  baseURL: pythonBaseURL,
  timeout: 120000, // 2 minutes for scraping complex pages
  headers: {
    'Content-Type': 'application/json'
  }
});

export type ApiProduct = {
  id: string;
  url: string;
  name: string;
  competitor: string;
  isCompetitor?: boolean;
  isScraped?: boolean;
  category: string;
  latestPrice: number;
  rating: number;
  reviewCount: number;
  oldPrice: number;
  discountPct: number;
  availability: string;
  image: string;
  sentimentScore: number;
  createdAt: string;
  currency?: string;
  lastScrapedAt?: string;
};

export type ApiCompetitorWatchlistEntry = {
  id: string;
  productId: string;
  competitorName: string;
  yourPrice: number;
  competitorPrice: number;
  difference: number;
  ratingPosition: 'Leading' | 'At Risk' | 'Lagging';
  threatLevel: 'Low' | 'Medium' | 'High';
  rating: number;
  lastUpdatedAt: string;
};

export type ApiProductWatchlistGroup = {
  productKey: string;
  primaryProductId?: string;
  productName: string;
  category: string;
  previousPrice: number;
  currentPrice: number;
  difference: number;
  rating: number;
  lastUpdatedAt: string;
  competitors: ApiCompetitorWatchlistEntry[];
};

export type DashboardStats = {
  totalTrackedCompetitors: number;
  averageCompetitorPrice: number;
  biggestPriceDropToday: number;
  averageReviewSentiment: number;
  trendingCategories: string[];
  highestRatedRival?: { name: string; competitor: string; rating: number; latestPrice: number } | null;
  mostNegativeReviewedCompetitor?: { name: string; competitor: string; sentimentScore: number; reviewCount: number } | null;
};

export type TrackProductInput = {
  url?: string;
  name?: string;
  competitor?: string;
  category?: string;
  price?: number | string;
  availability?: string;
  isCompetitor?: boolean;
  scrape?: Partial<ScrapeResult>;
};

export type UserSettings = {
  autoScrapeGlobal: boolean;
  autoScrapeInterval: '6h' | '12h' | '24h';
  notificationsEnabled: boolean;
  alertThresholds: {
    priceDropPercent: number;
    sentimentShiftScore: number;
  };
  currency: 'INR' | 'USD' | 'EUR' | 'GBP';
  theme: 'light' | 'dark';
};

export type ImportProductInput = {
  url?: string;
  productUrl?: string;
  name?: string;
  title?: string;
  competitor?: string;
  isCompetitor?: boolean;
  storeName?: string;
  brand?: string;
  currency?: string;
  lastScrapedAt?: string;
  category?: string;
  latestPrice?: number | string;
  price?: number | string;
  oldPrice?: number | string;
  compareAtPrice?: number | string;
  rating?: number | string;
  reviewCount?: number | string;
  reviews?: number | string;
  availability?: string;
  image?: string;
  sentimentScore?: number | string;
};

export type ScrapeReview = {
  text: string;
  stars: number;
  reviewer: string;
  date: string;
  sentiment?: string;
};

export type ScrapeResult = {
  name?: string;
  title: string;
  price: string;
  old_price: string;
  rating: string;
  reviews: ScrapeReview[];
  availability: string;
  image: string;
  category: string;
  discount_pct?: number;
  stock_status?: string;
  images?: string[];
  currency?: string;
  converted_prices?: Array<{ currency: string; value: number }>;
  matched_url?: string;
  matched_title?: string;
  search_query?: string;
  search_results?: Array<{ title: string; url: string; snippet: string; score?: number }>;
};

export type SearchCandidate = {
  rank: number;
  company: string;
  title: string;
  url: string;
  snippet: string;
};

export type ProductHistoryPoint = {
  id: string;
  productId: string;
  price: number;
  timestamp: string;
};

export type ProductReview = {
  id: string;
  productId: string;
  text: string;
  sentiment: string;
  stars: number;
  reviewer: string;
  date: string;
};

export type ScreenshotResponse = {
  screenshot_base64: string;
  matched_url: string;
  title: string;
};

export type OcrResponse = {
  extracted_text: string;
  detected_price: string;
  confidence: number;
};

export type ReviewAnalysis = {
  sentiment: string;
  average_score: number;
  common_complaints: string[];
  top_praised_features: string[];
};

export type PriceHistoryPoint = {
  price: number;
  timestamp?: string;
};

export type PricePrediction = {
  next_week_price: number;
  discount_probability: number;
  trend: string;
};

export async function fetchDashboardStats() {
  const response = await apiClient.get<{ success: boolean; stats: DashboardStats }>('/api/dashboard-stats');
  return response.data.stats;
}

export async function fetchProducts() {
  const response = await apiClient.get<{ success: boolean; products: ApiProduct[] }>('/api/products');
  return response.data.products;
}

export async function fetchUserSettings() {
  const response = await apiClient.get<{ success: boolean; settings: UserSettings }>('/api/auth/settings');
  return response.data.settings;
}

export async function updateUserSettings(settings: Partial<UserSettings>) {
  const response = await apiClient.put<{ success: boolean; settings: UserSettings }>('/api/auth/settings', settings);
  return response.data.settings;
}

export async function fetchProductWatchlists() {
  const response = await apiClient.get<{ success: boolean; products: ApiProductWatchlistGroup[] }>('/api/products/watchlists');
  return response.data.products;
}

export async function fetchProductById(id: string) {
  const response = await apiClient.get<{ success: boolean; product: ApiProduct }>(`/api/product/${id}`);
  return response.data.product;
}

export async function fetchProductHistory(id: string) {
  const response = await apiClient.get<{ success: boolean; history: ProductHistoryPoint[] }>(`/api/product/${id}/history`);
  return response.data.history;
}

export async function fetchProductReviews(id: string) {
  const response = await apiClient.get<{ success: boolean; reviews: ProductReview[] }>(`/api/product/${id}/reviews`);
  return response.data.reviews;
}

export async function refreshProduct(id: string) {
  const response = await apiClient.post<{ success: boolean; product: ApiProduct }>(`/api/product/${id}/refresh`);
  scheduleDataRefresh({ source: 'refreshProduct', scope: 'product', id });
  return response.data.product;
}

export async function trackProduct(payload: TrackProductInput) {
  console.log('Sending track product request:', payload);
  const response = await apiClient.post<{ success: boolean; product: ApiProduct }>('/api/track-product', payload);
  console.log('Track product response:', response.data);
  scheduleDataRefresh({ source: 'trackProduct', scope: 'products', id: response.data.product?.id });
  return response.data.product;
}

export async function importStoreData(products: ImportProductInput[]) {
  const response = await apiClient.post<{ success: boolean; products: ApiProduct[]; importedCount: number }>('/api/import-products', { products });
  scheduleDataRefresh({ source: 'importStoreData', scope: 'products' });
  return response.data;
}

export async function scrapeProduct(input: string | { url?: string }) {
  const payload = typeof input === 'string' ? { url: input } : { url: input.url ?? '' };
  console.log('Sending scrape request to Python service:', payload);
  try {
    const response = await pythonClient.post<ScrapeResult | { success?: boolean; scrape?: ScrapeResult }>('/scrape', payload);
    const raw = (response.data as { success?: boolean; scrape?: ScrapeResult })?.scrape
      ? (response.data as { success?: boolean; scrape?: ScrapeResult }).scrape
      : (response.data as ScrapeResult);

    const normalized: ScrapeResult = {
      ...raw,
      title: raw?.title || raw?.name || raw?.matched_title || '',
      price: raw?.price || '',
      old_price: raw?.old_price || '',
      rating: raw?.rating || '0',
      reviews: Array.isArray(raw?.reviews) ? raw.reviews : [],
      availability: raw?.availability || raw?.stock_status || '',
      image: raw?.image || (Array.isArray(raw?.images) && raw.images.length ? raw.images[0] : '') || '',
      category: raw?.category || 'General'
    };

    console.log('Scrape response:', normalized);
    return normalized;
  } catch (error) {
    console.error('Scrape error:', error);
    if (error instanceof Error) {
      if ('response' in error && typeof error.response === 'object' && error.response) {
        const resp = error.response as Record<string, unknown>;
        const detail = resp.data && typeof resp.data === 'object' && 'detail' in resp.data ? (resp.data as Record<string, unknown>).detail : 'Unknown error';
        throw new Error(`FastAPI error: ${detail}`);
      }
      throw error;
    }
    throw new Error('Unknown scrape error');
  }
}

export async function searchProductCandidates(productName: string) {
  const response = await pythonClient.post<{ query: string; total: number; results: SearchCandidate[] }>('/search-products', {
    product_name: productName
  });
  return response.data.results;
}

export async function analyzeReviewList(reviews: ScrapeReview[]) {
  const response = await pythonClient.post<ReviewAnalysis>('/analyze-reviews', { reviews });
  console.log(response.data)
  return response.data;
}

export async function predictPrice(history: PriceHistoryPoint[]) {
  const response = await pythonClient.post<PricePrediction>('/predict-price', { history });
  console.log(response.data)
  return response.data;
}

export async function captureScreenshot(input: string | { url?: string; productName?: string }) {
  const payload = typeof input === 'string' ? { url: input } : { url: input.url ?? '', product_name: input.productName ?? '' };
  const response = await pythonClient.post<ScreenshotResponse>('/capture-screenshot', payload);
  return response.data;
}

export async function detectOcrPrice(input: { imageUrl?: string; imageBase64?: string }) {
  const response = await pythonClient.post<OcrResponse>('/ocr-price', { image_url: input.imageUrl ?? '', image_base64: input.imageBase64 ?? '' });
  return response.data;
}
