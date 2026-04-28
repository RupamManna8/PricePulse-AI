import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, GlassCard, PageLoader } from '../components/ui';
import { fetchUserSettings, updateUserSettings, UserSettings } from '../lib/api';

export function SettingsPage() {
  const { isSignedIn, user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>({
    autoScrapeGlobal: false,
    autoScrapeInterval: '6h',
    notificationsEnabled: true,
    alertThresholds: {
      priceDropPercent: 10,
      sentimentShiftScore: 20
    },
    currency: 'INR',
    theme: 'dark'
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      if (!isSignedIn) {
        setLoadingSettings(false);
        return;
      }

      try {
        const data = await fetchUserSettings();
        if (active) {
          setSettings(data);
          localStorage.setItem('pp_currency', data.currency || 'INR');
        }
      } finally {
        if (active) {
          setLoadingSettings(false);
        }
      }
    }

    void loadSettings();
    return () => {
      active = false;
    };
  }, [isSignedIn]);

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateUserSettings(settings);
      setSettings(updated);
      localStorage.setItem('pp_currency', updated.currency || 'INR');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <GlassCard className="space-y-4 p-8">
          <h2 className="text-xl font-semibold">Sign in Required</h2>
          <p className="text-muted">Please sign in to access settings.</p>
        </GlassCard>
      </div>
    );
  }

  if (loadingSettings) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <PageLoader message="Loading your profile settings" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold mb-2">Settings</h1>
        <p className="text-muted">Manage your account preferences and monitoring settings.</p>
      </div>

      {/* Account Info */}
      <GlassCard className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">Account Information</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-sm text-muted mb-1">Email</div>
            <div className="font-medium">{user?.email || 'N/A'}</div>
          </div>
          <div>
            <div className="text-sm text-muted mb-1">Name</div>
            <div className="font-medium">{user?.fullName || 'N/A'}</div>
          </div>
        </div>
      </GlassCard>

      {/* Auto-Scraping Settings */}
      <GlassCard className="p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Automatic Monitoring</h2>
          <p className="text-sm text-muted">Configure how frequently the system monitors competitor prices.</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-black/30 p-4">
            <div className="flex-1">
              <div className="font-medium">Enable Auto-Monitoring</div>
              <div className="text-sm text-muted">Automatically check competitor prices on schedule</div>
            </div>
            <label className="relative flex items-center cursor-pointer ml-4">
              <input
                type="checkbox"
                checked={settings.autoScrapeGlobal}
                onChange={(e) => setSettings({
                  ...settings,
                  autoScrapeGlobal: e.target.checked
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          {settings.autoScrapeGlobal && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">Monitoring Frequency</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['6h', '12h', '24h'] as const).map((interval) => (
                    <button
                      key={interval}
                      onClick={() => setSettings({ ...settings, autoScrapeInterval: interval })}
                      className={`rounded-lg border py-2 px-4 text-sm font-medium transition ${
                        settings.autoScrapeInterval === interval
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-black/30 text-text hover:border-primary/50'
                      }`}
                    >
                      Every {interval === '6h' ? '6 hours' : interval === '12h' ? '12 hours' : 'day'}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted bg-black/30 p-3 rounded-lg">
                💡 More frequent monitoring provides fresher insights but uses more API credits. Recommended: 12 hours for most use cases.
              </p>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Alert Settings */}
      <GlassCard className="p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Alert Thresholds</h2>
          <p className="text-sm text-muted">Set minimum changes to trigger notifications.</p>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="font-medium">Price Drop Alert Threshold</label>
              <span className="text-primary font-semibold">{settings.alertThresholds.priceDropPercent}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={settings.alertThresholds.priceDropPercent}
              onChange={(e) => setSettings({
                ...settings,
                alertThresholds: {
                  ...settings.alertThresholds,
                  priceDropPercent: Number(e.target.value)
                }
              })}
              className="w-full"
            />
            <p className="text-xs text-muted mt-2">Alert when competitor prices drop by {settings.alertThresholds.priceDropPercent}% or more</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="font-medium">Sentiment Shift Threshold</label>
              <span className="text-primary font-semibold">{settings.alertThresholds.sentimentShiftScore} points</span>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              step="5"
              value={settings.alertThresholds.sentimentShiftScore}
              onChange={(e) => setSettings({
                ...settings,
                alertThresholds: {
                  ...settings.alertThresholds,
                  sentimentShiftScore: Number(e.target.value)
                }
              })}
              className="w-full"
            />
            <p className="text-xs text-muted mt-2">Alert when review sentiment changes by {settings.alertThresholds.sentimentShiftScore} points</p>
          </div>
        </div>
      </GlassCard>

      {/* Notification Settings */}
      <GlassCard className="p-6 space-y-4">
        <h2 className="text-xl font-semibold mb-2">Notifications</h2>
        <div className="flex items-center justify-between rounded-lg border border-border bg-black/30 p-4">
          <div className="flex-1">
            <div className="font-medium">Enable Notifications</div>
            <div className="text-sm text-muted">Receive alerts for price changes and sentiment shifts</div>
          </div>
          <label className="relative flex items-center cursor-pointer ml-4">
            <input
              type="checkbox"
              checked={settings.notificationsEnabled}
              onChange={(e) => setSettings({
                ...settings,
                notificationsEnabled: e.target.checked
              })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </GlassCard>

      {/* Display Settings */}
      <GlassCard className="p-6 space-y-6">
        <h2 className="text-xl font-semibold mb-2">Display</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Currency</label>
            <select
              value={settings.currency}
              onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              className="w-full rounded-lg border border-border bg-black/30 px-4 py-3 text-text focus:border-primary focus:outline-none"
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Theme</label>
            <div className="grid grid-cols-2 gap-3">
              {(['light', 'dark'] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => setSettings({ ...settings, theme })}
                  className={`rounded-lg border py-2 px-4 text-sm font-medium transition capitalize ${
                    settings.theme === theme
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-black/30 text-text hover:border-primary/50'
                  }`}
                >
                  {theme === 'light' ? '☀️' : '🌙'} {theme}
                </button>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          loading={isSaving}
          onClick={handleSave}
        >
          Save Settings
        </Button>
        {saved && (
          <div className="flex items-center gap-2 text-success">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm">Settings saved</span>
          </div>
        )}
      </div>
    </div>
  );
}
