package main

import (
	"encoding/json"
	"errors"
	"syscall/js"

	lockfile "github.com/github/actions-lockfile/go/pkg/lockfile"
)

type parseResult struct {
	OK            bool                `json:"ok"`
	Version       string              `json:"version,omitempty"`
	Workflows     map[string][]string `json:"workflows,omitempty"`
	Error         string              `json:"error,omitempty"`
	Line          int                 `json:"line,omitempty"`
	Column        int                 `json:"column,omitempty"`
	FutureVersion bool                `json:"futureVersion,omitempty"`
}

// parseLockfile accepts the raw lockfile bytes and validates them with the
// official parser. Only the data the validator needs is returned to JavaScript.
func parseLockfile(_ js.Value, args []js.Value) any {
	if len(args) < 1 {
		return encode(parseResult{Error: "missing lockfile contents"})
	}

	file, err := lockfile.Parse([]byte(args[0].String()))
	if err != nil {
		result := parseResult{Error: err.Error()}

		var parseErr *lockfile.ParseError
		if errors.As(err, &parseErr) {
			result.Line = parseErr.Line
			result.Column = parseErr.Column
		}
		if errors.Is(err, lockfile.ErrFutureVersion) {
			result.FutureVersion = true
		}

		return encode(result)
	}

	// The parser canonicalizes pins but does not require a dependency entry for
	// each one. Reject pins that nothing locks.
	for workflow, pins := range file.Workflows {
		for _, pin := range pins {
			if _, ok := file.Dependencies[pin]; !ok {
				return encode(parseResult{
					Error: "workflow " + workflow + " lists " + pin + " but has no dependency entry for it",
				})
			}
		}
	}

	return encode(parseResult{
		OK:        true,
		Version:   file.Version,
		Workflows: file.Workflows,
	})
}

func encode(value any) string {
	bytes, err := json.Marshal(value)
	if err != nil {
		return `{"ok":false,"error":"failed to encode result"}`
	}
	return string(bytes)
}

func main() {
	js.Global().Set("parseLockfile", js.FuncOf(parseLockfile))
	select {}
}
