---
"llm-action-error-reporter": minor
---

following 0.3.1 patch, this pivots to use github scripts to update specific
comment id instead of deciding to update the last message if it's made by the
script, which has low spam reduction effect in bot-busy environments
