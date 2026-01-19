# PNPtv Backend

Production-ready backend for PNPtv platform with Telegram authentication, RBAC, Hangouts (Agora Web RTC), and Videorama.

## Features

- **Telegram Authentication**: Secure server-side verification with JWT tokens
- **RBAC (Role-Based Access Control)**: Centralized permission system
- **Hangouts**: Video calls with Agora Web RTC
- **Videorama**: Playlists and podcasts with RBAC
- **Legal Gate**: Terms and conditions enforcement

## Tech Stack

- Node.js 18+
- Express
- TypeScript
- PostgreSQL (Prisma ORM)
- JWT Authentication
- Agora Web RTC SDK
- Winston (Logging)

## Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL 13+
- Agora Developer Account (for Hangouts)
- Telegram Bot Token

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/pnptv-backend.git
   cd pnptv-backend
   ```

2. Install dependencies:
   ```bash
   npm ci
   ```

3. Create `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` with your configuration:
   ```env
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/pnptv?schema=public"
   
   # JWT
   JWT_SECRET="your-very-secure-jwt-secret-here"
   
   # Telegram
   TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
   
   # Agora
   AGORA_APP_ID="your-agora-app-id"
   AGORA_APP_CERTIFICATE="your-agora-app-certificate"
   ```

5. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

## Development

Start the development server:
```bash
npm run dev
```

The server will run on `http://localhost:3001`

## Production

Build the application:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

## Deployment

### Using deploy.sh
```bash
./deploy.sh
```

### Manual Deployment
1. Install production dependencies:
   ```bash
   npm ci --production
   ```

2. Run migrations:
   ```bash
   npx prisma migrate deploy
   ```

3. Build the application:
   ```bash
   npm run build
   ```

4. Start with PM2:
   ```bash
   pm2 start dist/index.js --name pnptv-backend
   ```

## API Documentation

### Authentication

- `POST /api/auth/telegram` - Authenticate with Telegram
- `GET /api/auth/me` - Get current user
- `POST /api/auth/accept-terms` - Accept terms and conditions
- `POST /api/auth/logout` - Logout

### Hangouts

- `GET /api/hangouts/public` - Get public rooms
- `POST /api/hangouts` - Create a room (PRIME/ADMIN)
- `POST /api/hangouts/:roomId/join` - Join a room
- `GET /api/hangouts/:roomId` - Get room details

### Videorama

- `GET /api/videorama` - Get collections available to user
- `POST /api/videorama` - Create a collection (PRIME/ADMIN)
- `GET /api/videorama/:id` - Get a specific collection
- `PUT /api/videorama/:id` - Update a collection
- `DELETE /api/videorama/:id` - Delete a collection
- `GET /api/videorama/mine` - Get collections owned by current user

## RBAC (Role-Based Access Control)

### Roles
- **FREE**: Basic access
- **PRIME**: Premium access
- **ADMIN**: Full access

### Actions
- `hangouts.listPublic` - List public rooms
- `hangouts.joinPublic` - Join public rooms
- `hangouts.joinPrivate` - Join private rooms
- `hangouts.create` - Create rooms
- `videorama.playPublic` - Play public collections
- `videorama.playPrime` - Play prime collections
- `videorama.create` - Create collections
- `videorama.editOwn` - Edit own collections
- `videorama.editAny` - Edit any collections
- `videorama.deleteOwn` - Delete own collections
- `videorama.deleteAny` - Delete any collections

## Testing

Run all tests:
```bash
npm test
```

Run specific tests:
```bash
npm test -- --testPathPattern=auth
npm test -- --testPathPattern=hangouts
npm test -- --testPathPattern=videorama
```

## CI/CD

The project includes a GitHub Actions workflow (`.github/workflows/ci-cd.yml`) that:
1. Runs linting
2. Performs type checking
3. Executes tests
4. Builds the application
5. Deploys to production (on main branch)

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 3001) |
| `DATABASE_URL` | PostgreSQL connection URL | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | Yes |
| `AGORA_APP_ID` | Agora App ID | Yes |
| `AGORA_APP_CERTIFICATE` | Agora App Certificate | Yes |
| `FRONTEND_URL` | Frontend base URL | No (default: http://localhost:5173) |
| `TERMS_URL` | Terms and conditions URL | No (default: https://pnptv.app/terms) |

## Security

- All sensitive data is stored in environment variables
- JWT tokens have short expiration (1 hour)
- Agora App Certificate is never exposed to the client
- RBAC is enforced on all protected routes
- Terms and conditions must be accepted before accessing features
- Rate limiting and security headers are enabled

## License

MIT