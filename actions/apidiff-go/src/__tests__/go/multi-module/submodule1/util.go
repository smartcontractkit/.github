// Package submodule1 provides utility functions
package submodule1

// UtilFunc is a utility function in submodule1
func UtilFunc(input string) string {
	return "util1: " + input
}

// UtilStruct represents data in submodule1
type UtilStruct struct {
	Name    string
	Enabled bool
}

// NewUtilStruct creates a new UtilStruct
func NewUtilStruct(name string, enabled bool) *UtilStruct {
	return &UtilStruct{
		Name:    name,
		Enabled: enabled,
	}
}

// IsEnabled returns the enabled status
func (u *UtilStruct) IsEnabled() bool {
	return u.Enabled
}
