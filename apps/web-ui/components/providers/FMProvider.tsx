'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface FMContextValue {
  isReady: boolean;
  isEnabled: (flagName: string, defaultValue?: boolean) => boolean;
  getValue: (configName: string, defaultValue: string | number) => string | number;
}

const FMContext = createContext<FMContextValue>({
  isReady: false,
  isEnabled: (_name, defaultValue = false) => defaultValue,
  getValue: (_name, defaultValue) => defaultValue,
});

export function useFM() {
  return useContext(FMContext);
}

let roxInstance: any = null;

export default function FMProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const urlToken = new URLSearchParams(window.location.search).get('token');
        const configUrl = urlToken ? `/api/fm-config?token=${encodeURIComponent(urlToken)}` : '/api/fm-config';
        const res = await fetch(configUrl);
        const { fmKey, props } = await res.json();
        if (!fmKey || cancelled) return;

        const RoxBrowser = (await import('rox-browser')).default;

        if (props) {
          for (const [key, value] of Object.entries(props)) {
            if (typeof value === 'string') RoxBrowser.setCustomStringProperty(key, value);
            else if (typeof value === 'number') RoxBrowser.setCustomNumberProperty(key, value);
            else if (typeof value === 'boolean') RoxBrowser.setCustomBooleanProperty(key, value);
          }
        }

        if (typeof localStorage !== 'undefined') {
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('lscache-')) localStorage.removeItem(key);
          });
        }

        const headerThemeFlag = new RoxBrowser.RoxString('default', ['default', 'smb']);
        RoxBrowser.register('recall', { headerTheme: headerThemeFlag });
        await RoxBrowser.setup(fmKey);

        if (!cancelled) {
          roxInstance = RoxBrowser;
          setIsReady(true);
        }
      } catch (err) {
        console.warn('[FM] Client-side init failed:', err);
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  const contextValue: FMContextValue = {
    isReady,
    isEnabled: (flagName: string, defaultValue = false): boolean => {
      if (!roxInstance) return defaultValue;
      try { return roxInstance.dynamicApi.isEnabled(flagName, defaultValue); }
      catch { return defaultValue; }
    },
    getValue: (configName: string, defaultValue: string | number): string | number => {
      if (!roxInstance) return defaultValue;
      try { return roxInstance.dynamicApi.value(configName, String(defaultValue)); }
      catch { return defaultValue; }
    },
  };

  return <FMContext.Provider value={contextValue}>{children}</FMContext.Provider>;
}
