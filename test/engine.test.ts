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
