'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';

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

/**
 * Custom properties are what targeting rules read. They live on the SDK instance,
 * so they must be re-applied whenever the identity changes.
 */
function applyProps(rox: any, props: Record<string, unknown> | undefined | null) {
  if (!props) return;
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string') rox.setCustomStringProperty(key, value);
    else if (typeof value === 'number') rox.setCustomNumberProperty(key, value);
    else if (typeof value === 'boolean') rox.setCustomBooleanProperty(key, value);
  }
}

export default function FMProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [configVersion, setConfigVersion] = useState(0);
  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? null;

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

        applyProps(RoxBrowser, props);

        if (typeof localStorage !== 'undefined') {
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('lscache-')) localStorage.removeItem(key);
          });
        }

        // Must match packages/shared/src/fm/flags.ts exactly — see the note there.
        const headerThemeFlag = new RoxBrowser.RoxString('default', ['default', 'dark', 'vibrant', 'branded']);
        RoxBrowser.register('recall', { headerTheme: headerThemeFlag });
        await RoxBrowser.setup(fmKey, {
          // Changes arrive over Server-Sent Events, so they propagate within a
          // second or two of being saved in the UI — not on this interval. This is
          // only the fallback poll for when the SSE connection is unavailable.
          //
          // Measured at ~2s in practice. Module 07 can therefore promise "watch it
          // change" rather than asking attendees to wait or reload.
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

  // Signing in does not remount this provider: NextAuth updates the session and the
  // app navigates client-side, so the SDK keeps the properties fetched for whoever
  // was here before -- usually nobody. Any flag targeted on companySize, email or
  // isLoggedIn therefore evaluated against an anonymous context until a full reload.
  //
  // The visible symptom was "headerTheme stays on default until I refresh", but it
  // applied to every targeted flag, not just the theme.
  //
  // Re-fetching properties on an identity change is enough: Rox evaluates locally
  // against whatever properties are set, so setup() must NOT run again. Bumping
  // configVersion re-runs the evaluations.
  useEffect(() => {
    if (!isReady || !roxInstance) return;
    if (status === 'loading') return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/fm-config');
        const { props } = await res.json();
        if (cancelled) return;
        applyProps(roxInstance, props);
        setConfigVersion(v => v + 1);
      } catch (err) {
        console.warn('[FM] Could not refresh targeting properties:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [isReady, status, userId]);

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
