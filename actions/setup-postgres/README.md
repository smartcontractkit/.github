# Setup Postgresql

Sets up a basic postgres database for **testing** only.

## Inputs

| Input              | Default                   | Description                                                   |
| ------------------ | ------------------------- | ------------------------------------------------------------- |
| `image-tag`        | `16-alpine`               | Docker Hub `postgres` image tag.                              |
| `tmpfs`            | `false`                   | Use tmpfs for Postgres data (see `docker-compose.tmpfs.yml`). |
| `print-logs`       | _(unset)_                 | When `true`, dump logs instead of starting the service.       |
| `print-logs-path`  | `${{ github.workspace }}` | Log output directory when `print-logs` is `true`.             |
| `postgres-options` | `""`                      | See below.                                                    |

### `postgres-options`

- **Default (empty):** Compose uses `POSTGRES_OPTIONS` from this action’s `.env`
  (same as releases before this input existed).
- **Non-empty:** That string **replaces** `POSTGRES_OPTIONS` for variable
  interpolation in `docker compose up` only. Compose resolves
  `${POSTGRES_OPTIONS}` in `command:` from the process environment first, so an
  exported value overrides the `.env` file for the rendered command
  ([variable interpolation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)).

Exact default when the input is omitted (from `.env`):

```text
-c max_connections=1000 -c shared_buffers=2GB -c log_lock_waits=true
```

Copy this into workflows or into Chainlink `tools/test` if you want CI and local
diagnose to share one profile.

**YAML:** Prefer a single-quoted scalar so inner double quotes are literal:

```yaml
with:
  postgres-options: "-c max_connections=100 -c shared_buffers=256MB"
```

For long strings, use YAML block scalars; ensure the result is one `postgres`
argv string (same as you would pass after `postgres` on the shell).

**Security:** Treat `postgres-options` as **trusted** workflow configuration
only (maintainer-controlled). Do not feed unsanitized fork PR data into it
without the usual `pull_request_target` / environment isolation precautions.

### Parity with Chainlink diagnose

Chainlink’s diagnose harness may start Postgres with a different `-c` bundle
than this action’s default. To align CI with diagnose, pass the **full**
intended flag string via `postgres-options` (replace semantics—no merge with
`.env`). Long term, keep **one** canonical string in maintainer docs (here
and/or Chainlink) and reference it from both GHA and `tools/test` so the
profiles do not drift.

## Usage

### Setup Database

```yaml
- name: Setup Postgres
  id: setup-postgres
  uses: smartcontractkit/.github/actions/setup-postgres@<sha> # <version>

- name: Example consumer
  env:
    DB_URL: ${{ steps.setup-postgres.outputs.database-url }}
  run: echo "connect with $DB_URL"
```

### Dump Logs

To be called after the database has been setup only.

Will output database logs to console, and to `postgres_logs.txt` at the provided
directory (absolute path).

```yaml
- name: Print Postgres Logs
  # sha must match previous call
  uses: smartcontractkit/.github/actions/setup-postgres@<sha> # <version>
  with:
    print-logs: "true"
    print-logs-path: ${{ github.workspace }}
```
