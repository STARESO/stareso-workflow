extends SceneTree
## Used by tools/verify_offscreen.sh: restores the minimized window the way tests and tools must
## (restore first, then move off the desktop), keeps it 60 frames, prints the audio driver, quits.

func _initialize() -> void:
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
	DisplayServer.window_set_position(Vector2i(-20000, -20000))
	for i in 60:
		await process_frame
	print("PROBE audio_driver=%s pos=%s" % [AudioServer.get_driver_name(), DisplayServer.window_get_position()])
	quit(0)
