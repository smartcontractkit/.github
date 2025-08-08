// Package compatiblechanges demonstrates compatible API changes
package compatiblechanges

// PublicFunc is a public function that does something
func PublicFunc(input string) string {
	return "processed: " + input
}

// NewPublicFunc is a new function added in this version (compatible)
func NewPublicFunc(input string, prefix string) string {
	return prefix + ": " + input
}

// PublicStruct represents some data
type PublicStruct struct {
	Name  string
	Value int
	// NewField is a new field added (compatible)
	NewField string
}

// NewPublicStruct creates a new PublicStruct
func NewPublicStruct(name string, value int) *PublicStruct {
	return &PublicStruct{
		Name:     name,
		Value:    value,
		NewField: "default",
	}
}

// GetName returns the name field
func (p *PublicStruct) GetName() string {
	return p.Name
}

// GetNewField returns the new field (compatible addition)
func (p *PublicStruct) GetNewField() string {
	return p.NewField
}

// NewInterface is a new interface added (compatible)
type NewInterface interface {
	DoSomething() string
}
