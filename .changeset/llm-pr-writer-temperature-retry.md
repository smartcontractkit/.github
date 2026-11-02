---
"llm-pr-writer": patch
---

fix: omit temperature for gpt-5 and newer models, which reject a custom value
(e.g. gpt-6-luna)
