# Capabilities

A capability is a feature the workflow needs from the assistant's harness (the program that runs the model: Claude Code, Codex, Cursor, Gemini CLI, a chat window). Each file here describes one capability without naming a product: what it does, the manual rule it replaces, and how its effect is measured.

Every capability exists on every harness, at least as its manual fallback. The step texts already state the rule (for example "never read `private/data/`"), so a harness feature only automates or enforces what the text says. Each harness says in `harness/<harness>/capabilities.md` how it provides each capability:

| Column | Values |
|---|---|
| Implementation | the harness feature, or "manual" |
| Level | **native** (the harness does it), **partial** (it does part, the rule covers the rest), **manual** (the rule only), **none** (the step cannot run there) |
| Status | **proposed** (from the docs, never run), **measured** (run on a real milestone or canary, numbers recorded), **adopted** (the retro kept it), **rejected** (the retro dropped it, with the reason) |
| Evidence | project, milestone and numbers, or the canary record, or "to measure" |

A proposed row becomes measured after one milestone of at least five slices on that harness, or after the canary for the read guard. The retro then sets adopted or rejected (`metrics.md`, "Evaluating a capability on a platform"). The workflow never adopts a row from the documentation alone.

| Capability | File | Used by |
|---|---|---|
| Helpers | `helpers.md` | build (builder per slice, checker per milestone), test (checker) |
| Read guard | `read-guard.md` | every step and helper; init and retrofit install it and run the canary |
| Automation | `automation.md` | workflow-changed notice, records refresh, docs-check, guard enforcement |
| Model tiers | `model-tiers.md` | every step's Session line, slice briefs, helpers |
| Browser | `browser.md` | build (dev server), test, the checker (app packs) |
| Questions | `questions.md` | init, grill, improve, test, build start |
| Step invocation | `invocation.md` | typed-only steps, skill frontmatter |
| Usage reader | `usage.md` | `session-stats --log`, the usage metrics of the retro |
