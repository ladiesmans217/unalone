// Response models for API responses
package models

// APIResponse represents a standard API response
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Message string      `json:"message"`
	Errors  []string    `json:"errors,omitempty"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Success bool     `json:"success"`
	Message string   `json:"message"`
	Errors  []string `json:"errors,omitempty"`
}

// SuccessResponse creates a successful API response
func SuccessResponse(data interface{}, message string) APIResponse {
	return APIResponse{
		Success: true,
		Data:    data,
		Message: message,
	}
}

// ErrorResponseWithMessage creates an error response with a message
func ErrorResponseWithMessage(message string) ErrorResponse {
	return ErrorResponse{
		Success: false,
		Message: message,
	}
}

// ErrorResponseWithErrors creates an error response with multiple errors
func ErrorResponseWithErrors(message string, errors []string) ErrorResponse {
	return ErrorResponse{
		Success: false,
		Message: message,
		Errors:  errors,
	}
}
