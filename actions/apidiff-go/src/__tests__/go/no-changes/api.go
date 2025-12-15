// Package nochanges provides a simple API that remains unchanged
package nochanges

// PublicFunc is a public function that does something
func PublicFunc(input string) string {
	return "processed: " + input
}

// PublicStruct represents some data
type PublicStruct struct {
	Name  string
	Value int
}

// NewPublicStruct creates a new PublicStruct
func NewPublicStruct(name string, value int) *PublicStruct {
	return &PublicStruct{
		Name:  name,
		Value: value,
	}
}

// GetName returns the name field
func (p *PublicStruct) GetName() string {
	return p.Name
}
