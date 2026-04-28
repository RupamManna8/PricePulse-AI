export type DataRefreshDetail = {
  source: string;
  scope?: string;
  id?: string;
  timestamp: string;
};

export const DATA_REFRESH_EVENT = 'pricepulse:data-refresh';
const BROADCAST_CHANNEL = 'pricepulse:data-refresh';

function canUseDom() {
  return typeof window !== 'undefined';
}

export function emitDataRefresh(detail: Omit<DataRefreshDetail, 'timestamp'>) {
  if (!canUseDom()) {
    return;
  }

  const payload: DataRefreshDetail = {
    ...detail,
    timestamp: new Date().toISOString()
  };

  window.dispatchEvent(new CustomEvent<DataRefreshDetail>(DATA_REFRESH_EVENT, { detail: payload }));

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(BROADCAST_CHANNEL);
    channel.postMessage(payload);
    channel.close();
  }
}

export function scheduleDataRefresh(detail: Omit<DataRefreshDetail, 'timestamp'>) {
  if (!canUseDom()) {
    return;
  }

  window.setTimeout(() => {
    emitDataRefresh(detail);
  }, 0);
}

export function subscribeToDataRefresh(handler: (detail: DataRefreshDetail) => void) {
  if (!canUseDom()) {
    return () => undefined;
  }

  const handleWindowEvent = (event: Event) => {
    const customEvent = event as CustomEvent<DataRefreshDetail>;
    if (customEvent.detail) {
      handler(customEvent.detail);
    }
  };

  window.addEventListener(DATA_REFRESH_EVENT, handleWindowEvent as EventListener);

  let channel: BroadcastChannel | null = null;
  const handleChannelMessage = (event: MessageEvent<DataRefreshDetail>) => {
    if (event.data) {
      handler(event.data);
    }
  };

  if ('BroadcastChannel' in window) {
    channel = new BroadcastChannel(BROADCAST_CHANNEL);
    channel.addEventListener('message', handleChannelMessage as EventListener);
  }

  return () => {
    window.removeEventListener(DATA_REFRESH_EVENT, handleWindowEvent as EventListener);
    if (channel) {
      channel.removeEventListener('message', handleChannelMessage as EventListener);
      channel.close();
    }
  };
}