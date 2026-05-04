# Implementation Checklist & Migration Guide

## Phase 1: Installation & Setup

### Step 1: Install Dependencies

```bash
npm install
```

This installs:
- `node-cache`: In-memory caching
- `csv-parser`: CSV parsing
- `multer`: File upload handling

### Step 2: Verify Configuration

Check these files are updated:
- ✅ `package.json` - Dependencies added
- ✅ `app.js` - Multer middleware configured
- ✅ `services/cacheService.js` - New file
- ✅ `services/csvIngestionService.js` - New file
- ✅ `models/profileModel.js` - Updated with caching
- ✅ `controllers/profileController.js` - CSV upload handler added
- ✅ `routes/profileRoutes.js` - New CSV endpoint added

### Step 3: Start Server

```bash
npm start
```

Verify:
- Server starts without errors
- No missing module errors
- Cache initialized successfully

---

## Phase 2: Functionality Testing

### Test 1: Query Caching

**Goal**: Verify that repeated queries hit the cache

```bash
# First request (cache miss, database hit)
curl -X GET "http://localhost:3000/api/v1/profiles/search?q=young%20females%20in%20Nigeria" \
  -H "Authorization: Bearer $TOKEN"
# Time: ~150-200ms

# Second request (cache hit, instant)
curl -X GET "http://localhost:3000/api/v1/profiles/search?q=young%20females%20in%20Nigeria" \
  -H "Authorization: Bearer $TOKEN"
# Time: <5ms

# Equivalent query with different syntax (should hit cache)
curl -X GET "http://localhost:3000/api/v1/profiles/search?q=women%20aged%2016-24%20in%20Nigeria" \
  -H "Authorization: Bearer $TOKEN"
# Time: <5ms (both map to same normalized filters)
```

### Test 2: Query Normalization

**Goal**: Verify equivalent queries produce identical cache keys

```javascript
// In browser console or Node.js
import { normalizeFilters, generateCacheKey } from "./services/cacheService.js";

const query1 = { gender: "FEMALE", min_age: "20", max_age: 45, country_id: "nigeria" };
const query2 = { gender: "female", min_age: 20, max_age: "45", country_id: "NG" };

const key1 = generateCacheKey(query1);
const key2 = generateCacheKey(query2);

console.log(key1 === key2);  // Should be: true ✓
```

### Test 3: CSV Upload - Valid File

**Goal**: Upload valid CSV and verify data insertion

**Create test file** (`test_profiles.csv`):
```csv
name,gender,age,country_id,country_name,gender_probability,country_probability
Amara Okafor,female,28,NG,Nigeria,0.92,0.75
James Smith,male,45,GB,United Kingdom,0.88,0.81
Maria Garcia,female,34,ES,Spain,0.95,0.70
```

**Upload**:
```bash
curl -X POST http://localhost:3000/api/v1/profiles/upload/csv \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test_profiles.csv"
```

**Expected Response**:
```json
{
  "status": "success",
  "total_rows": 3,
  "inserted": 3,
  "skipped": 0,
  "reasons": {}
}
```

### Test 4: CSV Upload - Invalid Rows

**Goal**: Verify validation and skipping of invalid rows

**Create test file** (`test_invalid.csv`):
```csv
name,gender,age,country_id,gender_probability
,female,28,NG,0.92
John Doe,invalid,25,NG,0.88
Jane Doe,female,abc,NG,0.95
Bob Smith,male,200,NG,0.90
```

**Upload**:
```bash
curl -X POST http://localhost:3000/api/v1/profiles/upload/csv \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test_invalid.csv"
```

**Expected Response**:
```json
{
  "status": "success",
  "total_rows": 4,
  "inserted": 0,
  "skipped": 4,
  "reasons": {
    "missing_fields": 1,
    "invalid_gender": 1,
    "invalid_age": 2
  }
}
```

### Test 5: CSV Upload - Duplicates

**Goal**: Verify deduplication

**Create test file** (`test_duplicates.csv`):
```csv
name,gender
Alice Brown,female
Bob Johnson,male
Alice Brown,female
```

**Upload**:
```bash
curl -X POST http://localhost:3000/api/v1/profiles/upload/csv \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test_duplicates.csv"
```

**Expected Response**:
```json
{
  "status": "success",
  "total_rows": 3,
  "inserted": 2,
  "skipped": 1,
  "reasons": {
    "duplicate_name": 1
  }
}
```

### Test 6: Cache Invalidation

**Goal**: Verify cache is cleared after data modification

```bash
# Get query (caches result)
curl -X GET "http://localhost:3000/api/v1/profiles/search?q=female" \
  -H "Authorization: Bearer $TOKEN"
# Time: ~150ms (cache miss, first query)

# Same query again
curl -X GET "http://localhost:3000/api/v1/profiles/search?q=female" \
  -H "Authorization: Bearer $TOKEN"
# Time: <5ms (cache hit)

# Upload new CSV
curl -X POST http://localhost:3000/api/v1/profiles/upload/csv \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@new_data.csv"

# Same query again (cache invalidated)
curl -X GET "http://localhost:3000/api/v1/profiles/search?q=female" \
  -H "Authorization: Bearer $TOKEN"
# Time: ~150ms (cache miss, data changed)
```

---

## Phase 3: Performance Testing

### Load Test: Query Caching

**Tools**: Apache JMeter, k6, or similar

**Test Script**:
```javascript
// k6 test
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 10,        // 10 concurrent users
  duration: '30s' // 30 seconds
};

export default function () {
  const query = 'young females in Nigeria';
  const url = `http://localhost:3000/api/v1/profiles/search?q=${encodeURIComponent(query)}`;
  
  const response = http.get(url, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 100ms': (r) => r.timings.duration < 100,
  });
}
```

**Expected Results**:
- First 10 requests: ~150-200ms (cache miss)
- Next 100+ requests: <5ms (cache hit)
- Overall P95 latency: <50ms

### Load Test: CSV Ingestion

**Scenario**: Upload 50k row file while running concurrent queries

**Expected Results**:
- CSV upload completes in <30 seconds
- API queries remain responsive (<100ms)
- No database connection pool exhaustion
- Partial success handling works

---

## Phase 4: Monitoring & Operations

### Monitor Cache Health

```javascript
// Add to monitoring/logging endpoint
import { getCacheStats } from "./services/cacheService.js";

app.get('/health/cache', (req, res) => {
  const stats = getCacheStats();
  res.json({
    status: 'healthy',
    cache: {
      entries: stats.keys,
      memory_bytes: stats.vsize,
      hit_rate: calculateHitRate() // Your implementation
    }
  });
});
```

### Monitor CSV Uploads

Track these metrics:
- Total files uploaded
- Success rate
- Average processing time
- Common skip reasons

```javascript
// Example: Log upload statistics
console.log({
  timestamp: new Date().toISOString(),
  total_rows: stats.total_rows,
  inserted: stats.inserted,
  skipped: stats.skipped,
  processing_time: Date.now() - startTime,
  file_size: file.size
});
```

### Database Monitoring

Track these queries:
- Query execution time (should decrease after caching)
- Connection pool utilization
- Lock times during CSV inserts

```sql
-- Check slow queries
SELECT * FROM pg_stat_statements 
WHERE mean_exec_time > 100 
ORDER BY mean_exec_time DESC;
```

---

## Phase 5: Troubleshooting

### Issue: Cache Not Working

**Diagnosis**:
```javascript
import { getCacheStats, generateCacheKey } from "./services/cacheService.js";

const filters = { gender: "female", country_id: "NG" };
const key = generateCacheKey(filters);
console.log(`Cache key: ${key}`);
console.log(`Cache stats:`, getCacheStats());
```

**Solutions**:
1. Check if filters are being normalized
2. Verify query parameters match expected values
3. Check cache TTL setting (currently 5 minutes)
4. Ensure cache isn't full (monitor memory usage)

### Issue: CSV Upload Fails

**Diagnosis Checklist**:
- [ ] File is valid CSV (not XLSX, JSON, etc.)
- [ ] File encoding is UTF-8
- [ ] File size < 100 MB
- [ ] Row count < 500k
- [ ] Required columns exist (`name`)
- [ ] Token is valid and has admin role
- [ ] Database connection is active

**Debug**:
```bash
# Check if file is valid CSV
head -n 5 file.csv

# Count rows
wc -l file.csv

# Check encoding
file -i file.csv
```

### Issue: High Skip Rate

**Analysis**:
```javascript
// Review reasons breakdown
const result = { skipped: 1000, reasons: {...} };
for (const [reason, count] of Object.entries(result.reasons)) {
  const percentage = (count / result.skipped * 100).toFixed(1);
  console.log(`${reason}: ${count} (${percentage}%)`);
}
```

**Common Causes**:
- Invalid country codes (use ISO 3166-1 alpha-2)
- Age outside 0-150 range
- Gender not exactly "male" or "female"
- Missing name field
- Duplicates in source data

### Issue: API Performance Degradation

**Check**:
```bash
# Monitor database connections
psql -c "SELECT * FROM pg_stat_activity;"

# Check cache memory usage
node -e "const cache = require('node-cache'); console.log(cache.getStats())"

# Monitor system resources
top
```

**Solutions**:
1. Clear cache if memory is high: `invalidateQueryCache()`
2. Increase connection pool: `pg.Pool({ max: 20 })`
3. Reduce cache TTL: `setCache(key, value, 60)` (1 minute)
4. Implement cache size limits
5. Switch to Redis for distributed caching

---

## Phase 6: Rollback Plan

If issues occur, rollback steps:

### Rollback Caching

1. Remove cache calls from `profileModel.js`
2. Change `SELECT column1, column2 ...` back to `SELECT *`
3. Remove `invalidateQueryCache()` calls
4. Restart server

### Rollback CSV Upload

1. Remove CSV endpoint from `profileRoutes.js`
2. Remove multer middleware from `app.js`
3. Remove CSV ingestion service
4. Restart server

### Rollback Dependencies

```bash
npm uninstall node-cache csv-parser multer
```

---

## Success Criteria

✅ **Phase 1 Complete**:
- All dependencies installed without errors
- Server starts successfully
- No console errors on startup

✅ **Phase 2 Complete**:
- Query caching works (repeated queries <5ms)
- Query normalization working (equivalent queries hit cache)
- CSV upload accepts valid files
- CSV upload rejects invalid rows
- Cache invalidation works after data modification

✅ **Phase 3 Complete**:
- Query response time improved 95%+ under cache hits
- CSV upload handles 50k rows in <30 seconds
- API responsive during CSV processing

✅ **Phase 4 Complete**:
- Cache metrics available
- Upload statistics tracked
- Database performance monitored

---

## Documentation Location

- **Main Guide**: [`OPTIMIZATION_GUIDE.md`](./OPTIMIZATION_GUIDE.md)
- **API Docs**: [`CSV_UPLOAD_API.md`](./CSV_UPLOAD_API.md)
- **This File**: `IMPLEMENTATION_CHECKLIST.md`

---

## Quick Reference

### Key Files

| File | Purpose |
|------|---------|
| `services/cacheService.js` | Query caching & normalization |
| `services/csvIngestionService.js` | CSV streaming & batch inserts |
| `models/profileModel.js` | Updated with caching |
| `controllers/profileController.js` | CSV upload handler |
| `routes/profileRoutes.js` | New CSV endpoint |
| `app.js` | Multer configuration |

### Key Functions

| Function | Purpose |
|----------|---------|
| `normalizeFilters(filters)` | Normalize query filters |
| `generateCacheKey(filters)` | Create deterministic cache key |
| `getCache(key)` / `setCache(key, value)` | Get/set cached value |
| `invalidateQueryCache()` | Clear query cache |
| `processCSVStream(stream)` | Process CSV file |
| `uploadProfilesCSV(req, res)` | CSV upload endpoint |

### Configuration Constants

```javascript
// Cache TTL (5 minutes)
const TTL = 300;

// CSV batch size (500 rows)
const BATCH_SIZE = 500;

// Max file size (100 MB)
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Max rows per file (500k)
const MAX_ROWS = 500000;
```

---

**Version**: 1.0.0  
**Status**: Ready for Production  
**Support**: Check OPTIMIZATION_GUIDE.md for detailed documentation
