# Questions

Decisions are asked in rounds: numbered questions, one recommended answer each, worded so that "yes" accepts (`grilling.md`). A harness may offer a question tool that shows choices as buttons. The steps call it "the question tool".

**Manual fallback:** one chat message with the numbered questions and the recommended answer of each. The user answers "1 yes, 2 yes, 3 no, rather …", which also suits voice input.

**Prefer the question tool whenever the harness has one** (user request, 2026-10-21: clicking answers is much faster than reading a long message and remembering every question). Every decision the user must take in grill, improve, test and retrofit goes through it: one tool question per decision, two to four options, the recommended one first and marked "(recommended)", the context in the option descriptions rather than in the chat. A tool call holds up to its limit of questions (four in Claude Code), so a longer round is two calls in a row. The chat message before the call stays at most three lines. A numbered message is used only when there is no question tool or the answer is free text (a name, a number, a wording).

Rule on every harness: one question message at a time, never a stream of single questions during a build (the build asks at most one question at its start).

## Measure
Rounds per grilling and decisions taken in chat that never reached PLAN (deep retro timelines).
