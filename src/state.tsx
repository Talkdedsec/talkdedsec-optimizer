import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Api, AppInfo, Lang, RunResult, ScanResult, Settings } from "../shared/types.ts";
import { type Dict, DICTS } from "./i18n.ts";
import { Spinner } from "./ui.tsx";

declare global {
  interface Window { api: Api }
}

interface Ctx {
  d: Dict;
  lang: Lang;
  info: AppInfo;
  settings: Settings;
  applied: Set<string>;
  /** Already in place on this PC, but not applied by this app: there is no backup to undo them with. */
  active: Set<string>;
  patch(p: Partial<Settings>): Promise<void>;
  runScan(): Promise<ScanResult>;
  apply(ids: string[]): Promise<RunResult>;
  revert(ids: string[]): Promise<RunResult>;
}

const AppContext = createContext<Ctx | null>(null);
export const useApp = () => useContext(AppContext)!;

export function AppProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  const [detected, setDetected] = useState<Set<string>>(new Set());
  const refreshApplied = useCallback(async () => {
    setApplied(new Set(await window.api.applied()));
    setDetected(new Set(await window.api.detected()));
  }, []);
  useEffect(() => {
    void window.api.info().then(setInfo);
    void window.api.settings.read().then(setSettings);
    void refreshApplied();
  }, [refreshApplied]);
  useEffect(() => {
    if (settings) document.documentElement.lang = settings.lang;
  }, [settings]);

  const value = useMemo<Ctx | null>(() => {
    if (!info || !settings) return null;
    return {
      d: DICTS[settings.lang],
      lang: settings.lang,
      info,
      settings,
      applied,
      active: new Set([...detected].filter((id) => !applied.has(id))),
      patch: async (p) => setSettings(await window.api.settings.write(p)),
      runScan: async () => {
        const lastScan = await window.api.scan();
        setSettings((s) => s && { ...s, lastScan });
        return lastScan;
      },
      // refresh even when the call throws: some tweaks may have landed before the failure
      apply: (ids) => window.api.apply(ids).finally(refreshApplied),
      revert: (ids) => window.api.revert(ids).finally(refreshApplied),
    };
  }, [info, settings, applied, detected, refreshApplied]);

  if (!value) return <div className="relative z-10 grid h-full place-items-center"><Spinner className="size-6" /></div>;
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
