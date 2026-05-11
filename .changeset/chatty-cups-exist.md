---
"setup-postgres": minor
---

Add optional `postgres-options` input. When set, it replaces `POSTGRES_OPTIONS` for the `docker compose up` invocation so workflows can match a documented Postgres profile (for example Chainlink `tools/test` diagnose) without changing the baked-in default in `.env`. Empty value preserves previous behavior.
