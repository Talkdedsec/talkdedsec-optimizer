// Pure logic: the catalog, the PowerShell it turns into, and the hardware analysis. No desktop runtime, no I/O.
import data from "../shared/tweaks.json" with { type: "json" };
import type { BackupEntry, Finding, Profile, ScanResult, SkipReason, Tweak } from "../shared/types.ts";

export const TWEAKS = data as Tweak[];
export const BY_ID = new Map(TWEAKS.map((t) => [t.id, t]));

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const HIVE = { HKLM: "HKEY_LOCAL_MACHINE", HKCU: "HKEY_CURRENT_USER" };
const REG_TYPE: Record<string, string> = { REG_DWORD: "DWord", REG_SZ: "String", REG_BINARY: "Binary" };
// shortcut: delayed auto-start comes back as plain Automatic, store DelayedAutoStart if that ever matters
const START_MODE: Record<string, string> = { Auto: "Automatic", Manual: "Manual", Disabled: "Disabled", Boot: "Boot", System: "System" };

/** A PowerShell literal for a registry value of the given PropertyType. */
export function psValue(type: string, value: unknown): string {
  if (type === "DWord" || type === "QWord") {
    const n = Number(value) || 0;
    // the registry provider wants a signed Int32 for DWord
    return String(type === "DWord" && n > 0x7fffffff ? n - 0x100000000 : n);
  }
  if (type === "Binary") {
    const bytes = Array.isArray(value) ? value.map(Number) : (String(value ?? "").match(/[0-9a-f]{2}/gi) ?? []).map((h) => parseInt(h, 16));
    return `([byte[]]@(${bytes.join(",")}))`;
  }
  if (type === "MultiString") return `([string[]]@(${(Array.isArray(value) ? value : [value]).map((v) => q(String(v ?? ""))).join(",")}))`;
  return q(String(value ?? ""));
}

const HEAD = "$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';$results=@()";
const TAIL = "ConvertTo-Json -InputObject @($results) -Depth 6 -Compress";

const APPLY_HELPERS = `
function Reg($r,$p,$n,$v,$t){
  $ex=$false;$prev=$null;$pt=$t
  $k=Get-Item -LiteralPath $p -ErrorAction SilentlyContinue
  if($k){if($k.GetValueNames() -contains $n){$ex=$true;$prev=$k.GetValue($n,$null,'DoNotExpandEnvironmentNames');$pt="$($k.GetValueKind($n))"}}
  else{New-Item -Path $p -Force|Out-Null}
  $r.previous+=,([ordered]@{kind='registry';path=$p;name=$n;type=$pt;existed=$ex;value=$prev})
  New-ItemProperty -LiteralPath $p -Name $n -Value $v -PropertyType $t -Force|Out-Null
}
function Svc($r,$s,$mode,$stop){
  $c=Get-CimInstance Win32_Service -Filter "Name='$s'" -ErrorAction SilentlyContinue
  if(-not $c){return}
  $r.previous+=,([ordered]@{kind='service';service=$s;startMode=$c.StartMode})
  if($stop){Stop-Service -Name $s -Force -ErrorAction SilentlyContinue}
  Set-Service -Name $s -StartupType $mode
}`;

// Catalog scripts lean on native tools and "2>$null"; under 'Stop' PowerShell 5.1 turns that stderr into a fatal error.
const block = (script: string) => `& { $ErrorActionPreference='Continue'; ${script} }`;

/** One script that applies every tweak and prints, per tweak, what it changed and what was there before. */
export function applyScript(tweaks: Tweak[]): string {
  const body = tweaks.map((t) => {
    const lines = t.actions.map((a, i) => {
      if (a.kind === "registry") {
        const type = REG_TYPE[a.type];
        return `Reg $r ${q(`Registry::${HIVE[a.hive]}\\${a.key.replace(/\//g, "\\")}`)} ${q(a.name)} ${psValue(type, a.value)} ${q(type)}`;
      }
      if (a.kind === "service") return `Svc $r ${q(a.service)} ${q(a.startup)} $${a.stop ? "true" : "false"}`;
      return `$r.previous+=,([ordered]@{kind='powershell';index=${i}})\n${block(a.script)}`;
    });
    return [
      `$r=[ordered]@{id=${q(t.id)};ok=$true;error='';skipped=$false;previous=@()}`,
      "try{",
      ...lines,
      "if($r.previous.Count -eq 0){$r.skipped=$true}", // every service it targets is missing on this PC
      '}catch{$r.ok=$false;$r.error="$($_.Exception.Message)"}',
      "$results+=,$r",
    ].join("\n");
  });
  return [HEAD, APPLY_HELPERS, ...body, TAIL].join("\n");
}

/** One script that restores saved state, newest change first. */
export function revertScript(items: { tweak: Tweak; entries: BackupEntry[] }[]): string {
  const body = items.map(({ tweak, entries }) => {
    const lines = [...entries].reverse().map((e) => {
      if (e.kind === "registry") {
        const p = q(e.path), n = q(e.name);
        if (!e.existed) return `Remove-ItemProperty -LiteralPath ${p} -Name ${n} -Force -ErrorAction SilentlyContinue`;
        return `if(-not(Test-Path -LiteralPath ${p})){New-Item -Path ${p} -Force|Out-Null}\nNew-ItemProperty -LiteralPath ${p} -Name ${n} -Value ${psValue(e.type, e.value)} -PropertyType ${q(e.type)} -Force|Out-Null`;
      }
      if (e.kind === "service") return `Set-Service -Name ${q(e.service)} -StartupType ${q(START_MODE[e.startMode] ?? "Manual")}`;
      const a = tweak.actions[e.index];
      return a?.kind === "powershell" && a.revert ? block(a.revert) : "";
    });
    return [
      `$r=[ordered]@{id=${q(tweak.id)};ok=$true;error=''}`,
      "try{",
      ...lines,
      '}catch{$r.ok=$false;$r.error="$($_.Exception.Message)"}',
      "$results+=,$r",
    ].join("\n");
  });
  return [HEAD, ...body, TAIL].join("\n");
}

const DETECT_HELPERS = `
$svc=@{};Get-CimInstance Win32_Service|ForEach-Object{$svc[$_.Name]=$_.StartMode}
function Has($p,$n,$v){
  $k=Get-Item -LiteralPath $p -ErrorAction SilentlyContinue
  if(-not $k -or $k.GetValueNames() -notcontains $n){return $false}
  $c=$k.GetValue($n,$null,'DoNotExpandEnvironmentNames')
  if($v -is [byte[]]){return ($c -is [byte[]]) -and (($c -join ',') -eq ($v -join ','))}
  return "$c" -eq "$v"
}
function Off($s){-not $svc.ContainsKey($s) -or $svc[$s] -eq 'Disabled'}
function Any($names){@($names|Where-Object{$svc.ContainsKey($_)}).Count -gt 0}`;

/**
 * One read-only script that prints the ids of the tweaks already in place on this PC, whoever made them.
 * A tweak with a PowerShell step is never listed: there is nothing to compare its effect with.
 */
export function detectScript(tweaks: Tweak[]): string {
  const body = tweaks.filter((t) => t.actions.every((a) => a.kind !== "powershell")).map((t) => {
    const checks = t.actions.map((a) => {
      if (a.kind === "registry") return `(Has ${q(`Registry::${HIVE[a.hive]}\\${a.key.replace(/\//g, "\\")}`)} ${q(a.name)} (${psValue(REG_TYPE[a.type], a.value)}))`;
      return a.kind === "service" ? `(Off ${q(a.service)})` : "";
    });
    // A service this PC does not have counts as off, but it cannot be the only evidence.
    const services = t.actions.flatMap((a) => (a.kind === "service" ? [q(a.service)] : []));
    if (services.length === t.actions.length) checks.push(`(Any @(${services.join(",")}))`);
    return `if(${checks.join(" -and ")}){$ids+=${q(t.id)}}`;
  });
  return ["$ErrorActionPreference='SilentlyContinue';$ids=@()", DETECT_HELPERS, ...body, "ConvertTo-Json -InputObject @($ids) -Compress"].join("\n");
}

/** Why a tweak does not fit this machine, or null when it does. */
export function skipReason(t: Tweak, p: Profile): SkipReason | null {
  const r = t.requires;
  if (!r) return null;
  if (r.minWindowsBuild && p.osBuild < r.minWindowsBuild) return { code: "build", need: r.minWindowsBuild, have: p.osBuild };
  if (r.desktopOnly && p.chassis === "Laptop") return { code: "desktop" };
  if (r.laptopOnly && p.chassis !== "Laptop") return { code: "laptop" };
  if (r.ssdOnly && p.systemDriveType !== "SSD") return { code: "ssd" };
  if (r.minRamGb && p.ramTotalGb < r.minRamGb) return { code: "ram", need: r.minRamGb, have: p.ramTotalGb };
  if (r.noPrinter && p.hasPrinter) return { code: "printer" };
  if (r.noBluetooth && p.hasBluetooth) return { code: "bluetooth" };
  return null;
}

const freeRatio = (p: Profile) => (p.systemDriveTotalGb > 0 ? p.systemDriveFreeGb / p.systemDriveTotalGb : 1);

/** Safe reversible tweaks always qualify (100). Moderate ones (60) need a hardware reason to reach the bar of 80. */
function score(t: Tweak, p: Profile): number {
  if (t.impact === "advanced" || !t.reversible) return 0;
  let s = t.impact === "safe" ? 100 : 60;
  const c = t.category;
  if (p.ramTotalGb <= 8 && (c === "privacy" || c === "services" || c === "memory")) s += 30;
  if (p.cpuThreads <= 4 && (c === "visual" || c === "services")) s += 30;
  if (p.systemDriveType === "HDD" && c === "storage") s += 30;
  if (freeRatio(p) < 0.15 && c === "storage") s += 40;
  if (p.chassis === "Desktop" && (c === "gaming" || c === "power")) s += 20;
  return s;
}

function findings(p: Profile): Finding[] {
  const f: Finding[] = [];
  const free = Math.round(freeRatio(p) * 100);
  if (free < 10) f.push({ level: "bad", code: "diskCritical", value: free });
  else if (free < 20) f.push({ level: "warn", code: "diskLow", value: free });
  if (p.systemDriveType === "HDD") f.push({ level: "bad", code: "hdd" });
  if (p.ramTotalGb <= 8) f.push({ level: "warn", code: "lowRam", value: p.ramTotalGb });
  if (p.startupItems > 12) f.push({ level: "warn", code: "startup", value: p.startupItems });
  if (p.pendingReboot) f.push({ level: "warn", code: "pendingReboot" });
  if (p.uptimeHours > 72) f.push({ level: "warn", code: "uptime", value: Math.round(p.uptimeHours) });
  if (p.powerSaving) f.push({ level: "warn", code: "powerPlan", value: p.powerPlan });
  if (p.display && p.display.refreshHz > 0 && p.display.refreshHz < 70 && p.display.width >= 1920) f.push({ level: "warn", code: "refresh", value: p.display.refreshHz });
  if (f.length === 0) f.push({ level: "good", code: "allGood" });
  return f;
}

export function analyze(p: Profile): ScanResult {
  const skipped: ScanResult["skipped"] = [];
  const ranked: { id: string; s: number }[] = [];
  for (const t of TWEAKS) {
    const reason = skipReason(t, p);
    if (reason) skipped.push({ id: t.id, reason });
    else {
      const s = score(t, p);
      if (s >= 80) ranked.push({ id: t.id, s });
    }
  }
  ranked.sort((a, b) => b.s - a.s);
  const found = findings(p);
  const penalty = found.reduce((n, x) => n + (x.level === "bad" ? 18 : x.level === "warn" ? 8 : 0), 0);
  return { profile: p, recommended: ranked.map((x) => x.id), skipped, score: Math.max(5, 100 - penalty), findings: found };
}
