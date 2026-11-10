import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze, applyScript, BY_ID, psValue, revertScript, TWEAKS } from "../electron/engine.ts";
import { runJson, runPs } from "../electron/ps.ts";
import type { BackupEntry, Profile, Tweak } from "../shared/types.ts";

const profile: Profile = {
  hostname: "PC", osName: "Windows 11", osBuild: 26100, cpuName: "CPU", cpuCores: 8, cpuThreads: 16,
  ramTotalGb: 32, ramFreeGb: 20, gpus: [], disks: [], systemDriveType: "SSD", systemDriveFreeGb: 300, systemDriveTotalGb: 500,
  chassis: "Desktop", hasPrinter: false, hasBluetooth: false, powerPlan: "", powerSaving: false, display: null,
  uptimeHours: 1, pendingReboot: false, startupItems: 3, scannedAt: "",
};

test("catalog is well formed", () => {
  assert.equal(BY_ID.size, TWEAKS.length, "ids are unique");
  for (const t of TWEAKS) {
    assert.ok(t.actions.length > 0, t.id);
    for (const a of t.actions) {
      // a reversible tweak whose script has no revert would claim an undo it cannot do
      if (a.kind === "powershell" && t.reversible) assert.ok(a.revert, `${t.id} has no revert`);
    }
  }
});

test("psValue", () => {
  assert.equal(psValue("DWord", 4294967295), "-1");
  assert.equal(psValue("DWord", 38), "38");
  assert.equal(psValue("Binary", "9012"), "([byte[]]@(144,18))");
  assert.equal(psValue("Binary", [1, 2]), "([byte[]]@(1,2))");
  assert.equal(psValue("String", "it's"), "'it''s'");
});

test("analysis recommends only safe-to-undo tweaks and respects hardware", () => {
  const healthy = analyze(profile);
  assert.equal(healthy.score, 100);
  for (const id of healthy.recommended) {
    const t = BY_ID.get(id)!;
    assert.ok(t.reversible && t.impact !== "advanced", id);
  }
  const laptop = analyze({ ...profile, chassis: "Laptop", systemDriveType: "HDD", ramTotalGb: 8 });
  assert.ok(laptop.skipped.some((s) => s.id === "power.disable-core-parking" && s.reason.code === "desktop"));
  assert.ok(laptop.skipped.some((s) => s.id === "svc.sysmain" && s.reason.code === "ssd"));
  assert.ok(laptop.score < 100);
});

// Real round trip against a scratch key in HKCU: apply, check, revert, check it is as before.
test("apply then revert restores the registry", { skip: process.platform !== "win32" }, async () => {
  const key = "Software/TalkdedsecOptimizerSelfTest";
  const path = "HKCU:\\Software\\TalkdedsecOptimizerSelfTest";
  const tweak: Tweak = {
    id: "test.roundtrip", category: "performance", impact: "safe", reversible: true,
    actions: [
      { kind: "registry", hive: "HKCU", key, name: "Existing Value", type: "REG_SZ", value: "new" },
      { kind: "registry", hive: "HKCU", key, name: "Fresh", type: "REG_DWORD", value: 4294967295 },
      { kind: "registry", hive: "HKCU", key, name: "Bin", type: "REG_BINARY", value: "9012" },
    ],
  };
  const read = () =>
    runJson<Record<string, unknown>>(`$k=Get-Item '${path}';$o=[ordered]@{};foreach($n in $k.GetValueNames()){$o[$n]=$k.GetValue($n)};$o|ConvertTo-Json -Compress`);
  await runPs(`New-Item '${path}' -Force|Out-Null;New-ItemProperty '${path}' -Name 'Existing Value' -Value "old ' quote" -PropertyType String -Force|Out-Null`);
  try {
    const [res] = (await runJson<{ ok: boolean; error: string; previous: BackupEntry[] }[]>(applyScript([tweak])))!;
    assert.equal(res.error, "");
    assert.equal(res.previous.length, 3);
    assert.deepEqual(await read(), { "Existing Value": "new", Fresh: -1, Bin: [144, 18] });

    const [undone] = (await runJson<{ ok: boolean }[]>(revertScript([{ tweak, entries: res.previous }])))!;
    assert.ok(undone.ok);
    assert.deepEqual(await read(), { "Existing Value": "old ' quote" });
  } finally {
    await runPs(`Remove-Item '${path}' -Recurse -Force`);
  }
});

test("version compare, startup ids and leftover names", async () => {
  const { appNames, isAppId, isNewer, leftoverCandidates, parseStartupId } = await import("../electron/tools.ts");
  assert.equal(isNewer("1.0.10", "1.0.9"), true);
  assert.equal(isNewer("v1.1.0", "1.1.0"), false);
  assert.equal(isNewer("1.0.0", "1.2.0"), false);
  assert.deepEqual(parseStartupId("HKCU|Run|My|App"), { root: "HKCU", sub: "Run", name: "My|App" });
  assert.equal(parseStartupId("HKU|Run|x"), null);
  assert.equal(isAppId("reg|HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{A}"), true);
  assert.equal(isAppId("reg|HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run"), false);
  assert.equal(isAppId("appx|Foo.Bar_1.0.0.0_x64__abc; calc"), false);
  assert.deepEqual(appNames("Foo Tool 2.4.1 (x64)"), ["Foo Tool 2.4.1 (x64)", "Foo Tool"]);
  // names every vendor shares must never become a leftover target
  assert.deepEqual(appNames("Microsoft"), []);
  assert.deepEqual(appNames("Go"), []);
  const env = { appData: "C:\\U\\AppData\\Roaming", localAppData: "C:\\U\\AppData\\Local", programData: "C:\\ProgramData", programFiles: "C:\\Program Files", programFilesX86: "" };
  const paths = leftoverCandidates({ name: "Foo Tool 2.4", publisher: "Acme", location: "C:\\Program Files\\Foo Tool\\" }, env).map((c) => c.path);
  assert.ok(paths.includes("C:\\Program Files\\Foo Tool"));
  assert.ok(paths.includes("C:\\U\\AppData\\Roaming\\Acme\\Foo Tool"));
  assert.ok(paths.includes("HKCU:\\Software\\Foo Tool"));
  assert.ok(paths.every((p) => /\\Foo Tool( 2\.4)?$/.test(p)), "every candidate ends with the app's own name");
  // an install location that is not named after the app (a shared folder) is left alone
  assert.ok(!leftoverCandidates({ name: "Foo Tool", publisher: "", location: "C:\\Program Files" }, env).some((c) => c.path === "C:\\Program Files"));
});

test("startup switch round trip and leftover removal on real keys", async () => {
  const { listStartup, measure, removeLeftovers, setStartup } = await import("../electron/tools.ts");
  const { mkdtemp, mkdir, writeFile, access } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const name = "TalkdedsecSelfTest";
  const run = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
  const approved = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run";
  try {
    await runPs(`if (-not (Test-Path -LiteralPath '${run}')) { New-Item -Path '${run}' -Force | Out-Null }; Set-ItemProperty -LiteralPath '${run}' -Name '${name}' -Value 'cmd.exe /c rem' -Type String`);
    const find = async () => (await listStartup()).find((i) => i.id === `HKCU|Run|${name}`);
    assert.equal((await find())?.enabled, true);
    assert.equal(await setStartup(`HKCU|Run|${name}`, false), true);
    assert.equal((await find())?.enabled, false);
    assert.equal(await setStartup(`HKCU|Run|${name}`, true), true);
    assert.equal((await find())?.enabled, true);
    assert.equal(await setStartup("HKU|Run|x", false), false);
  } finally {
    await runPs(`Remove-ItemProperty -LiteralPath '${run}' -Name '${name}' -ErrorAction SilentlyContinue; Remove-ItemProperty -LiteralPath '${approved}' -Name '${name}' -ErrorAction SilentlyContinue`);
  }

  const m = await measure();
  assert.ok(m && m.freeRamMb > 0 && m.processes > 0 && m.services > 0);

  const root = await mkdtemp(join(tmpdir(), "tlk-left-"));
  const folder = join(root, "Left Over's");
  await mkdir(folder);
  await writeFile(join(folder, "a.txt"), "x");
  const key = "HKCU:\\Software\\TalkdedsecSelfTestLeft";
  await runPs(`New-Item -Path '${key}' -Force | Out-Null; Set-ItemProperty -LiteralPath '${key}' -Name 'v' -Value 1`);
  const removed = await removeLeftovers(
    [{ id: "0", kind: "folder", path: folder, sizeMb: 0 }, { id: "1", kind: "registry", path: key, sizeMb: 0 }, { id: "2", kind: "folder", path: join(root, "missing"), sizeMb: 0 }],
    join(root, "backup"),
  );
  assert.equal(removed, 2);
  await assert.rejects(access(folder));
  assert.equal(await runJson<boolean>(`if (Test-Path -LiteralPath '${key}') { 'true' } else { 'false' }`), false);
  assert.equal(await runJson<number>(`@(Get-ChildItem -LiteralPath '${join(root, "backup")}' -Filter *.reg).Count`), 1);
});
