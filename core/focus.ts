// Focus mode: one long-lived PowerShell process watches the foreground window, gives that app more CPU
// and throttles or freezes the other windowed apps. No desktop-runtime imports, so tests can use it.
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { FocusConfig, FocusStatus } from "../shared/types.ts";
import { startPs } from "./ps.ts";
import { psString } from "./tools.ts";

// PowerShell 5.1 compiles this as C# 5: no string interpolation, no "?.", no "out var".
export const FOCUS_LIB = String.raw`
Add-Type -TypeDefinition @'
using System;using System.Collections.Generic;using System.Diagnostics;using System.Runtime.InteropServices;using System.Text;using System.Threading;
public static class TlkFocus{
  delegate bool WndCb(IntPtr h,IntPtr l);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
  [DllImport("user32.dll")] static extern bool EnumWindows(WndCb cb,IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent,WndCb cb,IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h,int index);
  [DllImport("kernel32.dll")] static extern bool SetProcessInformation(IntPtr h,int cls,ref Throttle s,int size);
  [DllImport("ntdll.dll")] static extern int NtSuspendProcess(IntPtr h);
  [DllImport("ntdll.dll")] static extern int NtResumeProcess(IntPtr h);
  [DllImport("psapi.dll")] static extern bool EmptyWorkingSet(IntPtr h);
  [StructLayout(LayoutKind.Sequential)] struct Throttle{public uint Version;public uint ControlMask;public uint StateMask;}
  class Entry{public ProcessPriorityClass Original;public int Mode;}

  // Modes: 0 as we found it, 1 foreground, 2 throttled, 3 frozen.
  static Dictionary<int,Entry> state=new Dictionary<int,Entry>();
  static HashSet<int> denied=new HashSet<int>();
  static Dictionary<string,DateTime> since=new Dictionary<string,DateTime>();
  static HashSet<string> skip=new HashSet<string>();
  static HashSet<string> freeze=new HashSet<string>();
  static volatile bool stop;
  static int self,session,tick;
  static uint lastFg;
  static string lastLine="";

  // control=0 hands the decision back to Windows; state=1 is efficiency mode (EcoQoS).
  static void Qos(IntPtr h,uint control,uint st){
    Throttle t=new Throttle();t.Version=1;t.ControlMask=control;t.StateMask=st;
    SetProcessInformation(h,4,ref t,12);
  }

  static bool Set(Process p,int mode){
    Entry e;bool known=state.TryGetValue(p.Id,out e);
    if(known?e.Mode==mode:mode==0)return true;
    if(denied.Contains(p.Id))return false;
    try{
      IntPtr h=p.Handle; // throws for processes we may not open (anti-cheat, other users): those are left alone
      if(!known){e=new Entry();e.Original=p.PriorityClass;}
      if(e.Mode==3)NtResumeProcess(h);
      if(mode==0){p.PriorityClass=e.Original;Qos(h,0,0);state.Remove(p.Id);return true;}
      if(mode==1){p.PriorityClass=e.Original==ProcessPriorityClass.Normal?ProcessPriorityClass.AboveNormal:e.Original;Qos(h,1,0);}
      else{
        // A process its own app raised to High is doing something time-critical (voice, audio): throttling leaves it alone.
        if(e.Original==ProcessPriorityClass.High||e.Original==ProcessPriorityClass.RealTime){p.PriorityClass=e.Original;Qos(h,0,0);}
        else{p.PriorityClass=e.Original==ProcessPriorityClass.Idle?ProcessPriorityClass.Idle:ProcessPriorityClass.BelowNormal;Qos(h,1,1);}
        if(mode==3){NtSuspendProcess(h);EmptyWorkingSet(h);}
      }
      e.Mode=mode;state[p.Id]=e;return true;
    }catch{denied.Add(p.Id);return false;}
  }

  public static bool Apply(int pid,int mode){
    Process p;try{p=Process.GetProcessById(pid);}catch{return false;}
    try{return Set(p,mode);}finally{p.Dispose();}
  }

  static void RestoreAll(){foreach(int pid in new List<int>(state.Keys))Apply(pid,0);}

  static Dictionary<IntPtr,uint> Windows(){
    Dictionary<IntPtr,uint> owners=new Dictionary<IntPtr,uint>();
    WndCb cb=delegate(IntPtr h,IntPtr l){
      // visible, titled and not a tool window: what the taskbar would show
      if(IsWindowVisible(h)&&GetWindowTextLength(h)>0&&(GetWindowLong(h,-20)&0x80)==0){uint pid;GetWindowThreadProcessId(h,out pid);owners[h]=pid;}
      return true;
    };
    EnumWindows(cb,IntPtr.Zero);GC.KeepAlive(cb);
    return owners;
  }

  // A Store app's window belongs to ApplicationFrameHost; the app itself owns a child window.
  static uint RealOwner(IntPtr w,uint host){
    uint found=host;
    WndCb cb=delegate(IntPtr h,IntPtr l){uint pid;GetWindowThreadProcessId(h,out pid);if(pid!=host){found=pid;return false;}return true;};
    EnumChildWindows(w,cb,IntPtr.Zero);GC.KeepAlive(cb);
    return found;
  }

  static string Json(IEnumerable<string> names){
    List<string> list=new List<string>(names);list.Sort(StringComparer.Ordinal);
    StringBuilder b=new StringBuilder("[");
    foreach(string n in list){if(b.Length>1)b.Append(',');b.Append('"').Append(n.Replace("\\","\\\\").Replace("\"","\\\"")).Append('"');}
    return b.Append(']').ToString();
  }

  static void Tick(){
    IntPtr w=GetForegroundWindow();if(w==IntPtr.Zero)return;
    uint fp;GetWindowThreadProcessId(w,out fp);
    // A full pass on every foreground change, and every 2 s to pick up apps that started meanwhile.
    if(fp==lastFg&&(tick++%4)!=0)return;
    Process[] all=Process.GetProcesses();
    try{
      Dictionary<int,string> name=new Dictionary<int,string>();
      foreach(Process p in all){
        try{if(p.SessionId==session&&p.Id!=self)name[p.Id]=p.ProcessName.ToLowerInvariant();}catch{}
      }
      HashSet<string> apps=new HashSet<string>();
      foreach(KeyValuePair<IntPtr,uint> o in Windows()){
        string n;if(!name.TryGetValue((int)o.Value,out n))continue;
        if(n=="applicationframehost"&&!name.TryGetValue((int)RealOwner(o.Key,o.Value),out n))continue;
        if(!skip.Contains(n))apps.Add(n);
      }
      string fg;
      if(!name.TryGetValue((int)fp,out fg))return; // elevated above us or another session: we cannot tell what is in front
      if(fg=="applicationframehost"){string real;if(name.TryGetValue((int)RealOwner(w,fp),out real))fg=real;}
      lastFg=fp;
      DateTime now=DateTime.UtcNow;
      HashSet<string> throttled=new HashSet<string>(),frozen=new HashSet<string>();
      foreach(Process p in all){
        string n;if(!name.TryGetValue(p.Id,out n))continue;
        int mode;
        if(!apps.Contains(n))mode=0;
        else if(n==fg){mode=1;since.Remove(n);}
        else if(freeze.Contains(n)){
          // 3 s of grace: Alt+Tab and a click on the taskbar pass through other windows on the way
          if(!since.ContainsKey(n))since[n]=now;
          mode=(now-since[n]).TotalSeconds>=3?3:2;
        }else mode=2;
        if(!Set(p,mode))continue;
        if(mode==2)throttled.Add(n);else if(mode==3)frozen.Add(n);
      }
      foreach(int pid in new List<int>(state.Keys))if(!name.ContainsKey(pid))state.Remove(pid);
      denied.RemoveWhere(delegate(int pid){return !name.ContainsKey(pid);});
      string line="{\"foreground\":"+Json(new string[]{fg})+",\"throttled\":"+Json(throttled)+",\"frozen\":"+Json(frozen)+",\"apps\":"+Json(apps)+"}";
      if(line!=lastLine){lastLine=line;Console.WriteLine(line);}
    }finally{foreach(Process p in all)p.Dispose();}
  }

  public static void Run(int parent,string[] freezeNames,string[] skipNames){
    Process me=Process.GetCurrentProcess();self=me.Id;session=me.SessionId;
    foreach(string n in "explorer dwm applicationframehost shellexperiencehost startmenuexperiencehost searchhost searchapp textinputhost shellhost taskmgr systemsettings lockapp ctfmon sihost conhost".Split(' '))skip.Add(n);
    foreach(string n in skipNames)skip.Add(n);
    try{skip.Add(Process.GetProcessById(parent).ProcessName.ToLowerInvariant());}catch{}
    foreach(string n in freezeNames)if(!skip.Contains(n))freeze.Add(n);
    // A watcher that was killed could not thaw what it froze; resuming a running process does nothing.
    foreach(string n in freeze)foreach(Process p in Process.GetProcessesByName(n)){try{NtResumeProcess(p.Handle);}catch{}finally{p.Dispose();}}
    // Any line, or the pipe closing because the app is gone, ends the watch.
    Thread reader=new Thread(delegate(){try{Console.In.ReadLine();}catch{}stop=true;});
    reader.IsBackground=true;reader.Start();
    try{while(!stop){try{Tick();}catch{}Thread.Sleep(500);}}
    finally{RestoreAll();}
  }
}
'@
`;

// shortcut: ASCII process names only, widen the pattern if an app with another script in its name needs listing
const NAME = /^[\w .+()-]{1,64}$/;
export const cleanNames = (v: unknown): string[] =>
  [...new Set((Array.isArray(v) ? v : []).map((n) => String(n).trim().toLowerCase()).filter((n) => NAME.test(n)))];

const IDLE: FocusStatus = { running: false, foreground: "", throttled: [], frozen: [], apps: [] };
let child: ChildProcessWithoutNullStreams | null = null;
let status = IDLE;
let queue: Promise<void> = Promise.resolve();

export const focusStatus = () => status;

/** Ends the watcher and waits until it has put every process back. */
function stop(): Promise<void> {
  const c = child;
  child = null;
  status = IDLE;
  if (!c) return Promise.resolve();
  return new Promise((resolve) => {
    c.once("close", () => resolve());
    c.stdin.end();
  });
}

async function start(cfg: FocusConfig) {
  const names = (n: string[]) => `([string[]]@(${cleanNames(n).map(psString).join(",")}))`;
  const c = await startPs(`${FOCUS_LIB}\n[TlkFocus]::Run(${process.pid},${names(cfg.freeze)},${names(cfg.skip)})`);
  child = c;
  status = { ...IDLE, running: true };
  let buffer = "";
  c.stdout.on("data", (d) => {
    const lines = (buffer + d).split("\n");
    buffer = lines.pop()!;
    const last = lines.filter((l) => l.trim().startsWith("{")).pop();
    if (!last || child !== c) return;
    try {
      const s = JSON.parse(last) as { foreground: string[]; throttled: string[]; frozen: string[]; apps: string[] };
      status = { running: true, foreground: s.foreground[0] ?? "", throttled: s.throttled, frozen: s.frozen, apps: s.apps };
    } catch {}
  });
  c.once("close", () => {
    if (child === c) {
      child = null;
      status = IDLE;
    }
  });
}

/** Turns focus mode on with this config, or off with null. Calls run one after another: two watchers must never overlap. */
export function setFocus(cfg: FocusConfig | null): Promise<void> {
  queue = queue.then(async () => {
    await stop();
    if (cfg?.enabled) await start(cfg);
  }).catch(() => {});
  return queue;
}
