export type Lang = "tr" | "en";
export type Impact = "safe" | "moderate" | "advanced";
export const CATEGORIES = [
  "performance", "gaming", "memory", "services", "network", "privacy",
  "visual", "display", "input", "power", "storage", "maintenance",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type Action =
  | { kind: "registry"; hive: "HKLM" | "HKCU"; key: string; name: string; type: "REG_DWORD" | "REG_SZ" | "REG_BINARY"; value: number | string }
  | { kind: "service"; service: string; startup: string; stop?: boolean }
  | { kind: "powershell"; script: string; revert?: string };

export interface Requires {
  minWindowsBuild?: number;
  desktopOnly?: boolean;
  laptopOnly?: boolean;
  ssdOnly?: boolean;
  minRamGb?: number;
  noPrinter?: boolean;
  noBluetooth?: boolean;
}

export interface Tweak {
  id: string;
  category: Category;
  impact: Impact;
  elevated?: boolean;
  reversible: boolean;
  requiresRestart?: boolean;
  requires?: Requires;
  actions: Action[];
}

/** State captured before a change, enough to put it back. */
export type BackupEntry =
  | { kind: "registry"; path: string; name: string; type: string; existed: boolean; value: unknown }
  | { kind: "service"; service: string; startMode: string }
  | { kind: "powershell"; index: number };

export interface Profile {
  hostname: string;
  osName: string;
  osBuild: number;
  cpuName: string;
  cpuCores: number;
  cpuThreads: number;
  ramTotalGb: number;
  ramFreeGb: number;
  gpus: { name: string; vramGb: number }[];
  disks: { name: string; type: "SSD" | "HDD" | "Unknown"; sizeGb: number; system: boolean }[];
  systemDriveType: "SSD" | "HDD" | "Unknown";
  systemDriveFreeGb: number;
  systemDriveTotalGb: number;
  chassis: "Laptop" | "Desktop";
  hasPrinter: boolean;
  hasBluetooth: boolean;
  powerPlan: string;
  powerSaving: boolean;
  display: { width: number; height: number; refreshHz: number } | null;
  uptimeHours: number;
  pendingReboot: boolean;
  startupItems: number;
  scannedAt: string;
}

export type SkipReason = { code: "build" | "desktop" | "laptop" | "ssd" | "ram" | "printer" | "bluetooth"; need?: number; have?: number };
export type Finding = {
  level: "good" | "warn" | "bad";
  code: "diskCritical" | "diskLow" | "hdd" | "lowRam" | "startup" | "pendingReboot" | "uptime" | "powerPlan" | "refresh" | "allGood";
  value?: number | string;
};

export interface ScanResult {
  profile: Profile;
  recommended: string[];
  skipped: { id: string; reason: SkipReason }[];
  score: number;
  findings: Finding[];
}

/** error is a message from Windows, or one of: needs-admin, no-result, no-backup, one-way */
export interface TweakResult { id: string; ok: boolean; error?: string; skipped?: boolean }
export interface RunResult {
  results: TweakResult[];
  applied: number;
  failed: number;
  totalMs: number;
  restorePoint: boolean;
  requiresRestart: boolean;
}

export interface Settings { lang: Lang; createRestorePoint: boolean; lastScan: ScanResult | null }
export interface AppInfo { version: string; elevated: boolean }

export interface Api {
  info(): Promise<AppInfo>;
  settings: { read(): Promise<Settings>; write(patch: Partial<Settings>): Promise<Settings> };
  scan(): Promise<ScanResult>;
  applied(): Promise<string[]>;
  apply(ids: string[]): Promise<RunResult>;
  revert(ids: string[]): Promise<RunResult>;
  flushRam(): Promise<{ freedGb: number; trimmed: number; standbyPurged: boolean }>;
  deepClean(): Promise<{ freedMb: number }>;
  restorePoint(): Promise<boolean>;
  restartWindows(): Promise<void>;
  openExternal(url: string): Promise<void>;
  window: {
    minimize(): void;
    toggleMaximize(): void;
    close(): void;
    onMaximize(cb: (maximized: boolean) => void): () => void;
  };
}
