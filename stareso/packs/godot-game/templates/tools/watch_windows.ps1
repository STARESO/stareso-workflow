param([string]$Log, [string]$StopFile, [int]$MaxSeconds = 600)
# Window watcher for tools/verify_offscreen.sh (guide §5). Polls every top-level window of any Godot
# process and logs each new state. Tags: MAIN (visible on the main screen: the rule is broken),
# SECONDARY (visible on another screen), hidden, minimized, offscreen.
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;
public static class W {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr p);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int i);
  static bool Hit(RECT r, int x, int y, int w, int h) { return r.R > x && r.L < x + w && r.B > y && r.T < y + h; }
  public static List<string> Snap(HashSet<uint> pids) {
    var res = new List<string>();
    // The main screen always starts at (0, 0); the virtual desktop covers every screen.
    int mw = GetSystemMetrics(0), mh = GetSystemMetrics(1);
    int vx = GetSystemMetrics(76), vy = GetSystemMetrics(77), vw = GetSystemMetrics(78), vh = GetSystemMetrics(79);
    EnumWindows((h, p) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (!pids.Contains(pid)) return true;
      bool vis = IsWindowVisible(h), icon = IsIconic(h); RECT r; GetWindowRect(h, out r);
      if (!vis && (r.R - r.L) < 200) return true;
      string tag = !vis ? "hidden" : icon ? "minimized" : Hit(r, 0, 0, mw, mh) ? "MAIN" : Hit(r, vx, vy, vw, vh) ? "SECONDARY" : "offscreen";
      res.Add(string.Format("pid={0} rect=({1},{2},{3},{4}) {5}", pid, r.L, r.T, r.R, r.B, tag));
      return true; }, IntPtr.Zero);
    return res;
  }
}
"@
$seen = @{}
$sw = [Diagnostics.Stopwatch]::StartNew()
"watch start $(Get-Date -Format HH:mm:ss.fff)" | Out-File -Encoding utf8 $Log
while ($sw.Elapsed.TotalSeconds -lt $MaxSeconds -and -not (Test-Path $StopFile)) {
  $pids = New-Object 'System.Collections.Generic.HashSet[uint32]'
  Get-Process | Where-Object { $_.ProcessName -like 'Godot*' } | ForEach-Object { [void]$pids.Add([uint32]$_.Id) }
  if ($pids.Count -gt 0) {
    foreach ($line in [W]::Snap($pids)) {
      if (-not $seen.ContainsKey($line)) { $seen[$line] = 1; "$(Get-Date -Format HH:mm:ss.fff) $line" | Out-File -Append -Encoding utf8 $Log }
    }
  }
  Start-Sleep -Milliseconds 2
}
"watch end $(Get-Date -Format HH:mm:ss.fff)" | Out-File -Append -Encoding utf8 $Log
