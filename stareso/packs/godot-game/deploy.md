# Releasing a godot-game project

Used by `stareso-deploy`. The assistant prepares files and builds. **The author does every step in the stores' consoles and handles every signing key.** The assistant never reads, creates or types a keystore password, never uploads, never pushes without an explicit "yes" for that push.

## Pre-flight (one message, the author answers yes / no per line)
1. The last playtest is segmented and its fix milestone is built and tested.
2. The version is chosen (`application/config/version` in `project.godot`, and the Android version code incremented).
3. Saves from the previous version load (migration test passes), or the release notes say saves reset.
4. Debug-only features are off in release builds (`OS.is_debug_build()` gates, cheat keys, the time-skip key).
5. Icons, splash screen and the game's name are the author's final versions.
6. Every drafted text and fact was reviewed by the author (PLAYTEST "Texts" lines ticked).
7. Licences of every third-party asset, font and addon are known and listed in `CREDITS.md`.
8. Export templates for this exact Godot version are installed, and (Android) the SDK and Java paths are set in the editor settings.
9. The release keystore exists, is backed up outside the project, and its password is known only to the author.
10. Performance was measured on the target tablet (FPS, memory) and the reduced-effects switches work.

## Prepare (the assistant, on a branch `deploy-prep`, then merge)
- `CREDITS.md`, release notes (`docs/RELEASE-NOTES.md`, in the game's first language and in English), store texts drafted for the author's review (short and long description, what is new).
- Export presets checked in `export_presets.cfg`: PC (Windows, and Linux or macOS if the plan says so), Android (landscape, permissions limited to what the game uses, `arm64-v8a`). The release keystore path stays **empty** in the committed file: the author sets it locally or through environment variables.
- `check`, the playthrough test, then the debug builds of every preset with `build`, and a smoke run of the PC build headless if it supports it.
- `docs/DEPLOY.md`: these steps with this project's names and checkboxes, and a "Lessons" section.

## The author's steps (one per message, ticked in `docs/DEPLOY.md`)
1. **Release builds:** in the editor, Project > Export, each preset with "Export Release" (Android: AAB for the store, APK for direct installs), with the release keystore.
2. **Install and play** the release builds once on PC and on the tablet: start, first quest, save, quit, reload.
3. **itch.io** (optional): create the page, upload the PC zip and the APK (or use `butler` with the author's own key), set the screenshots and the texts.
4. **Google Play** (optional): app in the Play Console, internal testing track first with the AAB, store listing, content rating, data safety form, then production when testers agree.
5. **Tag** the release: `git tag v<version>` (the assistant can run it after the author's yes).

## After
- `docs/DEPLOY.md` "After the release" block (version, date, where it is published) and the status line in AGENTS.md.
- `Phase: released` in PLAN.md. Feedback from players goes through `/stareso-test` (logged and segmented like a playtest).
- New lessons go to `docs/DEPLOY.md` "Lessons" **and** to this pre-flight list (with a CHANGELOG line).
