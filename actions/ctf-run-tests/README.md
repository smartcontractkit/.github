# ctf-run-tests

> Common runner for chainlink-testing-framework based tests

Precompiled tests: set `skip_go_modules_download` to skip `go mod download`, and pass a
`test_command_to_run` that uses `gotestsum --raw-command -- /path/to/pkg.test -test.v -test.json …`
so junit/json output still works.
