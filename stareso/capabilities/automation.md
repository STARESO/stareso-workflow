# Automation

Some workflow events can run without anyone typing them. Each one has a manual line in the steps, so a harness without automation loses only convenience.

| Event | Manual line it replaces | Where the line is |
|---|---|---|
| **Workflow changed:** a running session learns that the workflow repository moved since it last looked, and re-reads the step it runs | the user tells the session "the workflow changed, re-read the step" | (none: a missed change shows as an old step text) |
| **Records refreshed** at the end of build and test | `session-stats --log`, then `docs-check` | build §4 step 3b, test §3 step 3 |
| **Docs-check before a step** | `docs-check` at the start of improve and retro | improve §3 step 5, retro §1 |
| **Guard enforcement** | the read-guard rule (`read-guard.md`) | project instructions, roles |

A harness implements an event with its hooks (session start, prompt submitted, tool used, session end) or not at all. The tool behind each event is a plain Node script in `tools/` that any hook can call and that fails silently, so a hook never breaks a prompt.

## Measure
An automated event is adopted when the retro finds its manual line no longer needed: no step re-run because of an old text (workflow changed), no `docs-check` findings left at the end of a step (records, docs-check), the canary refused (guard).
