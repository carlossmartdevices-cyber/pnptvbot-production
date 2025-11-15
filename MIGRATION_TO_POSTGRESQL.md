# Migration from Firestore to PostgreSQL

This document describes the migration from Firebase/Firestore to PostgreSQL database.

## Why PostgreSQL?

The bot has been migrated from Firestore to PostgreSQL for the following benefits:

1. **Cost Reduction**: PostgreSQL is self-hosted and has no per-operation costs
2. **Better Performance**: SQL queries are faster for complex joins and aggregations
3. **Standard SQL**: Use standard SQL instead of NoSQL queries
4. **Advanced Features**: Support for transactions, triggers, stored procedures
5. **Easier Scaling**: Better horizontal and vertical scaling options
6. **Data Integrity**: Strong ACID guarantees and foreign key constraints
7. **Rich Ecosystem**: Extensive tooling and monitoring options

## Changes Made

### 1. Database Schema

Created tables:
- `users` - User profiles and subscription data
- `plans` - Subscription plans
- `payments` - Payment transactions
- `live_streams` - Live stream metadata

All tables include:
- Timestamps (`created_at`, `updated_at`)
- Proper indexes for performance
- Foreign key constraints where appropriate

### 2. Model Updates

**Before (Firestore):**
```javascript
const db = getFirestore();
const doc = await db.collection('users').doc(userId).get();
```

**After (PostgreSQL with Sequelize):**
```javascript
const user = await User.findByPk(userId);
```

### 3. Configuration

**New Environment Variables:**
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pnptv_bot
DB_USER=postgres
DB_PASSWORD=your_password
DB_POOL_MAX=10
DB_POOL_MIN=2
```

**Removed:**
- `FIREBASE_PROJECT_ID`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_DATABASE_URL`

### 4. Docker Updates

Added PostgreSQL service to `docker-compose.yml`:
```yaml
postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_DB: ${DB_NAME}
    POSTGRES_USER: ${DB_USER}
    POSTGRES_PASSWORD: ${DB_PASSWORD}
  volumes:
    - postgres-data:/var/lib/postgresql/data
```

## Setup Instructions

### Local Development

1. **Install PostgreSQL**:
   ```bash
   # macOS
   brew install postgresql@16
   brew services start postgresql@16

   # Ubuntu/Debian
   sudo apt-get install postgresql-16
   sudo systemctl start postgresql

   # Docker
   docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16-alpine
   ```

2. **Create Database**:
   ```bash
   createdb pnptv_bot
   # or
   psql -U postgres -c "CREATE DATABASE pnptv_bot;"
   ```

3. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env and set PostgreSQL credentials
   ```

4. **Run Migrations**:
   ```bash
   npm run db:migrate
   ```

5. **Seed Database**:
   ```bash
   npm run db:seed
   ```

6. **Start Bot**:
   ```bash
   npm run dev
   ```

### Docker Deployment

1. **Update .env**:
   ```bash
   DB_HOST=postgres
   DB_PORT=5432
   DB_NAME=pnptv_bot
   DB_USER=postgres
   DB_PASSWORD=your_secure_password
   ```

2. **Start Services**:
   ```bash
   docker-compose up -d
   ```

3. **Run Migrations**:
   ```bash
   docker-compose exec bot npm run db:migrate
   ```

4. **Seed Database**:
   ```bash
   docker-compose exec bot npm run db:seed
   ```

## Migration Commands

### Create Migration
```bash
npx sequelize-cli migration:generate --name migration-name
```

### Run Migrations
```bash
npm run db:migrate
```

### Undo Last Migration
```bash
npm run db:migrate:undo
```

### Seed Data
```bash
npm run db:seed
```

## Database Management

### Connect to PostgreSQL

**Local:**
```bash
psql -U postgres -d pnptv_bot
```

**Docker:**
```bash
docker-compose exec postgres psql -U postgres -d pnptv_bot
```

### Useful Queries

**View all tables:**
```sql
\dt
```

**View table structure:**
```sql
\d users
```

**Count users:**
```sql
SELECT COUNT(*) FROM users;
```

**View subscriptions:**
```sql
SELECT subscription_status, COUNT(*)
FROM users
GROUP BY subscription_status;
```

**Recent payments:**
```sql
SELECT * FROM payments
ORDER BY created_at DESC
LIMIT 10;
```

## Backup and Restore

### Backup

**Full database:**
```bash
pg_dump -U postgres pnptv_bot > backup.sql
```

**Docker:**
```bash
docker-compose exec postgres pg_dump -U postgres pnptv_bot > backup.sql
```

### Restore

**From backup:**
```bash
psql -U postgres pnptv_bot < backup.sql
```

**Docker:**
```bash
docker-compose exec -T postgres psql -U postgres pnptv_bot < backup.sql
```

## Monitoring

### Connection Pool

Monitor pool status:
```javascript
const { getDatabase } = require('./src/config/database');
const sequelize = getDatabase();

console.log('Pool size:', sequelize.connectionManager.pool.size);
console.log('Available:', sequelize.connectionManager.pool.available);
```

### Query Performance

Enable query logging in development:
```javascript
// In src/config/database.js
logging: (msg) => logger.debug(msg)
```

### Database Size

Check database size:
```sql
SELECT pg_size_pretty(pg_database_size('pnptv_bot'));
```

Check table sizes:
```sql
SELECT
  table_name,
  pg_size_pretty(pg_total_relation_size(table_name::regclass))
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size(table_name::regclass) DESC;
```

## Performance Optimization

### Indexes

All important fields are indexed:
- `users.subscription_status, plan_expiry` - For expiry checks
- `users.location` - For geolocation queries (JSONB GIN index)
- `payments.user_id, created_at` - For payment history
- `payments.transaction_id` - For webhook lookups

### Connection Pooling

Configured for optimal performance:
- Max connections: 10 (adjustable via `DB_POOL_MAX`)
- Min connections: 2 (adjustable via `DB_POOL_MIN`)
- Acquire timeout: 30 seconds
- Idle timeout: 10 seconds

### Caching

Redis caching remains unchanged:
- User data: 10 minutes
- Nearby users: 5 minutes
- Plans: 1 hour

## Troubleshooting

### Connection Refused

Check PostgreSQL is running:
```bash
pg_isready -h localhost -p 5432
```

Check credentials:
```bash
psql -U postgres -d pnptv_bot
```

### Migration Errors

Reset migrations (⚠️ deletes data):
```bash
npm run db:migrate:undo:all
npm run db:migrate
```

### Performance Issues

Check slow queries:
```sql
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

Enable query logging:
```sql
ALTER DATABASE pnptv_bot SET log_statement = 'all';
```

## Production Recommendations

1. **Use Managed PostgreSQL**: AWS RDS, Google Cloud SQL, or DigitalOcean Managed Databases
2. **Enable SSL**: Encrypt connections in production
3. **Regular Backups**: Automated daily backups
4. **Connection Pooling**: Use PgBouncer for high traffic
5. **Monitoring**: Set up alerts for slow queries and connection limits
6. **Read Replicas**: For scaling read operations
7. **Partitioning**: Consider table partitioning for large datasets

## Comparison: Firestore vs PostgreSQL

| Feature | Firestore | PostgreSQL |
|---------|-----------|------------|
| Cost | Pay per operation | Self-hosted or flat fee |
| Queries | NoSQL (limited joins) | Full SQL (complex joins) |
| Transactions | Limited | Full ACID |
| Scaling | Auto-scaling | Manual/managed scaling |
| Tooling | Firebase console | psql, pgAdmin, many tools |
| Backup | Automated | Self-managed |
| Performance | Good for simple queries | Excellent for complex queries |
| Learning Curve | Easy | Moderate |

## Support

For issues related to the PostgreSQL migration:
- Check logs: `docker-compose logs postgres`
- Review migration files in `migrations/`
- See Sequelize docs: https://sequelize.org/docs/v6/

---

**Migration completed successfully! 🎉**

The bot now uses PostgreSQL as its primary database, providing better performance, lower costs, and more flexibility.
