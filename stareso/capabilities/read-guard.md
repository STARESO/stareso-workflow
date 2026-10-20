# Read guard

Reading a file sends it to the model. The guard keeps private material out of every session and helper:

- `private/sources/locked/`
- `private/data/`
- `private/backups/`
- `data/raw/` (analysis packs)
- `data/processed/` (analysis packs)
- `.env*`

**The rule, stated in the project instructions, every role and the steps that touch files:** never read these paths by any means (no reading tool, no `cat`, no script printing rows). Scripts on data print counts and errors only. Files the user approves move to `private/sources/readable/`.

## Enforcement
A harness may enforce the rule (deny rules, an ignore file, a hook that refuses the read). Enforcement is **partial** when it covers the reading tool but not the shell, and the rule still covers the rest. A harness without enforcement keeps the rule alone (**manual**), and the user keeps locked files outside the folder the tool can see when possible.

## Canary
`init` and `retrofit` create `private/backups/CANARY` (one harmless word) once the guard is installed, then try to read it with the file-reading tool. A refusal is expected. They write the result under `Pack:` in `docs/PLAN.md`:

- `Guard: verified (<harness>, yyyy-mm-dd)` when the read was refused;
- `Guard: not enforced (<harness>, yyyy-mm-dd)` when it was read, and the user is told that the rule is then the only guard.

The canary is the evidence for a read-guard row in `harness/<harness>/capabilities.md`.
