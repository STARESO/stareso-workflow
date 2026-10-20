# Chat only (a chat window without access to the project's files)

A chat window (an assistant on the web, desktop or phone, with no access to the project folder) runs the conversation steps only: discuss, grill and improve. Build, test, deploy and retrofit need a coding harness, because they edit files, run commands and check pages. Skills can be loaded in some chat apps (the ChatGPT docs say standalone skills run in its desktop app, selected with `@`), and they run in a sandbox there, not in the project.

## How a colleague works
1. Paste the step (`stareso/skills/stareso-discuss/SKILL.md` or `stareso-grill/SKILL.md`), then `stareso/grilling.md` and `stareso/templates/PLAN.md`, or load them as a skill where the chat app supports it.
2. Paste only material the user would put in `private/sources/readable/`. **Never upload** anything from the guarded paths (`capabilities/read-guard.md`): a chat window has no read guard, so the user is the guard.
3. Answer the rounds in one message each ("1 yes, 2 yes, 3 no, rather …").
4. Copy the resulting PLAN, GLOSSARY and decision records back into the repository by hand, then continue in a coding harness with `/stareso-setup`.
