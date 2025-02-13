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
