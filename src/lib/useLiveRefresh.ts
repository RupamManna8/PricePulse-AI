import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeToDataRefresh, type DataRefreshDetail } from './realtime';

type UseLiveRefreshOptions = {
  enabled?: boolean;
  intervalMs: number;
  immediate?: boolean;
};

export function useLiveRefresh(onRefresh: (detail?: DataRefreshDetail) => Promise<void>, options: UseLiveRefreshOptions) {
  const { enabled = true, intervalMs, immediate = true } = options;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const refresh = useCallback(
    async (detail?: DataRefreshDetail) => {
      if (inFlightRef.current) {
        return;
      }

      inFlightRef.current = true;
      setIsRefreshing(true);

      try {
        await onRefresh(detail);
        setLastRefreshedAt(new Date().toISOString());
      } finally {
        inFlightRef.current = false;
        setIsRefreshing(false);
      }
    },
    [onRefresh]
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (immediate) {
      void refresh({ source: 'initial', timestamp: new Date().toISOString() });
    }

    const unsubscribe = subscribeToDataRefresh((detail) => {
      void refresh(detail);
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refresh({ source: 'visibility', timestamp: new Date().toISOString() });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh({ source: 'poll', timestamp: new Date().toISOString() });
      }
    }, intervalMs);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [enabled, immediate, intervalMs, refresh]);

  return { isRefreshing, lastRefreshedAt, refresh };
}