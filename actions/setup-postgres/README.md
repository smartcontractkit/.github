# Setup Postgresql

Sets up a basic postgres database for **testing** only.

## Usage

### Setup Database

```
...
    - name: Setup Postgres
      id: setup-postgres
      uses: smartcontractkit/.github/actions/setup-postgres@<sha> # <version>
...
      # use the database url later
      env:
        DB_URL: ${{ setups.setup-postgres.outputs.database-url }}
```

### Dump Logs

To be called after the database has been setup only!

Will output database logs to console, and to `postgres_logs.txt` at the provided
directory (absolute path).

```
...
    - name: Print Postgres Logs
      # sha must match previous call
      uses: smartcontractkit/.github/actions/setup-postgres@<sha> # <version>
      with:
        print-logs: 'true'
        print-logs-path: ${{ github.workspace }}
```

## Performance

Use `tmpfs` (true/false) and `optimize-performance` (true/false) to optimize the
performance of this **testing** database.

### tmpfs

Uses a `tmpfs` (ram disk) for the postgres database.

### optimize-performance

Attempts to maximize performance (reducing durability) based on the current
runner's resources.

See `optimize.sh` for more information.
