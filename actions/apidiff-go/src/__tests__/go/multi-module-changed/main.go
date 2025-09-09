// Package multimodule provides the main API
package multimodule

// MainFunc is the main function in the root module
func MainFunc(data string) string {
	return "main: " + data
}

// MainStruct represents data in the main module
type MainStruct struct {
	ID   int
	Data string
}

// NewMainStruct creates a new MainStruct
func NewMainStruct(id int, data string) *MainStruct {
	return &MainStruct{
		ID:   id,
		Data: data,
	}
}

// AdditionalFunc is a new function added to the main module
func AdditionalFunc(count int) int {
	return count * 2
}
