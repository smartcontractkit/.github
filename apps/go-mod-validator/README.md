# go-mod-validator

This action verifies that all upstream dependencies are tested in a given go
package.

Validations implemented so far,

1. Parses output of `go list -m all` given as input, and verifies dependencies
   are present in the default branch of the upstream dependency's repositories
