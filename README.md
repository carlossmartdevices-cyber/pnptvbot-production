# PNPtv Telegram Bot - Production Ready

A comprehensive, production-ready Telegram bot for PNPtv featuring live streaming, radio, Zoom rooms, subscription payments, and more.

## 🌟 Features

### Core Functionality
- ✅ **User Onboarding**: Multi-step onboarding with language selection, age verification, and terms acceptance
- 👤 **Profile Management**: Customizable profiles with photos, bios, locations, and interests
- 🌍 **Nearby Users**: Geolocation-based user discovery with radius filtering
- 💎 **Subscription System**: Premium plans with ePayco (USD) and Daimo (USDC) payment integration
- 📻 **Radio Streaming**: 24/7 radio with song requests and now playing info
- 🎥 **Zoom Rooms**: Create and join video conference rooms
- 🎤 **Live Streaming**: Start and view live streams (premium feature)
- 🤖 **AI Support**: Cristina AI assistant powered by OpenAI GPT-4
- 👨‍💼 **Admin Panel**: User management, broadcasts, analytics, and plan management

### Technical Features
- 🔒 **Security**: Input validation, rate limiting, Helmet.js, secure sessions
- 🌐 **i18n**: Full English/Spanish support with dynamic language switching
- 📊 **Analytics**: User statistics, revenue tracking, and insights
- 🚨 **Error Tracking**: Sentry integration for production monitoring
- ⚡ **Performance**: Redis caching, optimized PostgreSQL queries with indexes
- 🗄️ **Database**: PostgreSQL with Sequelize ORM for robust data management
- 🐳 **Containerization**: Docker and Docker Compose ready
- 🔄 **CI/CD**: GitHub Actions workflow for automated testing and deployment
- 📝 **Logging**: Structured logging with Winston and daily log rotation
- ✅ **Testing**: Jest unit tests with coverage reporting

## 🌈🔥 Guía Oficial – PNP Latino TV & PNPtv Bot

Tu puerta de entrada al universo PNP queer en Telegram

1️⃣ **¿Qué es PNP Latino TV y qué es el PNPtv Bot?**

PNP Latino TV es una comunidad digital queer para adultos que viven, crean y conectan alrededor de la cultura PNP (Party ‘n Play), el arte, la música, el sexo positivo y la conversación sin tabúes.
No somos solo porno. Somos comunidad + tecnología + experiencias en vivo.
El PNPtv Bot es el corazón de todo: un bot de Telegram que te permite acceder a contenidos, salas, playlists, eventos en vivo y herramientas sociales desde un solo lugar.
En esencia, PNP Latino TV es:
✨ Una comunidad gratuita en Telegram  
✨ Una membresía PRIME para acceso completo  
✨ Un espacio seguro para adultos verificados  
✨ Un laboratorio de experiencias queer digitales

2️⃣ **¿Qué puedes hacer dentro del PNPtv Bot?**

Dentro del bot vas a encontrar (progresivamente):

📍 Nearby – Mapa social para ver quién está cerca de ti  
🎥 Hangouts – Salas de video para fumar, hablar, ligar y socializar  
🎶 Videorama – Playlists, podcasts y contenido curado por la comunidad  
📺 PNP Live – Shows, performances y transmisiones en vivo  
🧑‍🎤 Perfiles – Tu bio, foto, tribu, links y mood  
🎟 Eventos – Acceso a fiestas virtuales y experiencias especiales

3️⃣ **Mini tutorial – Cómo usar el PNPtv Bot (en 1 minuto)**

Paso 1 Entra al bot desde Telegram: 👉 `t.me/pnplatinotv_bot`  
Paso 2 Presiona Start / Iniciar. El bot te pedirá:
  - Aceptar Términos y Condiciones
  - Confirmar que eres +18
  - Elegir idioma (ES / EN)
Paso 3 Verás el menú principal con botones como:
  - Nearby  
  - Hangouts  
  - Videorama  
  - PNP Live  
  - Mi Perfil  
  - Soporte  
Paso 4 Explora libremente si eres usuario FREE o desbloquea todo con PNPtv PRIME

4️⃣ **FREE vs PRIME (simple y sin drama)**

**Usuario FREE**
  - Ver salas públicas  
  - Unirte a salas abiertas  
  - Escuchar playlists públicas  
  - Ver previews de contenido  
  - Acceder a eventos abiertos

**Usuario PRIME**
  - Crear salas privadas y públicas  
  - Acceder a todo Videorama  
  - Ver PNP Live completo  
  - Crear playlists y podcasts  
  - Acceder a eventos exclusivos  
  - Soporte prioritario

5️⃣ **📆 Calendario de Lanzamiento de Features**

(Todo se libera por fases – una por semana)

Estamos lanzando cada módulo poco a poco para hacerlo bien, testearlo contigo y pulir la experiencia.

🔹 **Fase 1 – Nearby**  
📅 Lanzamiento: 3 de febrero 2026  
📍 Mapa social para ver quién está cerca  
👥 Perfiles básicos  
🧪 Pruebas abiertas con la comunidad

🔹 **Fase 2 – Hangouts**  
📅 Lanzamiento: 10 de febrero 2026  
🎥 Salas de video públicas y privadas  
🔥 Smoke sessions, chats calientes, afters  
🧪 Stress test de llamadas y salas

🔹 **Fase 3 – Videorama**  
📅 Lanzamiento: 17 de febrero 2026  
🎶 Playlists  
🎙 Podcasts  
🎬 Contenido curado  
🧪 Pruebas de carga y calidad

🔹 **Fase 4 – PNP Live**  
📅 Lanzamiento: 24 de febrero 2026  
📺 Shows en vivo  
🎭 Performances  
💬 Chat en tiempo real  
🧪 Pruebas de transmisión

6️⃣ **Nota importante sobre el despliegue 🛠**

Durante cada semana de lanzamiento:
  - Te vamos a enviar instrucciones simples  
  - Te pediremos que pruebes botones, entres a salas, reportes errores y digas qué se siente raro  
  - Algunas funciones pueden caerse, cambiar de diseño o reiniciarse
  
Eso es normal. Estás dentro del beta queer underground más delicioso de Telegram 😈

7️⃣ **Soporte & contacto**

Si algo no funciona o tenés dudas:
  - Botón Soporte dentro del bot  
  - O DM directo a 👉 `@pnptvadmin`

8️⃣ **Cierre vibe PNP**

Esto no es solo una app. Es una experiencia viva que estamos creando con vos.  
Gracias por ser parte del caos creativo, del humo digital y del futuro raro y hermoso de PNP Latino TV.  
💜 Santino & Lex PNP Latino TV

## 🗂️ Flujos y menús actuales

El bot mantiene una experiencia guiada con las acciones principales expuestas desde el menú principal. Cada entrada abre secciones dedicadas:

  - `Nearby`: mapa interactivo, discovery social y acciones de perfil inmediato.  
  - `Hangouts`: salas públicas, privadas y funciones premium para iniciar sesiones.  
  - `Videorama`: listas curadas, podcasts y contenido bajo demanda.  
  - `PNP Live`: acceso a shows y chat en vivo.  
  - `Mi Perfil`: edición de bio, links, fotos y tribu.  
  - `Soporte`: acceso a Cristina AI, soporte humano y documentos útiles.

Las instrucciones y flujos también están indexados en la nueva opción `🧠 Cristina Asistente Admin` dentro del panel de administradores. Desde ahí:
  - Se alimentan bloques de conocimiento sobre planes (Lex/canal).  
  - Se actualizan precios y estado del bot con un click.  
  - Se activa “Cristina soy Lex” para obtener estrategias, uso de herramientas y traducciones bajo pedido explícito.

## 💳 Pagos: Daimo, Epayco y Meru

El bot soporta múltiples procesadores para cubrir distintas monedas y regiones. Siguen las instrucciones principales:

  - **Daimo (USDC)**: Generá una billetera USDC y enviá el monto exacto a la dirección indicada en el bot. Incluí tu `user_id` en la referencia y subí un comprobante si hay verificación manual.  
  - **Epayco (USD)**: Elegí el plan desde el menú, seleccioná Epayco y completá los datos de tarjeta o PSE cuando el bot envía el enlace seguro. La confirmación llega por webhook y se actualiza automáticamente tu membresía.  
  - **Meru (Moneda local)**: Si Meru está habilitado, el bot despliega opciones de pago con puntos o balance. Seleccioná el proveedor, confirmá el monto y Meru notifica la activación sin salir del flujo de Telegram.

En todos los casos el usuario recibe mensaje de confirmación y, si es necesario, el equipo de soporte puede verificar desde `/support` o el panel admin.

## 📋 Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- PostgreSQL 14.x or higher
- Redis 7.x
- Telegram Bot Token (from @BotFather)
- (Optional) Sentry account for error tracking
- (Optional) OpenAI API key for AI support
- (Optional) Zoom API credentials
- (Optional) ePayco and Daimo payment provider accounts

## 🎟️ Lifetime100 Promo Activation Flow

The bot now supports a special Lifetime100 promo activation flow that includes:

### User Flow
1. **Command**: User sends `/lifetime100 CODE123` with their activation code
2. **Validation**: Bot validates the code format and checks if it's a valid lifetime100 promo code
3. **Receipt Request**: Bot requests the user to attach their payment receipt
4. **Receipt Processing**: User uploads a photo or document showing their payment
5. **Admin Review**: Admins review the receipt and manually activate the membership
6. **Activation**: User receives confirmation with the special Lifetime100 activation message

### Admin Flow
1. **Manual Activation**: Admins use `/activate_lifetime100 USERID CODE123` to activate after receipt verification
2. **Automatic Notification**: User receives the activation confirmation with channel invite
3. **Logging**: All activations are logged in Firestore for audit purposes

### Payment Methods
- **Excluded from ePayco/Daimo**: Lifetime100 promo is not available through automated payment processors
- **Manual Payment Only**: Users must purchase through the lifetime100 landing page and provide receipt
- **Receipt Storage**: All receipts are stored in Firestore collection `lifetime100Receipts`

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/pnptv-bot.git
cd pnptv-bot
npm install
```

### 2. Environment Configuration

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Edit `.env` with your credentials (see Environment Variables section below).

### 3. Setup Database

Run migrations and seed data:

```bash
# Run database migrations
npm run db:migrate

# Seed default plans
npm run db:seed
```

### 4. Run Development Server

```bash
npm run dev
```

### 5. Run with Docker

```bash
# Start all services (PostgreSQL, Redis, Bot)
docker-compose up -d

# Run migrations
docker-compose exec bot npm run db:migrate

# Seed database
docker-compose exec bot npm run db:seed
```

## 🔧 Environment Variables

### Required Variables

```env
BOT_TOKEN=your_telegram_bot_token
NODE_ENV=development
PORT=3000

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pnptv_bot
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Optional Variables

See `.env.example` for the complete list of configuration options including:
- Payment providers (ePayco, Daimo)
- Zoom API credentials
- OpenAI API key
- Sentry DSN
- Admin user IDs
- Rate limiting settings

## 📁 Project Structure

```
pnptvbot-production/
├── src/
│   ├── bot/
│   │   ├── core/              # Bot initialization and middleware
│   │   │   ├── bot.js         # Main bot entry point
│   │   │   ├── middleware/    # Session, rate limiting, error handling
│   │   │   └── plugins/       # Sentry integration
│   │   ├── handlers/          # Command and callback handlers
│   │   │   ├── admin/         # Admin panel
│   │   │   ├── user/          # User commands (onboarding, profile, menu)
│   │   │   ├── payments/      # Payment processing
│   │   │   └── media/         # Radio, Zoom, live streams, support
│   │   ├── services/          # Business logic layer
│   │   │   ├── userService.js
│   │   │   └── paymentService.js
│   │   └── api/               # REST API and webhooks
│   │       ├── routes.js
│   │       └── controllers/
│   ├── models/                # Data models (PostgreSQL/Sequelize)
│   │   ├── userModel.js
│   │   ├── planModel.js
│   │   └── paymentModel.js
│   ├── utils/                 # Utilities
│   │   ├── i18n.js           # Internationalization
│   │   ├── validation.js     # Input validation
│   │   └── logger.js         # Logging
│   └── config/                # Configuration
│       ├── database.js
│       └── redis.js
├── scripts/                   # Utility scripts
│   ├── cron.js               # Scheduled tasks
│   └── seed.js               # Database seeding
├── tests/                     # Test files
│   ├── unit/
│   └── integration/
├── logs/                      # Application logs
├── docs/                      # Documentation
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

## 🎮 Bot Commands

### User Commands
- `/start` - Start the bot and begin onboarding
- `/menu` - Show main menu
- `/language` - Change language
- `/support` - Access support center

### Admin Commands
- `/admin` - Access admin panel (requires admin privileges)

## 📱 Main Menu Options

1. **💎 Subscribe to PRIME** - View and purchase subscription plans
2. **👤 My Profile** - Manage profile, photos, bio, location
3. **🌍 Nearby Users** - Find users within selected radius
4. **🎤 Live Streams** - Start or view live streams
5. **📻 Radio** - Listen to radio, request songs
6. **🎥 Zoom Rooms** - Create or join video rooms
7. **🤖 Support** - AI chat, contact admin, FAQs
8. **⚙️ Settings** - Language, notifications, privacy

## 🔐 Security Features

- **Input Sanitization**: All user inputs are sanitized to prevent XSS and injection attacks
- **Rate Limiting**: Protection against spam and abuse
- **Session Management**: Secure Redis-based sessions with TTL
- **Payment Verification**: Webhook signature verification for payments
- **Admin Authorization**: Role-based access control
- **Environment Variables**: Sensitive data stored securely
- **Helmet.js**: Security headers for API endpoints

## 🧪 Testing

Run tests:

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Integration tests
npm run test:integration

# Coverage
npm test -- --coverage
```

## 📊 Monitoring and Logging

### Logging

Logs are stored in the `logs/` directory:
- `combined-YYYY-MM-DD.log` - All logs
- `error-YYYY-MM-DD.log` - Error logs only

Logs rotate daily and are kept for 14 days.

### Error Tracking

Sentry integration provides:
- Real-time error tracking
- User context (ID, username, action)
- Stack traces and breadcrumbs
- Performance monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

## 🚢 Deployment

### Docker Deployment

1. Build and run with Docker Compose:

```bash
docker-compose up -d
```

2. View logs:

```bash
docker-compose logs -f bot
```

3. Stop:

```bash
docker-compose down
```

### Production Deployment

1. Set environment to production in `.env`:

```env
NODE_ENV=production
BOT_WEBHOOK_DOMAIN=https://yourdomain.com
BOT_WEBHOOK_PATH=/pnp/webhook/telegram
```

2. Configure webhook mode in production for better performance

3. Set up GitHub Actions secrets for CI/CD:
   - `DOCKER_USERNAME`
   - `DOCKER_PASSWORD`
   - `PRODUCTION_HOST`
   - `PRODUCTION_USER`
   - `PRODUCTION_SSH_KEY`

4. Push to main branch to trigger deployment

## 📈 Scaling Considerations

- **Redis Cluster**: For high availability and horizontal scaling
- **Load Balancer**: Distribute traffic across multiple bot instances
- **PostgreSQL Optimization**: Use composite indexes, connection pooling, and query optimization
- **CDN**: Serve static assets (images, media) via CDN
- **Caching Strategy**: Cache frequently accessed data with appropriate TTLs
- **Queue System**: Implement message queue for broadcasts and background jobs

## 🛠️ Maintenance

### Cron Jobs

The bot includes automated cron jobs (configured in `scripts/cron.js`):

- **Subscription Expiry Check**: Runs daily at midnight
- Processes expired subscriptions and updates user status

### Database Maintenance

- Regularly review and optimize PostgreSQL indexes
- Monitor database performance with pg_stat_statements
- Implement regular backup strategy (pg_dump or continuous archiving)
- Monitor database size and implement data retention policies

## 🐛 Troubleshooting

### Bot Not Responding

1. Check logs: `docker-compose logs -f bot`
2. Verify bot token is correct
3. Check Redis connection
4. Verify webhook is set correctly (production)

### Payment Issues

1. Check webhook configuration and URLs
2. Verify payment provider credentials
3. Review payment logs in PostgreSQL database
4. Check webhook signature verification

### Performance Issues

1. Monitor Redis cache hit rate
2. Review PostgreSQL query performance with EXPLAIN ANALYZE
3. Check for memory leaks
4. Analyze error rates in Sentry

## 📝 API Documentation

### Webhooks

#### ePayco Webhook
```
POST /api/webhooks/epayco
```

Receives payment confirmation from ePayco.

#### Daimo Webhook
```
POST /api/webhooks/daimo
```

Receives payment confirmation from Daimo.

### Public Endpoints

#### Health Check
```
GET /health
```

Returns bot health status.

#### Statistics
```
GET /api/stats
```

Returns user statistics (public).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 👥 Support

For support and questions:
- Email: support@pnptv.com
- Telegram: @pnptv_support
- Documentation: https://docs.pnptv.com

## 🙏 Acknowledgments

- Telegraf.js - Modern Telegram Bot Framework
- PostgreSQL - Robust relational database
- Sequelize - ORM for database operations
- Redis - Caching and sessions
- OpenAI - AI assistant
- Sentry - Error tracking

---

Built with ❤️ for PNPtv
