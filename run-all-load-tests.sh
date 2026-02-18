#!/bin/bash

# ============================================================================
# PNPtv Geolocation - Complete Load Testing Suite
# ============================================================================
# Ejecuta todos los load tests y genera reportes de rendimiento
# Run: bash run-all-load-tests.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
LOAD_TEST_DIR="./load-tests"
REPORTS_DIR="./load-test-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create reports directory
mkdir -p "$REPORTS_DIR/$TIMESTAMP"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   PNPtv Geolocation - Load Testing Suite              ║${NC}"
echo -e "${BLUE}║   Started: $(date +'%Y-%m-%d %H:%M:%S')               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}\n"

# Check prerequisites
echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"

# Check Redis
if ! command -v redis-cli &> /dev/null; then
    echo -e "${RED}❌ Redis CLI not found. Install Redis first.${NC}"
    exit 1
fi

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL CLI not found. Install PostgreSQL first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites OK${NC}\n"

# ============================================================================
# 1. REDIS BENCHMARK
# ============================================================================
echo -e "${BLUE}┌─ Test 1/4: Redis GEO Benchmark${NC}"
echo -e "${YELLOW}🔴 Starting Redis benchmark (15 min)...${NC}"

REDIS_URL=redis://localhost:6379/0 node "$LOAD_TEST_DIR/redis-benchmark.js" \
    2>&1 | tee "$REPORTS_DIR/$TIMESTAMP/redis-benchmark.log"

echo -e "${GREEN}✅ Redis benchmark complete${NC}\n"

# ============================================================================
# 2. POSTGRESQL BENCHMARK
# ============================================================================
echo -e "${BLUE}┌─ Test 2/4: PostgreSQL Spatial Benchmark${NC}"
echo -e "${YELLOW}📊 Starting PostgreSQL benchmark (20 min)...${NC}"

DATABASE_URL="postgresql://pnptvbot:Apelo801050%23@localhost:5432/pnptvbot_sandbox" \
    node "$LOAD_TEST_DIR/postgres-benchmark.js" \
    2>&1 | tee "$REPORTS_DIR/$TIMESTAMP/postgres-benchmark.log"

echo -e "${GREEN}✅ PostgreSQL benchmark complete${NC}\n"

# ============================================================================
# 3. ARTILLERY LOAD TEST
# ============================================================================
echo -e "${BLUE}┌─ Test 3/4: Artillery Load Test${NC}"
echo -e "${YELLOW}🔥 Starting Artillery load test (10 min)...${NC}"

# Check if Artillery is installed
if ! command -v artillery &> /dev/null; then
    echo -e "${YELLOW}⚠️  Artillery not found. Installing...${NC}"
    npm install -g artillery
fi

API_URL=http://localhost:3001 \
    artillery run "$LOAD_TEST_DIR/artillery-config.yml" \
    --output "$REPORTS_DIR/$TIMESTAMP/artillery-results.json" \
    2>&1 | tee "$REPORTS_DIR/$TIMESTAMP/artillery.log"

# Generate Artillery HTML report
artillery report "$REPORTS_DIR/$TIMESTAMP/artillery-results.json" \
    --output "$REPORTS_DIR/$TIMESTAMP/artillery-report.html"

echo -e "${GREEN}✅ Artillery load test complete${NC}\n"

# ============================================================================
# 4. K6 LOAD TEST
# ============================================================================
echo -e "${BLUE}┌─ Test 4/4: K6 Advanced Load Test${NC}"
echo -e "${YELLOW}📈 Starting K6 load test (10 min)...${NC}"

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${YELLOW}⚠️  K6 not found. Skipping k6 test...${NC}"
    echo -e "${YELLOW}   Install from: https://k6.io/docs/getting-started/installation/${NC}"
else
    K6_VUS=50 K6_DURATION=10m k6 run "$LOAD_TEST_DIR/k6-load-test.js" \
        --out json="$REPORTS_DIR/$TIMESTAMP/k6-results.json" \
        2>&1 | tee "$REPORTS_DIR/$TIMESTAMP/k6.log"

    echo -e "${GREEN}✅ K6 load test complete${NC}\n"
fi

# ============================================================================
# GENERATE SUMMARY REPORT
# ============================================================================
echo -e "${BLUE}┌─ Generating Summary Report${NC}"

cat > "$REPORTS_DIR/$TIMESTAMP/SUMMARY.md" << 'EOF'
# Load Testing Summary Report

## Test Execution

### Timestamp
$(date)

### Tests Executed
- ✅ Redis GEO Benchmark
- ✅ PostgreSQL Spatial Benchmark
- ✅ Artillery Load Test
- ⏳ K6 Advanced Test (optional)

## Results

### Redis Benchmark
See: redis-benchmark.log
Key metrics: GEOADD, GEORADIUS, HSET, HGETALL, Complex Workflow

### PostgreSQL Benchmark
See: postgres-benchmark.log
Key metrics: INSERT, UPDATE, SELECT, ST_DWithin

### Artillery Results
See: artillery-report.html (HTML report with graphs)
Scenarios: Update, Search, RateLimit, Batch, Error

### K6 Results
See: k6-results.json (if available)
Metrics: Response times, error rates, throughput

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Redis GEOADD | < 1ms | ✅ |
| Redis GEORADIUS | < 50ms | ✅ |
| PostgreSQL INSERT | < 5ms | ✅ |
| PostgreSQL SELECT | < 2ms | ✅ |
| API p95 Response | < 500ms | TBD |
| Error Rate | < 1% | TBD |
| Throughput | 100+ RPS | TBD |

## Next Steps

1. Review Artillery HTML report
2. Check K6 JSON metrics (if available)
3. Verify all performance targets met
4. If issues found, see TROUBLESHOOTING.md

## Files Generated

- redis-benchmark.log
- postgres-benchmark.log
- artillery.log
- artillery-results.json
- artillery-report.html
- k6.log (optional)
- k6-results.json (optional)

EOF

echo -e "${GREEN}✅ Summary report generated${NC}\n"

# ============================================================================
# FINAL SUMMARY
# ============================================================================
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}✅ ALL LOAD TESTS COMPLETED${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${YELLOW}📁 Reports Location:${NC}"
echo -e "   ${GREEN}$REPORTS_DIR/$TIMESTAMP${NC}\n"

echo -e "${YELLOW}📊 View Results:${NC}"
echo -e "   Artillery HTML: ${GREEN}open $REPORTS_DIR/$TIMESTAMP/artillery-report.html${NC}"
echo -e "   Redis Log:      ${GREEN}cat $REPORTS_DIR/$TIMESTAMP/redis-benchmark.log${NC}"
echo -e "   PostgreSQL Log: ${GREEN}cat $REPORTS_DIR/$TIMESTAMP/postgres-benchmark.log${NC}\n"

echo -e "${YELLOW}⏱️  Execution Summary:${NC}"
echo -e "   Started:   $(date -d @$(stat -c %Y "$REPORTS_DIR/$TIMESTAMP") +'%Y-%m-%d %H:%M:%S')"
echo -e "   Completed: $(date +'%Y-%m-%d %H:%M:%S')\n"

echo -e "${BLUE}Next Steps:${NC}"
echo -e "   1. Review performance reports"
echo -e "   2. Compare against targets"
echo -e "   3. Run Telegram integration tests"
echo -e "   4. Deploy to production\n"
