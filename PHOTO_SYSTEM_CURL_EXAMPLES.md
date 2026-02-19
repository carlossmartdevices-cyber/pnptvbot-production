# Photo System API - CURL Examples

## Prerequisites

First, get your session cookie by logging in:

```bash
curl -X POST http://localhost:3001/api/webapp/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123"
  }' \
  -c cookies.txt

# Extract the session cookie:
COOKIE=$(grep connect.sid cookies.txt | awk '{print $7}')
```

## Admin Photo Operations

### 1. Upload Admin Photo

```bash
curl -X POST http://localhost:3001/api/admin/photos/upload \
  -H "Cookie: connect.sid=$COOKIE" \
  -F "file=@/path/to/photo.jpg" \
  -F "caption=Beautiful Sunset" \
  -F "category=featured"
```

Example with test image:
```bash
# Create a test image
convert -size 1920x1080 xc:blue /tmp/test.jpg

curl -X POST http://localhost:3001/api/admin/photos/upload \
  -H "Cookie: connect.sid=$COOKIE" \
  -F "file=@/tmp/test.jpg" \
  -F "caption=Test Photo" \
  -F "category=gallery"
```

### 2. List Admin Photos with Filters

```bash
# List all admin photos
curl -X GET "http://localhost:3001/api/admin/photos/list" \
  -H "Cookie: connect.sid=$COOKIE"

# List featured photos only
curl -X GET "http://localhost:3001/api/admin/photos/list?category=featured" \
  -H "Cookie: connect.sid=$COOKIE"

# Search for photos
curl -X GET "http://localhost:3001/api/admin/photos/list?search=sunset" \
  -H "Cookie: connect.sid=$COOKIE"

# List with pagination
curl -X GET "http://localhost:3001/api/admin/photos/list?limit=20&offset=40" \
  -H "Cookie: connect.sid=$COOKIE"

# Sort by file size (descending)
curl -X GET "http://localhost:3001/api/admin/photos/list?sortBy=file_size&sortOrder=DESC" \
  -H "Cookie: connect.sid=$COOKIE"

# Combined filters
curl -X GET "http://localhost:3001/api/admin/photos/list?category=events&search=conference&limit=50&sortBy=created_at&sortOrder=DESC" \
  -H "Cookie: connect.sid=$COOKIE"
```

### 3. Get Photo Details

```bash
curl -X GET "http://localhost:3001/api/admin/photos/PHOTO_ID" \
  -H "Cookie: connect.sid=$COOKIE"
```

### 4. Update Photo Metadata

```bash
curl -X PUT http://localhost:3001/api/admin/photos/PHOTO_ID \
  -H "Cookie: connect.sid=$COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "caption": "Updated Title",
    "category": "promotions"
  }'
```

### 5. Delete Single Photo

```bash
curl -X DELETE http://localhost:3001/api/admin/photos/PHOTO_ID \
  -H "Cookie: connect.sid=$COOKIE"
```

### 6. Batch Delete Photos

```bash
curl -X POST http://localhost:3001/api/admin/photos/batch/delete \
  -H "Cookie: connect.sid=$COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "photoIds": ["id1", "id2", "id3"]
  }'
```

### 7. Get Photo Statistics

```bash
curl -X GET http://localhost:3001/api/admin/photos/stats \
  -H "Cookie: connect.sid=$COOKIE" | jq .
```

## User Photo Operations

### 1. Upload Photo for Post

```bash
curl -X POST http://localhost:3001/api/photos/upload \
  -H "Cookie: connect.sid=$COOKIE" \
  -F "file=@/path/to/photo.jpg" \
  -F "caption=My awesome photo"

# Example
curl -X POST http://localhost:3001/api/photos/upload \
  -H "Cookie: connect.sid=$COOKIE" \
  -F "file=@/tmp/test.jpg" \
  -F "caption=Check this out"
```

### 2. Get User Photo Stats

```bash
curl -X GET http://localhost:3001/api/photos/stats \
  -H "Cookie: connect.sid=$COOKIE" | jq .
```

### 3. Get Photos in Post

```bash
curl -X GET "http://localhost:3001/api/posts/POST_ID/photos" \
  -H "Cookie: connect.sid=$COOKIE"
```

### 4. Update Photo Caption

```bash
curl -X PUT "http://localhost:3001/api/posts/POST_ID/photos/PHOTO_ID" \
  -H "Cookie: connect.sid=$COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "caption": "New caption text"
  }'
```

### 5. Delete Photo from Post

```bash
curl -X DELETE "http://localhost:3001/api/posts/POST_ID/photos/PHOTO_ID" \
  -H "Cookie: connect.sid=$COOKIE"
```

### 6. Reorder Photos in Post

```bash
curl -X PUT "http://localhost:3001/api/posts/POST_ID/photos/reorder" \
  -H "Cookie: connect.sid=$COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "photoIds": ["photo1_id", "photo2_id", "photo3_id", "photo4_id", "photo5_id"]
  }'
```

## Test Scenarios

### Scenario 1: Upload Multiple Photos as Admin

```bash
#!/bin/bash

# Create test images
for i in {1..5}; do
  convert -size 1920x1080 xc:rgb\(100,$((i*50)),200\) /tmp/test$i.jpg
done

# Upload all
for i in {1..5}; do
  curl -X POST http://localhost:3001/api/admin/photos/upload \
    -H "Cookie: connect.sid=$COOKIE" \
    -F "file=@/tmp/test$i.jpg" \
    -F "caption=Test Photo $i" \
    -F "category=gallery" \
    && echo "Photo $i uploaded"
done
```

### Scenario 2: User uploads photos and creates post

```bash
#!/bin/bash

# Upload photos
PHOTO_IDS=()
for file in /path/to/photos/*.jpg; do
  response=$(curl -s -X POST http://localhost:3001/api/photos/upload \
    -H "Cookie: connect.sid=$COOKIE" \
    -F "file=@$file")

  photo_id=$(echo $response | jq -r '.photo.id')
  PHOTO_IDS+=($photo_id)
done

# Create post with photos
curl -X POST http://localhost:3001/api/posts/with-photos \
  -H "Cookie: connect.sid=$COOKIE" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"Check out these photos!\",
    \"photoIds\": [$(printf '%s,' \"${PHOTO_IDS[@]}\" | sed 's/,$//')]
  }"
```

### Scenario 3: Admin reviews and organizes photos

```bash
# Get all photos
curl -s -X GET "http://localhost:3001/api/admin/photos/list?limit=100" \
  -H "Cookie: connect.sid=$COOKIE" | jq '.photos[] | {id, caption, category, created_at}' > photos.json

# Move photos to featured
while read line; do
  id=$(echo $line | jq -r '.id')
  curl -X PUT http://localhost:3001/api/admin/photos/$id \
    -H "Cookie: connect.sid=$COOKIE" \
    -H "Content-Type: application/json" \
    -d '{"category": "featured"}'
done < photos.json
```

### Scenario 4: Test storage limits

```bash
# Check user stats
curl -s -X GET http://localhost:3001/api/photos/stats \
  -H "Cookie: connect.sid=$COOKIE" | jq '.limits'

# Try to upload file larger than limit (should fail)
dd if=/dev/urandom of=/tmp/large.bin bs=1M count=15

curl -X POST http://localhost:3001/api/photos/upload \
  -H "Cookie: connect.sid=$COOKIE" \
  -F "file=@/tmp/large.bin" \
  -w "\nStatus: %{http_code}\n"
```

## Response Examples

### Success Response
```json
{
  "success": true,
  "photo": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "file_path": "/photos/admin/originals/550e8400-e29b-41d4-a716-446655440000.webp",
    "thumbnail_path": "/photos/admin/thumbnails/550e8400-e29b-41d4-a716-446655440000.webp",
    "original_filename": "sunset.jpg",
    "file_size": 524288,
    "mime_type": "image/jpeg",
    "width": 1920,
    "height": 1080,
    "caption": "Beautiful Sunset",
    "category": "featured",
    "is_admin_photo": true,
    "created_at": "2026-02-19T15:30:00Z",
    "updated_at": "2026-02-19T15:30:00Z"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "File too large: 15.50MB. Max: 10.00MB"
}
```

### List Response
```json
{
  "success": true,
  "photos": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "caption": "Sunset",
      "category": "featured",
      "file_size": 524288,
      "width": 1920,
      "height": 1080,
      "created_at": "2026-02-19T15:30:00Z"
    }
  ],
  "total": 1250,
  "limit": 50,
  "offset": 0
}
```

## Debugging Tips

### Pretty print JSON
```bash
curl ... | jq .
```

### Save response to file
```bash
curl -X GET http://localhost:3001/api/admin/photos/stats \
  -H "Cookie: connect.sid=$COOKIE" \
  -o response.json
```

### Check response headers
```bash
curl -i -X GET http://localhost:3001/api/admin/photos/stats \
  -H "Cookie: connect.sid=$COOKIE"
```

### Verbose output (show all requests/responses)
```bash
curl -v -X GET http://localhost:3001/api/admin/photos/stats \
  -H "Cookie: connect.sid=$COOKIE"
```

### Time the request
```bash
curl -w "Total time: %{time_total}s\n" \
  -X GET http://localhost:3001/api/admin/photos/stats \
  -H "Cookie: connect.sid=$COOKIE"
```

## Error Codes

| Code | Error | Solution |
|------|-------|----------|
| 400 | No file uploaded | Include file in multipart form |
| 400 | Invalid file type | Use JPEG, PNG, GIF, or WebP |
| 400 | File too large | Reduce file size or check limits |
| 401 | Not authenticated | Get valid session cookie |
| 403 | Admin access required | Use admin account |
| 404 | Photo not found | Check photo ID is correct |
| 413 | Payload too large | Increase Express body limit |
| 500 | Server error | Check server logs: `pm2 logs` |

## Performance Benchmarks

Expected response times on modern hardware:

| Operation | Time |
|-----------|------|
| Upload 5MB photo | ~500ms |
| Generate thumbnail | ~200ms |
| List 50 photos | ~100ms |
| Search 1000 photos | ~150ms |
| Delete photo | ~50ms |
| Batch delete 100 photos | ~500ms |

## Load Testing

Simple load test with Apache Bench:

```bash
# Get a valid session first
COOKIE=$(grep connect.sid cookies.txt | awk '{print $7}')

# Load test list endpoint (100 requests, 10 concurrent)
ab -n 100 -c 10 \
  -H "Cookie: connect.sid=$COOKIE" \
  http://localhost:3001/api/admin/photos/list?limit=50
```
