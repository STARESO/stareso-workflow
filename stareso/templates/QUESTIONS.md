# Open questions

What the project could not settle by itself. Enters the workflow at setup (leftovers of the grilling), then grows from the build (a brief or PLAN does not answer something), the test (points that need the user's decision), retrofit (`[debt]`), and empties through improve and the sessions that answer.

Rules: a question never stops the build unless every remaining slice depends on it; the slices it names wait, the others go on. `stareso-improve` reads the open ones first (they are decisions); `stareso-status` counts them; `docs-check` flags a question still open once its blocked slices are done, and a ticked one without an answer.

Format:
- `- [ ] (slice M3.2 | test yyyy-mm-dd | grilling) Question… · blocks: M3.2, M3.4 | none`
- answered: `- [x] (…) Question… · blocks: … **Answer (yyyy-mm-dd): …**` (keep the line; the answer is the record)
- debt: `- [ ] [debt] (slice M3.2 | review yyyy-mm-dd) What is owed and where · blocks: none` → paid by a tidy slice, then ticked with the slice id as the answer

