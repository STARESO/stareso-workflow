# Start here

This page is for someone who has never worked with an AI coding assistant. Five minutes, then you can start a project.

## What this is
The stareso workflow is a method for building a small web app or a data analysis with an AI assistant, in small checked pieces. You decide, the assistant writes, and everything decided is written down in the project's `docs/` folder, so nothing depends on the chat.

The method is split into **steps** (init, discuss, grill, setup, build, test, improve, deploy, plus status, retrofit and retro). Each step is one instruction file in `skills/<step>/SKILL.md`, in the open Agent Skills format that several assistants read.

## The five words you need
| Word | Meaning |
|---|---|
| **Harness** | the program you talk to: Claude Code, Codex, Cursor, Gemini CLI, or a chat window. `harness/<name>/README.md` says how to set yours up. |
| **Tier** | how capable a model a step needs: **strong** for decisions, **standard** for most work, **light** for trivial edits. Your harness's `models.md` says which model that is. |
| **Slice** | one small piece of work (a screen, a figure family) that can be built and checked on its own. The roadmap is a list of slices. |
| **Helper** | a fresh assistant session that builds one slice from its written brief, so the main session stays small and cheap. |
| **Read guard** | the rule that private files (`private/`, raw data, `.env` files) are never read. Reading a file sends it to the model. |

## Your first project
1. Make an empty folder and open your harness there, on a **strong-tier** model.
2. Start the `stareso-init` step (in Claude Code: type `/stareso-init my-app app-next`). It creates the folders and the private guard, and checks the guard with a harmless test file.
3. Put your reference material (forms, exports, notes) in `private/sources/locked/`. The assistant asks before reading anything.
4. Talk about the project (`stareso-discuss`). When you are ready, say **"let's grill"**: the assistant asks numbered questions, each with a recommended answer, and you reply "1 yes, 2 no, rather …".
5. `stareso-setup` writes the rules and the roadmap. Then open a **new session** on a **standard-tier** model and start `stareso-build M1`. Let it work.
6. When it reports, open a new session and say **"test time"**. Click around, say what you see, then "end test".
7. Lost at any point: `stareso-status` tells you where you are and the exact next step.

## Three habits that keep it cheap
- **One step per session.** A long chat is re-read at every turn, so a new session is cheaper than a long one.
- **Requests during a build go to feedback**, not into the build. The next test round turns them into slices.
- **Never paste or upload private files**, whatever the harness.

Next: `README.md` (the full manual), `harness/<your harness>/README.md`, and `grilling.md` if you want to know how decisions are asked.
