# PostgreSQL Database Integration Tests

## Overview

This directory contains comprehensive integration tests for the PostgreSQL database used in the PNPtv Telegram Bot project. These tests verify database connectivity, table structure, CRUD operations, transactions, data integrity, and performance.

## Test File

- `postgres.test.js` - Main PostgreSQL integration test suite

## Running the Tests

### Run all database integration tests:
```bash
npm test -- tests/integration/database/postgres.test.js
```

### Run with detailed output:
```bash
npm test -- tests/integration/database/postgres.test.js --verbose
```

### Run with coverage:
```bash
npm test -- tests/integration/database/postgres.test.js --coverage
```

## Test Suites

### 1. Database Connection (3 tests)
- ✅ Verifies successful connection to PostgreSQL
- ✅ Checks database version
- ✅ Confirms correct database name

### 2. Table Structure (4 tests)
- ✅ Verifies all required tables exist (users, plans, payments, live_streams, calls, gamification)
- ✅ Validates users table columns
- ✅ Validates plans table columns
- ✅ Validates payments table columns

### 3. Indexes and Constraints (3 tests)
- ✅ Verifies primary keys are defined
- ✅ Checks indexes on frequently queried columns
- ✅ Validates foreign key constraints exist

### 4. CRUD Operations - Users (4 tests)
- ✅ Create a new user
- ✅ Read a user by ID
- ✅ Update user information
- ✅ Delete a user

### 5. CRUD Operations - Plans (2 tests)
- ✅ Retrieve all active plans
- ✅ Get plan by ID

### 6. CRUD Operations - Payments (3 tests)
- ✅ Create a payment record
- ✅ Retrieve payments by user
- ✅ Update payment status

### 7. Transactions (2 tests)
- ✅ Rollback transaction on error
- ✅ Commit transaction successfully

### 8. Complex Queries (3 tests)
- ✅ Join users with their payments
- ✅ Get subscription statistics
- ✅ Get payment statistics by provider

### 9. Data Integrity (2 tests)
- ✅ Enforce unique ID constraint
- ✅ Handle NULL values correctly

### 10. Performance (2 tests)
- ✅ Execute queries efficiently (< 1 second)
- ✅ Handle concurrent queries

### 11. Error Handling (3 tests)
- ✅ Handle syntax errors gracefully
- ✅ Handle non-existent table
- ✅ Handle invalid data types

## Test Statistics

- **Total Tests:** 31
- **All Passing:** ✅ 31/31
- **Test Execution Time:** ~4 seconds

## Database Schema

### Users Table
The tests verify the following key columns in the users table:
- `id` (Primary Key - Telegram User ID)
- `username`
- `first_name`
- `email`
- `role`
- `subscription_status`
- `plan_id`
- `bio`
- `location_lat`
- `location_lng`
- `created_at`
- `updated_at`

### Plans Table
- `id`
- `name`
- `price`
- `duration`
- `features`
- `active`

### Payments Table
- `id`
- `user_id` (Foreign Key to users)
- `plan_id` (Foreign Key to plans)
- `amount`
- `currency`
- `status`
- `provider`
- `created_at`

## Key Features Tested

1. **Database Connectivity**
   - Connection pooling
   - Query execution
   - Error handling

2. **Data Operations**
   - INSERT, SELECT, UPDATE, DELETE
   - Complex joins
   - Aggregations
   - Transactions with COMMIT and ROLLBACK

3. **Data Integrity**
   - Primary key constraints
   - Foreign key constraints
   - Unique constraints
   - NULL handling

4. **Performance**
   - Query execution time
   - Concurrent query handling
   - Index utilization

5. **Error Handling**
   - Invalid SQL syntax
   - Non-existent tables
   - Invalid data types
   - Constraint violations

## Environment Requirements

The tests require the following environment variables:
- `POSTGRES_HOST` (default: localhost)
- `POSTGRES_PORT` (default: 55432)
- `POSTGRES_DATABASE` (default: pnptvbot)
- `POSTGRES_USER` (default: pnptvbot)
- `POSTGRES_PASSWORD`

## Test Data Cleanup

All tests include proper cleanup mechanisms:
- Test data is automatically deleted after each test
- Uses unique test IDs to avoid conflicts
- Handles cleanup errors gracefully

## Coverage

The tests provide coverage for:
- `src/config/postgres.js` - ~70% coverage
- Database schema validation
- Query functionality
- Error scenarios

## Best Practices

1. **Isolation**: Each test is isolated and doesn't depend on others
2. **Cleanup**: All test data is cleaned up after execution
3. **Uniqueness**: Test IDs use random numbers to avoid conflicts
4. **Error Handling**: Tests properly handle and verify error cases
5. **Performance**: Tests verify query execution within acceptable time limits

## Troubleshooting

### Connection Issues
If tests fail to connect to PostgreSQL:
1. Verify PostgreSQL is running: `sudo systemctl status postgresql`
2. Check environment variables are set correctly
3. Verify PostgreSQL port (55432) is accessible

### Test Failures
If specific tests fail:
1. Check the error message for details
2. Verify database schema matches expected structure
3. Ensure PostgreSQL has required permissions
4. Check for existing test data that wasn't cleaned up

## Future Enhancements

Potential additions to the test suite:
- [ ] Performance benchmarking
- [ ] Load testing with many concurrent operations
- [ ] Database migration tests
- [ ] Backup and restore tests
- [ ] Replication testing (if applicable)

## Contributing

When adding new database features:
1. Add corresponding tests to this suite
2. Ensure all tests pass before committing
3. Update this README with new test descriptions
4. Maintain test isolation and cleanup
