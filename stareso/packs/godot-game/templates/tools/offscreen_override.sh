#!/usr/bin/env bash
# Sourced by screenshot.sh and windowed.sh (from the project root): writes the temporary override.cfg
# for an off-screen windowed run. The window starts minimized. When the script restores it, Windows
# puts it back at its creation position for about one frame before the script moves it off the desktop,
# so that creation position is placed on a secondary screen when there is one, never on the main screen.
# Godot coordinates start at the top-left corner of the whole desktop, hence the shift by its origin.
POS="$(powershell -NoProfile -Command '
Add-Type -AssemblyName System.Windows.Forms
$v = [System.Windows.Forms.SystemInformation]::VirtualScreen
$s = [System.Windows.Forms.Screen]::AllScreens | Where-Object { -not $_.Primary } | Select-Object -First 1
if (-not $s) { $s = [System.Windows.Forms.Screen]::PrimaryScreen }
"{0}, {1}" -f ($s.Bounds.X - $v.X + 40), ($s.Bounds.Y - $v.Y + 40)' 2>/dev/null | tr -d '\r')"
[ -n "$POS" ] || POS="0, 0"
cat > override.cfg <<CFG
[display]
window/size/mode=1
window/size/window_width_override=1280
window/size/window_height_override=720
window/size/no_focus=true
window/size/initial_position_type=0
window/size/initial_position=Vector2i($POS)
CFG
