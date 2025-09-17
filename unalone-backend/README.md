# Unalone Backend

Backend API for the Unalone mental wellness and social connection mobile application.

## Tech Stack

- **Language**: Go 1.21
- **Framework**: Gin (HTTP web framework)
- **Database**: Google Firestore (NoSQL document database)
- **Authentication**: JWT tokens
- **Deployment**: Google Cloud Run

## Project Structure

```
unalone-backend/
├── cmd/server/           # Application entry point
├── internal/
│   ├── handlers/         # HTTP request handlers
│   ├── middleware/       # HTTP middleware
│   ├── models/          # Data models and structures
│   └── services/        # Business logic services
├── pkg/                 # Public packages (if any)
├── configs/             # Configuration files
└── scripts/             # Build and deployment scripts
```

## Setup Instructions

### Prerequisites

1. **Install Go 1.21+**
   - Download from: https://golang.org/dl/
   - Verify installation: `go version`

2. **Google Cloud Setup**
   - Create a Google Cloud project
   - Enable Firestore API
   - Download service account credentials

### Local Development

1. **Clone and setup**
   ```bash
   cd unalone-backend
   go mod tidy
   ```

2. **Environment Variables**
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account-key.json"
   export PORT=8080
   ```

3. **Run the server**
   ```bash
   go run cmd/server/main.go
   ```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh JWT token

### Users (Protected)
- `GET /api/v1/users/profile` - Get user profile
- `PUT /api/v1/users/profile` - Update user profile

### Health Check
- `GET /health` - Service health status

## Development Status

✅ Project structure created  
✅ Basic authentication system  
✅ User management  
⏳ Hotspot system (next)  
⏳ Real-time chat  
⏳ Location services  

## Notes

- JWT secret should be changed in production
- Service account credentials needed for Firestore
- CORS enabled for frontend development
