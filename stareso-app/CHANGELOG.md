# Workflow changelog

One line per change to the skills, the guide or the templates: date, what changed, why.

- 2026-10-17: first version: 9 skills (init, discuss, grill, setup, build, test, improve, status, deploy), slice-builder helper agent, guide from SecuSurf + BaieWatch, grilling rules, templates. See DESIGN-NOTES.md.
- 2026-10-18 (Scriba, after the second test): IDEAS.md status marks (✅ 🛠 💭 ⏳ ✖ ℹ) in the template, discuss, grilling, improve, test and build (build switches 🛠 to ✅): the user could not tell which ideas were already built.
- 2026-10-18 (Scriba): guide §10 one `dev:rebuild` command when dev data needs imports; test skill never runs the bare reset: a `db:reset` during the test wiped the imported photos and looked like a broken app.
- 2026-10-18 (Scriba): guide §4 default accent is sea blue instead of clay orange, and accents may never be orange or red: the clay accent contradicted the guide's own rule "red / orange = alerts"; optional personal accent picker noted.
- 2026-10-18 (Scriba): test skill logs feedback that contradicts CLAUDE.md / PLAN as "decision to confirm", its slice waits on improve, and improve runs before the build: the sheet-visibility change nearly went into a fix slice without updating the rule.
- 2026-10-18 (Scriba): doc files in capitals (`ROADMAP.md`, `BUILD-LOG.md`, `HELPER-RULES.md`; templates renamed, references updated); new `docs/README.md` template listing every doc, its use and which skill creates / updates it; init creates it. Older projects: rename their lowercase docs.
- 2026-10-18 (Scriba): BUILD-LOG lines carry date and merge time (`yyyy-mm-dd HH:mm`); the template's empty table header and the placeholder lines in FEEDBACK / QUESTIONS became one-line format notes.
- 2026-10-18 (Scriba): improve and test end with a coherence check across CLAUDE.md, PLAN, GLOSSARY, decisions, open ROADMAP briefs, HELPER-RULES, IDEAS, QUESTIONS, FUTURE and docs/README before committing: after the improve round, briefs T2 and T22 still described the old rules.
- 2026-10-18: the workflow (skills, helper agent, stareso-app/) is a git repository in `~/.claude` with a whitelist `.gitignore`, for a private remote backup.
