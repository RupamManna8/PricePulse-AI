import { ApiProduct } from './api';

const STORAGE_KEY = 'pricepulse.product-overrides.v1';

type EditableProductFields = Pick<ApiProduct, 'name' | 'competitor' | 'category' | 'url' | 'availability' | 'latestPrice' | 'oldPrice' | 'rating' | 'reviewCount' | 'image'>;
export type ProductOverride = Partial<EditableProductFields>;

type ProductOverrideMap = Record<string, ProductOverride>;

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getProductOverrides(): ProductOverrideMap {
  if (!isBrowser()) {
    return {};
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    return parsed as ProductOverrideMap;
  } catch {
    return {};
  }
}

export function setProductOverride(productId: string, override: ProductOverride) {
  if (!isBrowser() || !productId) {
    return;
  }

  const current = getProductOverrides();
  current[productId] = {
    ...(current[productId] ?? {}),
    ...override
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}

export function applyProductOverride(product: ApiProduct): ApiProduct {
  const override = getProductOverrides()[product.id];
  if (!override) {
    return product;
  }

  return {
    ...product,
    ...override
  };
}

export function applyProductOverrides(products: ApiProduct[]): ApiProduct[] {
  const overrides = getProductOverrides();
  if (!Object.keys(overrides).length) {
    return products;
  }

  return products.map((product) => ({
    ...product,
    ...(overrides[product.id] ?? {})
  }));
}
