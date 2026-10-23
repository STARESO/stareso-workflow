# Step invocation

Each step is one `SKILL.md` in the Agent Skills format (`skills/<name>/SKILL.md`, frontmatter `name` and `description` only), so any harness that reads skills lists them. The steps write a start as `/stareso-<step>`. A harness may use another prefix: the meaning is "run the step named stareso-<step>".

**Typed-only steps:** `init`, `deploy` and `retrofit` create things or go online, so only the user starts them. A harness may enforce this in the skill's metadata. `build` spends tokens, so the user starts it, either by typing the command or through a manager launch.

**Manager launch:** a session becomes the project's general manager by launching a step, never by running `status` (status can be asked in any session, a conductor included). It launches `build`, `test` or `improve` in a new session on the user's go (status §5) in two cases: the user accepts the launch offer that `status` made, or the user types the step in a session that already ran another step or holds a long chat (the Hand-over paragraph of those skills), where the typed command is the go. The launch message names the step and its arguments and says that a manager launched it. A step started this way runs as if typed and ends with a last line the manager reads (`MILESTONE DONE`, `STEP DONE` or `RUN STOPPED`). Without a way to start sessions, the user opens one and types the command. Measured by the conductor's context per turn and the "Carried" share of the later steps, against a build typed by hand.

**Manual fallback:** the user pastes the step's `SKILL.md` body as the first message ("follow these instructions"), or saves it as the harness's custom command. Without enforcement, the typed-only rule is the user's.

**Arguments:** `build` takes a range and a profile, `init` a name and a pack, `retrofit` a pack, `retro` a mode. Without argument support, the user writes them in the first message.
