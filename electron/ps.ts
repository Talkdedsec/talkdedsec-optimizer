// Everything that touches Windows goes through PowerShell here. No Electron imports, so tests can use it.
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Profile } from "../shared/types.ts";

const PRELUDE = "[Console]::OutputEncoding=[Text.Encoding]::UTF8;$ProgressPreference='SilentlyContinue';";

/** Runs a script from a temp file: a long apply script does not fit on a command line. */
export async function runPs(script: string, timeoutMs = 60_000): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const dir = await mkdtemp(join(tmpdir(), "tlk-opt-"));
  const file = join(dir, "run.ps1");
  await writeFile(file, "﻿" + PRELUDE + script, "utf8"); // BOM: PowerShell 5.1 reads BOM-less files as ANSI
  try {
    return await new Promise((resolve) => {
      const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", file], { windowsHide: true });
      let stdout = "", stderr = "";
      child.stdout.on("data", (d) => (stdout += d));
      child.stderr.on("data", (d) => (stderr += d));
      const timer = setTimeout(() => child.kill(), timeoutMs);
      const done = (code: number | null, err = "") => {
        clearTimeout(timer);
        resolve({ ok: code === 0, stdout: stdout.trim(), stderr: (err || stderr).trim() });
      };
      child.on("error", (e) => done(null, e.message));
      child.on("close", (code) => done(code));
    });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Runs a script whose last output is JSON. Null when it printed none. */
export async function runJson<T>(script: string, timeoutMs?: number): Promise<T | null> {
  const { stdout } = await runPs(script, timeoutMs);
  const start = stdout.search(/[[{]|true|false|\d/);
  if (start < 0) return null;
  try {
    return JSON.parse(stdout.slice(start)) as T;
  } catch {
    return null;
  }
}

export const isElevated = async () =>
  (await runJson<boolean>(
    "([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)|ConvertTo-Json",
    15_000,
  )) === true;

const SCAN = String.raw`
$ErrorActionPreference='SilentlyContinue'
$os=Get-CimInstance Win32_OperatingSystem
$cs=Get-CimInstance Win32_ComputerSystem
$cpu=@(Get-CimInstance Win32_Processor)[0]
$video=@(Get-CimInstance Win32_VideoController)
$o=[ordered]@{}
$o.hostname=$env:COMPUTERNAME
$o.osName=$os.Caption
$o.osBuild=[int]$os.BuildNumber
$o.uptimeHours=[math]::Round(((Get-Date)-$os.LastBootUpTime).TotalHours,1)
$o.cpuName=($cpu.Name -replace '\s+',' ').Trim()
$o.cpuCores=[int]$cpu.NumberOfCores
$o.cpuThreads=[int]$cpu.NumberOfLogicalProcessors
$o.ramTotalGb=[math]::Round($cs.TotalPhysicalMemory/1GB,1)
$o.ramFreeGb=[math]::Round($os.FreePhysicalMemory*1KB/1GB,1)

# AdapterRAM is 32-bit and caps at 4 GB; the driver's own 64-bit figure is right when present.
$class=@(Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}')
$o.gpus=@(foreach($v in $video){
  $vram=0
  $key=$class|Where-Object{$_.GetValue('DriverDesc') -eq $v.Name}|Select-Object -First 1
  if($key){$qw=$key.GetValue('HardwareInformation.qwMemorySize');if($qw -is [long] -or $qw -is [int]){$vram=[math]::Round($qw/1GB,1)}}
  if($vram -eq 0 -and $v.AdapterRAM -gt 0){$vram=[math]::Round($v.AdapterRAM/1GB,1)}
  [ordered]@{name=$v.Name;vramGb=$vram}
})
$d=$video|Where-Object{$_.CurrentHorizontalResolution}|Select-Object -First 1
$o.display=if($d){[ordered]@{width=[int]$d.CurrentHorizontalResolution;height=[int]$d.CurrentVerticalResolution;refreshHz=[int]$d.CurrentRefreshRate}}else{$null}

$letter=$env:SystemDrive.TrimEnd(':')
$sysDisk=-1
$part=Get-Partition -DriveLetter $letter
if($part){$sysDisk=[int]$part.DiskNumber}
$o.systemDriveType='Unknown'
$o.disks=@(foreach($pd in Get-PhysicalDisk){
  $type=if($pd.MediaType -eq 'SSD' -or $pd.BusType -eq 'NVMe'){'SSD'}elseif($pd.MediaType -eq 'HDD'){'HDD'}else{'Unknown'}
  $isSys=([int]$pd.DeviceId -eq $sysDisk)
  if($isSys){$o.systemDriveType=$type}
  [ordered]@{name=$pd.FriendlyName;type=$type;sizeGb=[math]::Round($pd.Size/1GB,0);system=$isSys}
})
$vol=Get-Volume -DriveLetter $letter
$o.systemDriveFreeGb=if($vol){[math]::Round($vol.SizeRemaining/1GB,1)}else{0}
$o.systemDriveTotalGb=if($vol){[math]::Round($vol.Size/1GB,1)}else{0}

$portable=8,9,10,11,12,14,18,21,30,31,32
$types=@((Get-CimInstance Win32_SystemEnclosure).ChassisTypes)
$battery=@(Get-CimInstance Win32_Battery).Count -gt 0
$o.chassis=if(($types|Where-Object{$portable -contains [int]$_}) -or (-not $types -and $battery)){'Laptop'}else{'Desktop'}
$o.hasPrinter=@(Get-Printer|Where-Object{$_.Name -notmatch 'Microsoft|OneNote|Fax|PDF|XPS'}).Count -gt 0
$o.hasBluetooth=@(Get-PnpDevice -Class Bluetooth -Status OK).Count -gt 0

# GUIDs, not names: the names are localized.
$plan=(powercfg /getactivescheme|Out-String)
$o.powerPlan=[regex]::Match($plan,'\((.+)\)').Groups[1].Value
$o.powerSaving=$plan -match '381b4222-f694-41f0-9685-ff5bb260df2e|a1841308-3541-4fab-bc81-f71556f20b4a'
$o.pendingReboot=(Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending') -or (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired')
$o.startupItems=@(Get-CimInstance Win32_StartupCommand).Count
$o|ConvertTo-Json -Depth 4 -Compress
`;

export async function scanHardware(): Promise<Profile> {
  const p = await runJson<Profile>(SCAN, 90_000);
  if (!p || typeof p.osBuild !== "number") throw new Error("scan-failed");
  // PowerShell 5.1 unwraps one-element arrays in some shapes; normalise.
  const list = <T,>(v: T[] | T | null | undefined): T[] => (Array.isArray(v) ? v : v ? [v] : []);
  return { ...p, gpus: list(p.gpus), disks: list(p.disks), scannedAt: new Date().toISOString() };
}

const FLUSH = String.raw`
Add-Type -TypeDefinition @'
using System;using System.Diagnostics;using System.Runtime.InteropServices;
public static class TlkMem{
  [DllImport("psapi.dll")] static extern bool EmptyWorkingSet(IntPtr h);
  [DllImport("ntdll.dll")] static extern int NtSetSystemInformation(int cls,ref int info,int len);
  [DllImport("advapi32.dll",SetLastError=true)] static extern bool OpenProcessToken(IntPtr p,uint access,out IntPtr token);
  [DllImport("advapi32.dll",SetLastError=true,CharSet=CharSet.Unicode)] static extern bool LookupPrivilegeValue(string sys,string name,out long luid);
  [DllImport("advapi32.dll",SetLastError=true)] static extern bool AdjustTokenPrivileges(IntPtr token,bool disableAll,ref TP state,int len,IntPtr prev,IntPtr ret);
  [StructLayout(LayoutKind.Sequential,Pack=1)] struct TP{public int Count;public long Luid;public int Attr;}
  public static int Trim(){
    int n=0;
    foreach(Process p in Process.GetProcesses()){try{if(EmptyWorkingSet(p.Handle))n++;}catch{}finally{p.Dispose();}}
    return n;
  }
  // Purging the standby list needs SeProfileSingleProcessPrivilege, which only an elevated token holds.
  public static bool PurgeStandby(){
    IntPtr token;
    if(!OpenProcessToken(Process.GetCurrentProcess().Handle,0x28,out token))return false;
    TP tp=new TP();tp.Count=1;tp.Attr=2;
    if(!LookupPrivilegeValue(null,"SeProfileSingleProcessPrivilege",out tp.Luid))return false;
    AdjustTokenPrivileges(token,false,ref tp,0,IntPtr.Zero,IntPtr.Zero);
    if(Marshal.GetLastWin32Error()!=0)return false;
    int cmd=4;
    return NtSetSystemInformation(80,ref cmd,4)==0;
  }
}
'@
$before=(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory
$trimmed=[TlkMem]::Trim()
$purged=[TlkMem]::PurgeStandby()
Start-Sleep -Milliseconds 400
$after=(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory
[ordered]@{freedGb=[math]::Max(0,[math]::Round(($after-$before)*1KB/1GB,2));trimmed=$trimmed;standbyPurged=$purged}|ConvertTo-Json -Compress
`;

export const flushRam = async () =>
  (await runJson<{ freedGb: number; trimmed: number; standbyPurged: boolean }>(FLUSH, 120_000)) ?? { freedGb: 0, trimmed: 0, standbyPurged: false };

// Caches Windows rebuilds on its own. Deliberately not here: the Recycle Bin (the user's undo) and Prefetch (deleting it slows the next boot).
const CLEAN = String.raw`
$ErrorActionPreference='SilentlyContinue'
function Wipe($p){if($p -and (Test-Path -LiteralPath $p)){Get-ChildItem -LiteralPath $p -Force|Remove-Item -Recurse -Force}}
$letter=$env:SystemDrive.TrimEnd(':')
$before=(Get-Volume -DriveLetter $letter).SizeRemaining
Wipe $env:TEMP
Wipe "$env:WINDIR\Temp"
Stop-Service wuauserv -Force
Wipe "$env:WINDIR\SoftwareDistribution\Download"
Start-Service wuauserv
Wipe "$env:WINDIR\SoftwareDistribution\DeliveryOptimization"
foreach($c in 'D3DSCache','NVIDIA\DXCache','NVIDIA\GLCache','AMD\DxCache','AMD\GLCache','Intel\ShaderCache','CrashDumps'){Wipe (Join-Path $env:LOCALAPPDATA $c)}
$after=(Get-Volume -DriveLetter $letter).SizeRemaining
[ordered]@{freedMb=[math]::Max(0,[math]::Round(($after-$before)/1MB))}|ConvertTo-Json -Compress
`;

export const deepClean = async () => (await runJson<{ freedMb: number }>(CLEAN, 300_000)) ?? { freedMb: 0 };

// Windows allows one restore point per 24 h; lift that for this call only and put the old setting back.
const RESTORE_POINT = String.raw`
$k='HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SystemRestore';$n='SystemRestorePointCreationFrequency'
$old=(Get-ItemProperty $k -Name $n -ErrorAction SilentlyContinue).$n
try{
  Set-ItemProperty $k -Name $n -Value 0 -Type DWord -ErrorAction Stop
  Enable-ComputerRestore -Drive "$env:SystemDrive\" -ErrorAction SilentlyContinue
  Checkpoint-Computer -Description 'Talkdedsec' -RestorePointType MODIFY_SETTINGS -ErrorAction Stop
  $true|ConvertTo-Json
}catch{$false|ConvertTo-Json}
finally{
  if($null -eq $old){Remove-ItemProperty $k -Name $n -ErrorAction SilentlyContinue}
  else{Set-ItemProperty $k -Name $n -Value $old -Type DWord -ErrorAction SilentlyContinue}
}
`;

export const restorePoint = async () => (await runJson<boolean>(RESTORE_POINT, 180_000)) === true;
