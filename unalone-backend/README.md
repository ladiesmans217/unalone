# Unalone Backend

Backend API for the Unalone mental wellness and social connection mobile application.

## Tech Stack

- **Language**: Go 1.21
- **Framework**: Gin (HTTP web framework)
- **Database**: Google Firestore (NoSQL document database)
- **Authentication**: JWT tokens
- **Deployment**: Google Cloud Run

## Project Structure

```text
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
   - Download from: <https://golang.org/dl/>
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

### Hotspots (Protected)

- `POST /api/v1/hotspots/` - Create hotspot
- `GET /api/v1/hotspots/:id` - Get hotspot
- `POST /api/v1/hotspots/:id/join` - Join hotspot
- `POST /api/v1/hotspots/:id/leave` - Leave hotspot
- `GET /api/v1/hotspots/search` - Search hotspots

### Chat (Protected)

- `GET /api/v1/hotspots/:id/chat/messages` - Get recent chat messages (last 50)
- `GET /api/v1/hotspots/:id/chat/ws?token=...` - WebSocket for realtime chat

Notes:

- Only users who joined a hotspot can access its chat.
- Messages store sender `nickname` and hide real names.
- Only users who joined a hotspot can access its chat.
- Messages store sender `nickname` and hide real names.

### Health Check

- `GET /health` - Service health status

### AI Assistant (Protected)

- `POST /api/v1/ai/sessions` - Create a new AI chat session
- `GET /api/v1/ai/sessions` - List sessions
- `GET /api/v1/ai/sessions/:id` - Get session meta
- `GET /api/v1/ai/sessions/:id/messages` - Get session messages
- `POST /api/v1/ai/sessions/:id/messages` - Send a message and get AI reply

Configuration:

- `GEMINI_API_KEY`: Required to enable real Gemini responses. If not set, backend returns a stub echo.
- `GEMINI_MODEL` (optional): Defaults to `gemini-2.5-flash` if not provided.
- `AI_SYSTEM_PROMPT` (optional): Override the default culturally sensitive system instruction for Unalone’s Wellbeing Guide.

Implementation notes:

- Uses REST `models:generateContent` with `systemInstruction` set per latest API.
- API key is passed via `x-goog-api-key` header (not URL query).
- Sends recent conversation history as alternating `user`/`model` contents.

## Development Status

✅ Project structure created  
✅ Basic authentication system  
✅ User management  
✅ Hotspot system (mock-storage)  
✅ Real-time chat (mock-storage, WebSocket)  
⏳ Firestore persistence for hotspots and chat  
✅ Location services (endpoints)  

## Notes

- JWT secret should be changed in production
- Service account credentials needed for Firestore
- CORS enabled for frontend development
