'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface FMContextValue {
  isReady: boolean;
  /**
   * Increments each time the SDK fetches configuration. Present so that changing a
   * flag in CloudBees Feature Management re-renders the tree without a page
   * reload — the SDK was already re-fetching, but React had no reason to run
   * getValue()/isEnabled() again, so the UI kept the values from first paint.
   *
   * Consumers do not need to read it. Its presence changes the context value's
   * identity, which is what triggers the re-render.
   */
  configVersion: number;
  isEnabled: (flagName: string, defaultValue?: boolean) => boolean;
  getValue: (configName: string, defaultValue: string | number) => string | number;
}

const FMContext = createContext<FMContextValue>({
  isReady: false,
  configVersion: 0,
  isEnabled: (_name, defaultValue = false) => defaultValue,
  getValue: (_name, defaultValue) => defaultValue,
});

export function useFM() {
  return useContext(FMContext);
}

let roxInstance: any = null;

export default function FMProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [configVersion, setConfigVersion] = useState(0);

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

        // Must match packages/shared/src/fm/flags.ts exactly — see the note there.
        const headerThemeFlag = new RoxBrowser.RoxString('default', ['default', 'dark', 'smb', 'branded']);
        RoxBrowser.register('recall', { headerTheme: headerThemeFlag });
        await RoxBrowser.setup(fmKey, {
          // The SDK polls for configuration; the default interval is a minute.
          // 30s keeps a live demo responsive without hammering the service.
          fetchIntervalInSec: 30,
          // Called after every fetch. Bumping state here is the whole fix: it
          // re-renders consumers so getValue() and isEnabled() run again against
          // the newly fetched configuration. Without it the SDK updated itself
          // and React had no reason to ask again, so the UI kept the values from
          // first paint until a reload.
          configurationFetchedHandler: () => {
            if (!cancelled) setConfigVersion(v => v + 1);
          },
        });

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
    configVersion,
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
