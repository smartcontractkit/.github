---
"llm-action-error-reporter": minor
---

- Add PR comment ID to make lookups safer (instead of finding last comment from
  "github bot").
- Add workflow run ID in comment to make finding source of comments easier.
- Delete the previous PR comment and add a new one instead of editing last
  comment (this seemed to be buggy).
- Optionally avoid PR commenting for success reports.
