// Startup manager, uninstaller with leftover cleanup, and before/after metrics. No desktop-runtime imports, so tests can use it.
import type { InstalledApp, Leftover, Metrics, StartupItem } from "../shared/types.ts";
import { runJson } from "./ps.ts";

const list = <T,>(v: T[] | T | null | undefined): T[] => (Array.isArray(v) ? v : v ? [v] : []);
/** A PowerShell expression for an arbitrary string. Base64 keeps quotes of any kind out of the script text. */
export const psString = (s: string) => `([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(s, "utf8").toString("base64")}')))`;

export function isNewer(candidate: string, current: string): boolean {
  const parts = (v: string) => v.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const [a, b] = [parts(candidate), parts(current)];
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return false;
}

/* ---------- startup ---------- */

// Same switch Task Manager uses: a StartupApproved value whose first byte is odd means "disabled". The entry itself stays put.
const STARTUP_LIST = `
$out = @()
function Approved($root, $sub, $name) {
  $k = Get-Item -LiteralPath "$($root):\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\$sub" -ErrorAction SilentlyContinue
  if ($k -and ($k.GetValueNames() -contains $name)) { $b = $k.GetValue($name); if ($b -is [byte[]] -and $b.Length -gt 0) { return ($b[0] % 2 -eq 0) } }
  return $true
}
foreach ($s in @(@('HKCU','Software\\Microsoft\\Windows\\CurrentVersion\\Run','Run'), @('HKLM','Software\\Microsoft\\Windows\\CurrentVersion\\Run','Run'), @('HKLM','Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run','Run32'))) {
  $k = Get-Item -LiteralPath "$($s[0]):\\$($s[1])" -ErrorAction SilentlyContinue
  if (-not $k) { continue }
  foreach ($n in $k.GetValueNames()) {
    if (-not $n) { continue }
    $out += [ordered]@{ id = "$($s[0])|$($s[2])|$n"; name = $n; command = [string]$k.GetValue($n, '', 'DoNotExpandEnvironmentNames'); scope = $(if ($s[0] -eq 'HKCU') { 'user' } else { 'machine' }); source = 'registry'; enabled = (Approved $s[0] $s[2] $n) }
  }
}
foreach ($s in @(@('HKCU','Startup'), @('HKLM','CommonStartup'))) {
  $dir = [Environment]::GetFolderPath($s[1])
  if (-not $dir -or -not (Test-Path -LiteralPath $dir)) { continue }
  Get-ChildItem -LiteralPath $dir -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne 'desktop.ini' } | ForEach-Object {
    $out += [ordered]@{ id = "$($s[0])|StartupFolder|$($_.Name)"; name = $_.BaseName; command = $_.FullName; scope = $(if ($s[0] -eq 'HKCU') { 'user' } else { 'machine' }); source = 'folder'; enabled = (Approved $s[0] 'StartupFolder' $_.Name) }
  }
}
ConvertTo-Json @($out) -Compress -Depth 3`;

export const listStartup = async () => list(await runJson<StartupItem[]>(STARTUP_LIST));

/** null when the id is not one of ours */
export function parseStartupId(id: string): { root: "HKCU" | "HKLM"; sub: string; name: string } | null {
  const m = /^(HKCU|HKLM)\|(Run|Run32|StartupFolder)\|(.+)$/s.exec(id);
  return m ? { root: m[1] as "HKCU" | "HKLM", sub: m[2], name: m[3] } : null;
}

export async function setStartup(id: string, enabled: boolean): Promise<boolean> {
  const p = parseStartupId(id);
  if (!p) return false;
  return (await runJson<boolean>(`
try {
  $key = '${p.root}:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\${p.sub}'
  if (-not (Test-Path -LiteralPath $key)) { New-Item -Path $key -Force -ErrorAction Stop | Out-Null }
  $bytes = New-Object byte[] 12
  $bytes[0] = ${enabled ? 2 : 3}
  ${enabled ? "" : "[BitConverter]::GetBytes([DateTime]::UtcNow.ToFileTimeUtc()).CopyTo($bytes, 4)"}
  Set-ItemProperty -LiteralPath $key -Name ${psString(p.name)} -Value $bytes -Type Binary -ErrorAction Stop
  'true'
} catch { 'false' }`)) === true;
}

/* ---------- installed apps ---------- */

const APPS_LIST = `
$out = @()
foreach ($root in 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall', 'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall', 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall') {
  Get-ChildItem -LiteralPath $root -ErrorAction SilentlyContinue | ForEach-Object {
    $p = Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue
    if (-not $p -or -not $p.DisplayName -or $p.SystemComponent -eq 1 -or $p.ParentKeyName) { return }
    if (-not $p.UninstallString -and -not $p.QuietUninstallString) { return }
    $out += [ordered]@{ id = "reg|$($_.Name)"; kind = 'program'; name = [string]$p.DisplayName; publisher = [string]$p.Publisher; version = [string]$p.DisplayVersion; sizeMb = [math]::Round([double]$p.EstimatedSize / 1024, 1) }
  }
}
Get-AppxPackage -ErrorAction SilentlyContinue | Where-Object { -not $_.IsFramework -and -not $_.NonRemovable -and -not $_.IsResourcePackage -and $_.SignatureKind -ne 'System' } | ForEach-Object {
  $pub = if ($_.Publisher -match 'CN=([^,]+)') { $Matches[1] } else { '' }
  $out += [ordered]@{ id = "appx|$($_.PackageFullName)"; kind = 'store'; name = [string]$_.Name; publisher = $pub; version = [string]$_.Version; sizeMb = 0 }
}
ConvertTo-Json @($out) -Compress -Depth 3`;

export const listApps = async () => list(await runJson<InstalledApp[]>(APPS_LIST, 120_000)).sort((a, b) => a.name.localeCompare(b.name));

const REG_ID = /^reg\|HKEY_(LOCAL_MACHINE|CURRENT_USER)\\Software\\(WOW6432Node\\)?Microsoft\\Windows\\CurrentVersion\\Uninstall\\[^\\]+$/i;
const APPX_ID = /^appx\|[\w.\-~]+$/;
export const isAppId = (id: string) => REG_ID.test(id) || APPX_ID.test(id);

// Folder and key names that many programs share: never offered as a leftover, whatever the app is called.
const SHARED = new Set([
  "microsoft", "windows", "common files", "system", "system32", "programs", "program files", "temp", "packages", "google", "intel", "amd",
  "nvidia", "nvidia corporation", "adobe", "mozilla", "apple", "oracle", "java", "python", "steam", "valve", "default", "public", "users",
  "classes", "policies", "wow6432node", "appdata", "local", "roaming", "desktop", "documents", "downloads",
]);

/** The names a program's own folders and keys are likely to carry: its display name, with and without a trailing version or "(x64)". */
export function appNames(displayName: string): string[] {
  const full = displayName.trim();
  const short = full.replace(/(\s+(v?\d[\d.]*|\([^)]*\)|x64|x86|64-bit|32-bit))+\s*$/i, "").trim();
  return [...new Set([full, short])].filter((n) => n.length >= 3 && !SHARED.has(n.toLowerCase()) && !/[\\/:*?"<>|]/.test(n));
}

export interface LeftoverEnv { appData: string; localAppData: string; programData: string; programFiles: string; programFilesX86: string }

/** Where a removed program may have left things behind. Only paths whose last segment is the program's own name. */
export function leftoverCandidates(app: { name: string; publisher: string; location: string }, env: LeftoverEnv): { kind: Leftover["kind"]; path: string }[] {
  const names = appNames(app.name);
  const pub = app.publisher.trim();
  const out: { kind: Leftover["kind"]; path: string }[] = [];
  const bases = [env.appData, env.localAppData, env.programData, env.programFiles, env.programFilesX86].filter(Boolean);
  const loc = app.location.trim().replace(/^"|"$/g, "").replace(/[\\/]+$/, "");
  // The install folder counts only when it sits at least two levels below the drive and is named after the program.
  if (loc && loc.split(/[\\/]/).length >= 3 && names.some((n) => loc.toLowerCase().endsWith("\\" + n.toLowerCase()))) out.push({ kind: "folder", path: loc });
  for (const n of names) {
    for (const b of bases) {
      out.push({ kind: "folder", path: `${b}\\${n}` });
      if (pub && !/[\\/:*?"<>|]/.test(pub)) out.push({ kind: "folder", path: `${b}\\${pub}\\${n}` });
    }
    for (const hive of ["HKCU", "HKLM"]) {
      out.push({ kind: "registry", path: `${hive}:\\Software\\${n}` });
      if (pub && !/[\\/:*?"<>|]/.test(pub)) out.push({ kind: "registry", path: `${hive}:\\Software\\${pub}\\${n}` });
    }
  }
  const seen = new Set<string>();
  return out.filter((c) => !seen.has(c.path.toLowerCase()) && seen.add(c.path.toLowerCase()));
}

interface UninstallRaw { ok: boolean; error?: string; name?: string; publisher?: string; location?: string; env?: LeftoverEnv }

export async function uninstallApp(id: string): Promise<{ ok: boolean; error?: string; leftovers: Leftover[] }> {
  if (!isAppId(id)) return { ok: false, error: "bad-id", leftovers: [] };
  if (id.startsWith("appx|")) {
    const r = await runJson<UninstallRaw>(`
try { Remove-AppxPackage -Package ${psString(id.slice(5))} -ErrorAction Stop; '{"ok":true}' }
catch { ConvertTo-Json ([ordered]@{ ok = $false; error = $_.Exception.Message }) -Compress }`, 5 * 60_000);
    return { ok: !!r?.ok, error: r?.error, leftovers: [] };
  }
  // Uninstallers may need the user (their own wizard), so the wait is long. Many relaunch themselves and return early: poll for the key.
  const r = await runJson<UninstallRaw>(`
try {
  $key = 'Registry::' + ${psString(id.slice(4))}
  $p = Get-ItemProperty -LiteralPath $key -ErrorAction Stop
  $cmd = if ($p.QuietUninstallString) { [string]$p.QuietUninstallString } else { [string]$p.UninstallString }
  if ($cmd -match '(?i)msiexec' -and $cmd -match '\\{[0-9A-Fa-f-]{36}\\}') { $cmd = "msiexec.exe /x $($Matches[0]) /qb /norestart" }
  Start-Process -FilePath $env:ComSpec -ArgumentList '/d', '/s', '/c', ('"' + $cmd + '"') -Wait -WindowStyle Hidden
  for ($i = 0; $i -lt 20 -and (Test-Path -LiteralPath $key); $i++) { Start-Sleep -Milliseconds 500 }
  ConvertTo-Json ([ordered]@{
    ok = -not (Test-Path -LiteralPath $key); name = [string]$p.DisplayName; publisher = [string]$p.Publisher; location = [string]$p.InstallLocation
    env = [ordered]@{ appData = $env:APPDATA; localAppData = $env:LOCALAPPDATA; programData = $env:ProgramData; programFiles = $env:ProgramFiles; programFilesX86 = \${env:ProgramFiles(x86)} }
  }) -Compress -Depth 3
} catch { ConvertTo-Json ([ordered]@{ ok = $false; error = $_.Exception.Message }) -Compress }`, 20 * 60_000);
  if (!r?.ok) return { ok: false, error: r?.error ?? "still-installed", leftovers: [] };
  const candidates = leftoverCandidates({ name: r.name ?? "", publisher: r.publisher ?? "", location: r.location ?? "" }, r.env!);
  return { ok: true, leftovers: await existing(candidates) };
}

async function existing(candidates: { kind: Leftover["kind"]; path: string }[]): Promise<Leftover[]> {
  if (candidates.length === 0) return [];
  const rows = candidates.map((c, i) => `@(${i}, '${c.kind}', ${psString(c.path)})`).join(",\n");
  const found = list(await runJson<{ i: number; sizeMb: number }[]>(`
$out = @()
foreach ($c in @(
${rows}
)) {
  if (-not (Test-Path -LiteralPath $c[2])) { continue }
  $size = 0
  if ($c[1] -eq 'folder') { $size = [math]::Round(((Get-ChildItem -LiteralPath $c[2] -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum) / 1MB, 1) }
  $out += [ordered]@{ i = $c[0]; sizeMb = $size }
}
ConvertTo-Json @($out) -Compress`, 120_000));
  return found.map((f) => ({ id: String(f.i), ...candidates[f.i], sizeMb: f.sizeMb }));
}

/** Folders go to the Recycle Bin; registry keys are exported to backupDir first. Returns how many were removed. */
export async function removeLeftovers(items: Leftover[], backupDir: string): Promise<number> {
  if (items.length === 0) return 0;
  const rows = items.map((c) => `@('${c.kind}', ${psString(c.path)})`).join(",\n");
  return (await runJson<number>(`
Add-Type -AssemblyName Microsoft.VisualBasic
$backup = ${psString(backupDir)}
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$n = 0
foreach ($c in @(
${rows}
)) {
  try {
    if (-not (Test-Path -LiteralPath $c[1])) { continue }
    if ($c[0] -eq 'folder') {
      [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($c[1], 'OnlyErrorDialogs', 'SendToRecycleBin')
    } else {
      $native = $c[1] -replace '^HKCU:', 'HKEY_CURRENT_USER' -replace '^HKLM:', 'HKEY_LOCAL_MACHINE'
      $file = Join-Path $backup ("{0}-{1}.reg" -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $n)
      & reg.exe export $native $file /y | Out-Null
      if ($LASTEXITCODE -ne 0) { continue }
      Remove-Item -LiteralPath $c[1] -Recurse -Force -ErrorAction Stop
    }
    $n++
  } catch {}
}
$n`, 10 * 60_000)) ?? 0;
}

/* ---------- metrics ---------- */

export const measure = () => runJson<Metrics>(`
$os = Get-CimInstance Win32_OperatingSystem
ConvertTo-Json ([ordered]@{ freeRamMb = [math]::Round($os.FreePhysicalMemory / 1024); processes = @(Get-Process).Count; services = @(Get-Service | Where-Object { $_.Status -eq 'Running' }).Count }) -Compress`, 30_000);
