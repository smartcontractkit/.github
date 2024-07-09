# go-mod-validator

This action verifies that all upstream dependencies are tested in a given go
package.

Requirements:

1. Go compiler (version matching go.mod or higher)
2. jq - https://jqlang.github.io/jq/

Validations implemented so far,

1. Parses the `go.mod` file's absolute path given as input, and verifies
   dependencies are present in the default branch of the upstream dependency's
   repositories
