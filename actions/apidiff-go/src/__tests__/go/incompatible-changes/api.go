// Package incompatiblechanges demonstrates breaking API changes
package incompatiblechanges

// PublicFunc is a public function with changed signature (BREAKING)
func PublicFunc(input string, newParam int) string {
	return "processed: " + input
}

// PublicStruct represents some data with breaking changes
type PublicStruct struct {
	Name string
	// Value field removed (BREAKING)
	// NewValue field with different type (BREAKING)
	NewValue string
}

// NewPublicStruct creates a new PublicStruct with changed signature (BREAKING)
func NewPublicStruct(name string, newValue string) *PublicStruct {
	return &PublicStruct{
		Name:     name,
		NewValue: newValue,
	}
}

// GetName returns the name field
func (p *PublicStruct) GetName() string {
	return p.Name
}

// GetValue is removed (BREAKING - method no longer exists)

// GetNewValue returns the new value field
func (p *PublicStruct) GetNewValue() string {
	return p.NewValue
}
