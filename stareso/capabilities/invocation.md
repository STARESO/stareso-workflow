# Step invocation

Each step is one `SKILL.md` in the Agent Skills format (`skills/<name>/SKILL.md`, frontmatter `name` and `description` only), so any harness that reads skills lists them. The steps write a start as `/stareso-<step>`. A harness may use another prefix: the meaning is "run the step named stareso-<step>".

**Typed-only steps:** `init`, `build`, `deploy` and `retrofit` create things, spend tokens or go online, so only the user starts them. A harness may enforce this in the skill's metadata.

**Manual fallback:** the user pastes the step's `SKILL.md` body as the first message ("follow these instructions"), or saves it as the harness's custom command. Without enforcement, the typed-only rule is the user's.

**Arguments:** `build` takes a range and a profile, `init` a name and a pack, `retrofit` a pack, `retro` a mode. Without argument support, the user writes them in the first message.
