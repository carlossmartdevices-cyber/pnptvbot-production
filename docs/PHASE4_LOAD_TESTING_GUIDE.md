# 🏃 Phase 4: Load Testing & Performance Guide

**Date**: February 13, 2026
**Status**: Ready for deployment
**Load Test Tools**: Artillery, k6, Custom benchmarks

---

## 📋 QUICK START

### 1. Install Dependencies
```bash
npm install artillery k6
npm install --save-dev @artillery/plugin-expect
```

### 2. Run Load Tests

#### Artillery (Recommended)
```bash
# Full load test (1-200 RPS ramping)
artillery run load-tests/artillery-config.yml

# With custom API URL
API_URL=https://api.example.com artillery run load-tests/artillery-config.yml

# Generate HTML report
artillery run load-tests/artillery-config.yml --output results.json
artillery report results.json
```

#### k6 (Advanced)
```bash
# Install k6
brew install k6  # macOS
# or download from https://k6.io/docs/getting-started/installation/

# Run load test
k6 run load-tests/k6-load-test.js

# With custom settings
K6_VUS=100 K6_DURATION=10m k6 run load-tests/k6-load-test.js

# Load test from file
k6 run load-tests/k6-load-test.js --vus 50 --duration 5m
```

#### Redis Benchmark
```bash
# Start Redis first
redis-server

# Run benchmark in another terminal
REDIS_URL=redis://localhost:6379 node load-tests/redis-benchmark.js
```

#### PostgreSQL Benchmark
```bash
# Setup database
psql your_database -f database/migrations/050_add_postgis_geolocation.sql

# Run benchmark
DATABASE_URL=postgresql://user:pass@localhost/db node load-tests/postgres-benchmark.js
```

---

## 🎯 LOAD TEST SCENARIOS

### Scenario 1: Location Update Load
**What it tests**: POST /api/nearby/update-location
**Target**: 100 concurrent users updating locations
**Expected behavior**:
- ✅ 90% requests complete within 200ms
- ✅ Rate limiting kicks in (429 responses)
- ✅ Requests queued and retried

### Scenario 2: Nearby Search Load
**What it tests**: GET /api/nearby/search
**Target**: 50 concurrent searches with 5km radius
**Expected behavior**:
- ✅ Redis GEO queries return in ~50ms
- ✅ Results include 20-50 nearby users
- ✅ Privacy filtering applied (obfuscated coords)

### Scenario 3: Rate Limit Stress
**What it tests**: Rate limiting enforcement
**Target**: Trigger 429 responses
**Expected behavior**:
- ✅ Max 1 update per 5 seconds per user
- ✅ 429 response with retry_after header
- ✅ Client-side queue handles retries

### Scenario 4: Batch Update
**What it tests**: POST /api/nearby/batch-update (testing endpoint)
**Target**: Bulk location updates
**Expected behavior**:
- ✅ Process 1000+ locations simultaneously
- ✅ Report success/failure per user
- ✅ Handle partial failures gracefully

### Scenario 5: Error Handling
**What it tests**: Invalid input, missing auth, bad coordinates
**Target**: Error response codes
**Expected behavior**:
- ✅ Invalid coords → 400
- ✅ Missing auth → 401
- ✅ Missing fields → 400
- ✅ Server errors → 500

---

## 📊 PERFORMANCE TARGETS

| Metric | Target | Actual |
|--------|--------|--------|
| Location Update Latency (p95) | < 200ms | - |
| Search Latency (p95) | < 500ms | - |
| Rate Limit Enforcement | 100% | - |
| Error Rate | < 1% | - |
| Throughput | 100+ RPS | - |
| Concurrent Users | 200+ | - |

---

## 🔍 DETAILED TEST EXPLANATIONS

### Artillery Configuration

**Phases**:
1. **Warm up** (60s, 0-10 RPS)
   - Initialize connections
   - Verify endpoints working
   - Populate caches

2. **Sustained Load** (300s, 50 RPS)
   - Normal production load
   - Measure baseline performance
   - Check for memory leaks

3. **Spike** (120s, 200 RPS)
   - Test burst capacity
   - Verify rate limiting
   - Check error handling

4. **Cool down** (60s, 10 RPS)
   - Graceful shutdown
   - Final metrics collection

**Metrics Collected**:
- Response time (min, max, p50, p95, p99)
- Throughput (requests/second)
- Error rate (4xx, 5xx responses)
- Specific endpoint metrics

### k6 Load Test

**Virtual Users (VUs)**: 10 → 50 → 200 → 10
**Duration**: ~10 minutes total
**Test Distribution**:
- 40% Location updates
- 30% Nearby searches
- 15% Rate limit tests
- 10% Error handling
- 5% Statistics queries

**Thresholds** (pass/fail criteria):
- 95% of requests < 500ms
- 99% of requests < 1000ms
- Error rate < 10%
- Custom error rate < 5%

### Redis Benchmark

**Operations tested**:
- GEOADD: Add location to GEO set (~1000 iterations)
- GEORADIUS: Search nearby users (~100 iterations)
- HSET: Store user metadata (~1000 iterations)
- HGETALL: Retrieve metadata (~1000 iterations)
- Complex workflow: Realistic scenario (~100 iterations)

**Expected Results**:
```
GEOADD:     < 1ms (per operation)
GEORADIUS:  < 50ms (5km search with 1000 users)
HSET:       < 0.5ms
HGETALL:    < 0.5ms
Workflow:   < 200ms (update + search + fetch metadata)
```

### PostgreSQL Benchmark

**Operations tested**:
- INSERT: Add 1000 location records
- UPDATE: Update 1000 records with geom calculation
- SELECT: Simple indexed query on user_id
- ST_DWithin: Spatial search within radius
- EXPLAIN ANALYZE: Query execution plans

**Expected Results**:
```
INSERT:       < 5ms per record
UPDATE:       < 5ms per record
SELECT:       < 2ms (indexed)
ST_DWithin:   < 200ms (50 results from 1000)
```

---

## 📈 INTERPRETING RESULTS

### Good Results ✅
```
Response Times:
✅ p50: 50ms   (median is fast)
✅ p95: 200ms  (95% of users see < 200ms)
✅ p99: 500ms  (even worst case < 500ms)

Error Rate: 0.5% (< 1%)
Throughput: 150 RPS sustained
```

### Performance Issues ⚠️
```
Response Times:
❌ p50: 500ms   (median is slow)
❌ p95: 2000ms  (95% of users see slow response)
❌ p99: 5000ms  (some users wait 5+ seconds)

Error Rate: 5-10% (too many failures)
Throughput: 20 RPS (bottleneck)
```

### Optimization Needed 🔴
```
Response Times:
🔴 p50: 2000ms+ (extremely slow)
🔴 p95: 5000ms+ (unacceptable)
🔴 Error Rate: > 10% (system unstable)

Immediate actions needed:
1. Scale horizontally (more servers)
2. Add caching (Redis for hot data)
3. Optimize queries (add indices)
4. Increase database connections
```

---

## 🔧 TROUBLESHOOTING

### Issue: High Response Times
**Diagnosis**:
```bash
# Check Redis connection
redis-cli ping                    # Should return PONG

# Check PostgreSQL slow queries
psql -c "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC;"

# Monitor system resources
top                              # Check CPU, memory, I/O
```

**Solutions**:
1. ✅ Add database indices
2. ✅ Increase connection pool size
3. ✅ Enable query caching (Redis)
4. ✅ Scale vertically (more CPU/RAM)
5. ✅ Scale horizontally (more servers + load balancer)

### Issue: Rate Limiting Not Working
**Check**:
```javascript
// Verify rate limit enforcement
const rateLimitCheck = nearbyService.checkRateLimit(userId);
console.log(rateLimitCheck);  // Should show { allowed: false, waitSeconds: 3 }
```

**Solutions**:
1. ✅ Verify rate limit window (5 seconds)
2. ✅ Check client-side queue logic
3. ✅ Ensure server-side validation

### Issue: Memory Leaks
**Monitor**:
```bash
# Watch memory usage during load test
watch -n 1 'ps aux | grep node | grep -v grep'

# Use clinic.js for detailed profiling
npm install -g clinic
clinic doctor -- node src/bot/core/bot.js
```

**Solutions**:
1. ✅ Clear old locations from Redis (5-minute TTL)
2. ✅ Archive location history
3. ✅ Restart workers periodically

---

## 📦 DEPLOYMENT CHECKLIST

Before production:
- [ ] Run all 4 load tests (Artillery, k6, Redis, PostgreSQL)
- [ ] Verify response times meet targets
- [ ] Error rate < 1%
- [ ] No memory leaks detected
- [ ] Rate limiting working correctly
- [ ] Database indices optimized
- [ ] Redis memory usage acceptable
- [ ] Connection pooling configured
- [ ] Monitoring/alerting in place
- [ ] Runbooks created for common issues

---

## 📊 SAMPLE OUTPUT

### Artillery Report
```
Summary report @ 11:42:57(+0000) 2026-02-13
  Scenarios launched:  100
  Scenarios completed: 100
  Requests launched:   500
  Requests completed:  498
  Mean response/sec:   8.3
  Response time (msec):
    min: 45
    max: 892
    median: 120
    p95: 450
    p99: 650
  Scenario counts:
    Location Update Flow: 50
    Nearby Search Flow: 30
    Error Handling: 20
  Codes:
    200: 490
    400: 5
    401: 3
    429: 2
```

### k6 Results
```
✓ status is 200
✓ response is success
✓ has user_id
✓ has timestamp

    checks..........................................: 95.50% ✓ 1910   ✗ 90
    data_received...................: 2.3 MB
    data_sent..........................: 1.1 MB
    http_req_duration..................: avg=185ms  p(95)=450ms  p(99)=680ms
    http_req_failed.....................: 0.50%
    http_reqs.............................: 2000
    iteration_duration..................: avg=5.2s   min=4s     max=8s
    vus.................................: 1      min=1     max=200
    vus_max.............................: 200
```

---

## 🎓 LEARNING RESOURCES

- [Artillery Documentation](https://artillery.io/docs)
- [k6 Documentation](https://k6.io/docs)
- [PostgreSQL Query Performance](https://www.postgresql.org/docs/current/performance-tips.html)
- [PostGIS Spatial Indexing](https://postgis.net/workshops/postgis-intro/indexing.html)
- [Redis Performance Tuning](https://redis.io/topics/latency)

---

## ✅ COMPLETION CRITERIA

Phase 4 is complete when:
- ✅ All load tests run without errors
- ✅ Response times meet targets (p95 < 500ms)
- ✅ Error rate < 1%
- ✅ Sustained 100+ concurrent users
- ✅ Rate limiting verified working
- ✅ No memory leaks detected
- ✅ Monitoring dashboards created
- ✅ Performance baseline documented

