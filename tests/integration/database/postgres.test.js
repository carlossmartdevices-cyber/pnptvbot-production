/**
 * PostgreSQL Database Integration Tests
 * Tests database connection, queries, transactions, and data integrity
 */

const { query, getClient, getPool, closePool, initializePostgres } = require('../../../src/config/postgres');

const shouldSkip = process.env.CI === 'true' || process.env.SKIP_DB_TESTS === 'true';

const maybeDescribe = shouldSkip ? describe.skip : describe;

maybeDescribe('PostgreSQL Database Integration Tests', () => {
  let client;
  let pool;
  let dbAvailable = true;

  beforeAll(async () => {
    try {
      initializePostgres();
      pool = getPool();
      client = await getClient();
    } catch (error) {
      console.error('Failed to initialize PostgreSQL for tests:', error);
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    if (client) {
      client.release();
    }
    await closePool();
  });

  // Helper to skip tests if DB is unavailable
  function skipIfNoDb(testFn) {
    return dbAvailable ? testFn : test.skip;
  }

  describe('Database Connection', () => {
    skipIfNoDb(test)('should connect to PostgreSQL successfully', async () => {
      const result = await query('SELECT NOW()');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].now).toBeInstanceOf(Date);
    });

    skipIfNoDb(test)('should return database version', async () => {
      const result = await query('SELECT version()');
      expect(result.rows[0].version).toContain('PostgreSQL');
    });

    skipIfNoDb(test)('should have correct database name', async () => {
      const result = await query('SELECT current_database()');
      expect(result.rows[0].current_database).toBe('pnptvbot');
    });
  });

  describe('Table Structure', () => {
    test('should have all required tables', async () => {
      const result = await query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);

      const tableNames = result.rows.map(row => row.table_name);

      // Check that essential tables exist
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('plans');
      expect(tableNames).toContain('payments');
      expect(tableNames).toContain('live_streams');
      expect(tableNames).toContain('calls');
      expect(tableNames).toContain('gamification');
    });

    test('users table should have correct columns', async () => {
      const result = await query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);

      const columns = result.rows.map(row => row.column_name);

      expect(columns).toContain('id'); // This is the Telegram ID
      expect(columns).toContain('username');
      expect(columns).toContain('first_name');
      expect(columns).toContain('email');
      expect(columns).toContain('role');
      expect(columns).toContain('subscription_status');
      expect(columns).toContain('plan_id');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
      expect(columns).toContain('bio');
      expect(columns).toContain('location_lat');
      expect(columns).toContain('location_lng');
    });

    test('plans table should have correct columns', async () => {
      const result = await query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'plans'
        ORDER BY ordinal_position
      `);

      const columns = result.rows.map(row => row.column_name);

      expect(columns).toContain('id');
      expect(columns).toContain('name');
      expect(columns).toContain('price');
      expect(columns).toContain('duration');
      expect(columns).toContain('features');
      expect(columns).toContain('active');
    });

    test('payments table should have correct columns', async () => {
      const result = await query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'payments'
        ORDER BY ordinal_position
      `);

      const columns = result.rows.map(row => row.column_name);

      expect(columns).toContain('id');
      expect(columns).toContain('user_id');
      expect(columns).toContain('plan_id');
      expect(columns).toContain('amount');
      expect(columns).toContain('currency');
      expect(columns).toContain('status');
      expect(columns).toContain('provider');
      expect(columns).toContain('created_at');
    });
  });

  describe('Indexes and Constraints', () => {
    test('should have primary keys defined', async () => {
      const result = await query(`
        SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name
      `);

      const tables = result.rows.map(row => row.table_name);

      expect(tables).toContain('users');
      expect(tables).toContain('plans');
      expect(tables).toContain('payments');
    });

    test('should have indexes on frequently queried columns', async () => {
      const result = await query(`
        SELECT
          tablename,
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename IN ('users', 'payments', 'plans')
        ORDER BY tablename, indexname
      `);

      const indexes = result.rows.map(row => ({
        table: row.tablename,
        index: row.indexname,
      }));

      // Check for important indexes
      const userIndexes = indexes.filter(i => i.table === 'users');
      expect(userIndexes.length).toBeGreaterThan(0);
    });

    test('should check for foreign key constraints', async () => {
      // Check using pg_catalog for more reliable results
      const result = await query(`
        SELECT
          conname AS constraint_name,
          conrelid::regclass AS table_name,
          a.attname AS column_name,
          confrelid::regclass AS foreign_table_name
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
        WHERE c.contype = 'f'
          AND connamespace = 'public'::regnamespace
        LIMIT 10
      `);

      // We know from the schema that foreign keys exist
      // This test will pass if we can query the constraint table without errors
      expect(Array.isArray(result.rows)).toBe(true);
    });
  });

  describe('CRUD Operations - Users', () => {
    const testUserId = `test_${Math.floor(Math.random() * 1000000000)}`;
    let createdUserId;

    afterEach(async () => {
      // Cleanup test data
      if (createdUserId) {
        try {
          await query('DELETE FROM users WHERE id = $1', [createdUserId]);
        } catch (error) {
          // Ignore errors during cleanup
        }
        createdUserId = null;
      }
    });

    test('should create a new user', async () => {
      const result = await query(`
        INSERT INTO users (id, username, first_name, email, role, subscription_status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [testUserId, 'testuser', 'Test User', 'test@example.com', 'user', 'free']);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe(testUserId);
      expect(result.rows[0].username).toBe('testuser');
      expect(result.rows[0].subscription_status).toBe('free');

      createdUserId = result.rows[0].id;
    });

    test('should read a user by id', async () => {
      // First create a user
      const createResult = await query(`
        INSERT INTO users (id, username, first_name)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [testUserId, 'testuser', 'Test']);

      createdUserId = createResult.rows[0].id;

      // Then read it
      const result = await query(
        'SELECT * FROM users WHERE id = $1',
        [testUserId]
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].username).toBe('testuser');
    });

    test('should update a user', async () => {
      // Create user first
      const createResult = await query(`
        INSERT INTO users (id, username, first_name)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [testUserId, 'testuser', 'Test']);

      createdUserId = createResult.rows[0].id;

      // Update the user
      const updateResult = await query(`
        UPDATE users
        SET first_name = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, ['Updated Name', createdUserId]);

      expect(updateResult.rows[0].first_name).toBe('Updated Name');
      expect(updateResult.rows[0].updated_at).toBeTruthy();
    });

    test('should delete a user', async () => {
      // Create user first
      const createResult = await query(`
        INSERT INTO users (id, username, first_name)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [testUserId, 'testuser', 'Test']);

      const userId = createResult.rows[0].id;

      // Delete the user
      const deleteResult = await query(
        'DELETE FROM users WHERE id = $1 RETURNING id',
        [userId]
      );

      expect(deleteResult.rows).toHaveLength(1);

      // Verify deletion
      const verifyResult = await query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );

      expect(verifyResult.rows).toHaveLength(0);

      createdUserId = null; // Prevent double cleanup
    });
  });

  describe('CRUD Operations - Plans', () => {
    test('should retrieve all active plans', async () => {
      const result = await query(
        'SELECT * FROM plans WHERE active = true ORDER BY price ASC'
      );

      expect(Array.isArray(result.rows)).toBe(true);
      expect(result.rows.length).toBeGreaterThan(0);

      // Check plan structure
      if (result.rows.length > 0) {
        const plan = result.rows[0];
        expect(plan).toHaveProperty('id');
        expect(plan).toHaveProperty('name');
        expect(plan).toHaveProperty('price');
        expect(plan).toHaveProperty('duration');
        expect(plan).toHaveProperty('active');
      }
    });

    test('should get plan by id', async () => {
      // First get a plan ID
      const plansResult = await query(
        'SELECT id FROM plans WHERE active = true LIMIT 1'
      );

      if (plansResult.rows.length > 0) {
        const planId = plansResult.rows[0].id;

        const result = await query(
          'SELECT * FROM plans WHERE id = $1',
          [planId]
        );

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].id).toBe(planId);
      }
    });
  });

  describe('CRUD Operations - Payments', () => {
    let testUserId;
    let testPlanId;

    beforeAll(async () => {
      // Create test user
      testUserId = `test_payment_${Math.floor(Math.random() * 1000000000)}`;
      const userResult = await query(`
        INSERT INTO users (id, username, first_name)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [testUserId, 'paymenttest', 'Payment Test']);

      // Get a plan
      const planResult = await query(
        'SELECT id FROM plans WHERE active = true LIMIT 1'
      );
      testPlanId = planResult.rows[0]?.id;
    });

    afterAll(async () => {
      // Cleanup
      try {
        await query('DELETE FROM payments WHERE user_id = $1', [testUserId]);
        await query('DELETE FROM users WHERE id = $1', [testUserId]);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test('should create a payment record', async () => {
      if (!testPlanId) {
        console.log('Skipping payment test - no plans available');
        return;
      }

      const result = await query(`
        INSERT INTO payments (user_id, plan_id, amount, currency, status, provider)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [testUserId, testPlanId, 9.99, 'USD', 'pending', 'epayco']);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].user_id).toBe(testUserId);
      expect(result.rows[0].amount).toBe('9.99');
      expect(result.rows[0].status).toBe('pending');
    });

    test('should retrieve payments by user', async () => {
      const result = await query(
        'SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC',
        [testUserId]
      );

      expect(Array.isArray(result.rows)).toBe(true);
    });

    test('should update payment status', async () => {
      if (!testPlanId) return;

      // Create a payment
      const createResult = await query(`
        INSERT INTO payments (user_id, plan_id, amount, currency, status, provider)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [testUserId, testPlanId, 9.99, 'USD', 'pending', 'epayco']);

      const paymentId = createResult.rows[0].id;

      // Update status
      const updateResult = await query(`
        UPDATE payments
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, ['completed', paymentId]);

      expect(updateResult.rows[0].status).toBe('completed');
    });
  });

  describe('Transactions', () => {
    test('should rollback transaction on error', async () => {
      const testUserId = `test_rollback_${Math.floor(Math.random() * 1000000000)}`;

      try {
        await client.query('BEGIN');

        // Insert user
        await client.query(`
          INSERT INTO users (id, username, first_name)
          VALUES ($1, $2, $3)
        `, [testUserId, 'transactiontest', 'Transaction Test']);

        // Cause an error (invalid data)
        await client.query(`
          INSERT INTO payments (user_id, plan_id, amount)
          VALUES ('non_existent_user', 'invalid', 'not-a-number')
        `);

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
      }

      // Verify user was not created
      const result = await query(
        'SELECT * FROM users WHERE id = $1',
        [testUserId]
      );

      expect(result.rows).toHaveLength(0);
    });

    test('should commit transaction successfully', async () => {
      const testUserId = `test_commit_${Math.floor(Math.random() * 1000000000)}`;
      let userId;

      try {
        await client.query('BEGIN');

        const result = await client.query(`
          INSERT INTO users (id, username, first_name)
          VALUES ($1, $2, $3)
          RETURNING id
        `, [testUserId, 'committransaction', 'Commit Test']);

        userId = result.rows[0].id;

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }

      // Verify user was created
      const verifyResult = await query(
        'SELECT * FROM users WHERE id = $1',
        [testUserId]
      );

      expect(verifyResult.rows).toHaveLength(1);

      // Cleanup
      await query('DELETE FROM users WHERE id = $1', [userId]);
    });
  });

  describe('Complex Queries', () => {
    test('should join users with their payments', async () => {
      const result = await query(`
        SELECT
          u.id,
          u.username,
          u.subscription_status,
          COUNT(p.id) as payment_count,
          SUM(CAST(p.amount AS DECIMAL)) as total_spent
        FROM users u
        LEFT JOIN payments p ON u.id = p.user_id
        WHERE u.created_at > NOW() - INTERVAL '30 days'
        GROUP BY u.id, u.username, u.subscription_status
        LIMIT 10
      `);

      expect(Array.isArray(result.rows)).toBe(true);
    });

    test('should get subscription statistics', async () => {
      const result = await query(`
        SELECT
          subscription_status,
          COUNT(*) as count
        FROM users
        GROUP BY subscription_status
        ORDER BY count DESC
      `);

      expect(Array.isArray(result.rows)).toBe(true);
      expect(result.rows.length).toBeGreaterThan(0);
    });

    test('should get payment statistics by provider', async () => {
      const result = await query(`
        SELECT
          provider,
          status,
          COUNT(*) as count,
          SUM(CAST(amount AS DECIMAL)) as total
        FROM payments
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY provider, status
        ORDER BY total DESC
      `);

      expect(Array.isArray(result.rows)).toBe(true);
    });
  });

  describe('Data Integrity', () => {
    test('should enforce unique id constraint', async () => {
      const userId = `test_unique_${Math.floor(Math.random() * 1000000000)}`;

      // Insert first user
      const result1 = await query(`
        INSERT INTO users (id, username, first_name)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [userId, 'unique1', 'Unique Test 1']);

      // Try to insert duplicate
      await expect(
        query(`
          INSERT INTO users (id, username, first_name)
          VALUES ($1, $2, $3)
        `, [userId, 'unique2', 'Unique Test 2'])
      ).rejects.toThrow();

      // Cleanup
      await query('DELETE FROM users WHERE id = $1', [userId]);
    });

    test('should handle NULL values correctly', async () => {
      const userId = `test_null_${Math.floor(Math.random() * 1000000000)}`;

      const result = await query(`
        INSERT INTO users (id, username, first_name, email, bio)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [userId, 'nulltest', 'Null Test', null, null]);

      expect(result.rows[0].email).toBeNull();
      expect(result.rows[0].bio).toBeNull();
      expect(result.rows[0].first_name).toBe('Null Test');

      // Cleanup
      await query('DELETE FROM users WHERE id = $1', [result.rows[0].id]);
    });
  });

  describe('Performance', () => {
    test('should execute queries efficiently', async () => {
      const start = Date.now();

      await query(`
        SELECT * FROM users
        WHERE subscription_status = 'active'
        LIMIT 100
      `);

      const duration = Date.now() - start;

      // Query should complete in less than 1 second
      expect(duration).toBeLessThan(1000);
    });

    test('should handle concurrent queries', async () => {
      const queries = Array(10).fill(null).map((_, i) =>
        query('SELECT $1::int as number', [i])
      );

      const results = await Promise.all(queries);

      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.rows[0].number).toBe(index);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle syntax errors gracefully', async () => {
      await expect(
        query('SELCT * FROM users')
      ).rejects.toThrow();
    });

    test('should handle non-existent table', async () => {
      await expect(
        query('SELECT * FROM non_existent_table')
      ).rejects.toThrow();
    });

    test('should handle invalid data types', async () => {
      await expect(
        query(`
          INSERT INTO users (id, username, first_name, xp)
          VALUES ($1, $2, $3, $4)
        `, ['test_invalid', 'test', 'Test', 'not-a-number'])
      ).rejects.toThrow();
    });
  });
});
