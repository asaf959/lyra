# LYRA AI - MVP

A backend-centric no-code app builder that generates applications from natural language prompts.

## Tech Stack

- **Backend**: Node.js + Express (TypeScript)
- **Frontend**: Next.js 14 (App Router + TypeScript)
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand
- **Realtime**: WebSockets/SSE
- **Database**: PostgreSQL (via Prisma)
- **Cache/Queue**: Redis
- **Containerization**: Docker + Docker Compose
- **AI**: Claude Sonnet 4.5 (Anthropic API) - Mocked for MVP

## Getting Started

1. Install dependencies:
```bash
npm run install:all
```

2. Start all services with Docker Compose:
```bash
npm run dev
```

3. Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- API Documentation (Swagger): http://localhost:4000/api-docs

## Features

### Backend
- ✅ User Authentication (Email/Password & Google OAuth)
- ✅ JWT Token-based Authentication
- ✅ User Management APIs
- ✅ App Generation & Management
- ✅ Swagger/OpenAPI Documentation
- ✅ WebSocket Support
- ✅ Professional Error Handling
- ✅ Input Validation

### Frontend
- ✅ Modern UI with Tailwind CSS & shadcn/ui
- ✅ State Management with Zustand
- ✅ Responsive Design

## Project Structure

```
lyra/
├── backend/          # Express API server (TypeScript)
│   ├── src/
│   │   ├── config/      # Configuration (Swagger, etc.)
│   │   ├── controllers/ # Route controllers
│   │   ├── middleware/  # Auth, error handling
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic
│   │   └── utils/       # Utilities
│   └── prisma/          # Database schema
├── frontend/         # Next.js application
├── docker-compose.yml
└── README.md
```

## Backend API

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/google` - Google OAuth authentication
- `POST /api/auth/refresh` - Refresh access token

### User Endpoints (Auth Required)
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `DELETE /api/users/:id` - Delete user account

### App Endpoints (Auth Required)
- `GET /api/apps` - Get all user apps
- `GET /api/apps/:id` - Get app by ID
- `POST /api/apps/:id/build` - Build app
- `POST /api/apps/:id/run` - Run app
- `DELETE /api/apps/:id` - Delete app

### Prompt Endpoints (Auth Required)
- `POST /api/prompts/generate` - Generate app from prompt

**Full API Documentation**: http://localhost:4000/api-docs

# lyra
