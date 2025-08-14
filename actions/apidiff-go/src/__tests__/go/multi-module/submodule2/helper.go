// Package submodule2 provides helper functions
package submodule2

// HelperFunc is a helper function in submodule2
func HelperFunc(data []string) string {
	result := "helper2: "
	for i, item := range data {
		if i > 0 {
			result += ", "
		}
		result += item
	}
	return result
}

// HelperConfig represents configuration in submodule2
type HelperConfig struct {
	MaxItems int
	Prefix   string
}

// NewHelperConfig creates a new HelperConfig
func NewHelperConfig(maxItems int, prefix string) *HelperConfig {
	return &HelperConfig{
		MaxItems: maxItems,
		Prefix:   prefix,
	}
}

// GetMaxItems returns the max items setting
func (h *HelperConfig) GetMaxItems() int {
	return h.MaxItems
}
