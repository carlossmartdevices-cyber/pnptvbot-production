# Photo System Implementation Guide

## Overview

Complete photo management system with:
- Admin photo gallery (50MB max per photo, unlimited uploads)
- User post photos (10MB max, 5 photos per post)
- Automatic thumbnail generation and image compression
- Photo statistics and audit logging
- Storage quota management per user role
- Drag-drop upload with progress tracking

## Database Setup

Run the migration to create all tables and indexes:

```bash
psql -U postgres -d pnptv_db -f /root/pnptvbot-production/database/migrations/060_photo_system.sql
```

This creates:
- `photos` - Main photos table with metadata
- `photo_categories` - Category definitions (gallery, featured, events, promotions)
- `photo_activity_log` - Audit trail for all photo operations
- `user_photo_stats` - Per-user upload statistics
- `photo_storage_limits` - Role-based storage quotas

## Backend Setup

### 1. Verify Required Packages

```bash
cd /root/pnptvbot-production
npm ls sharp uuid fs-extra
```

If missing:
```bash
npm install sharp uuid fs-extra
```

### 2. Create Photo Directories

The system automatically creates these on first upload:
```
public/photos/
├── admin/
│   ├── originals/      # Full-resolution admin photos
│   └── thumbnails/     # Optimized thumbnails
├── user-posts/         # User photos for posts
│   ├── originals/
│   └── thumbnails/
```

### 3. Environment Configuration (optional)

Add these to .env.production if you want custom settings:

```env
# Photo upload limits (in MB)
PHOTO_ADMIN_MAX_SIZE=50
PHOTO_USER_MAX_SIZE=10

# Compression settings
PHOTO_THUMBNAIL_SIZE=200
PHOTO_COMPRESSION_QUALITY=80
```

### 4. Start the Server

```bash
npm start
# or with PM2:
pm2 start ecosystem.config.js
```

The API endpoints will be automatically available at:
- Admin: `/api/admin/photos/*`
- Users: `/api/photos/*` and `/api/posts/:postId/photos/*`

## Frontend Setup

### 1. Admin Photo Gallery

Access at `/admin/photos` (requires admin role)

Features:
- Drag-drop upload
- Grid/list view toggle
- Search and filter by category
- Batch delete operations
- Edit metadata (caption, category)
- Statistics dashboard (total photos, storage used, contributors)

### 2. User Photo Components

Three components available for integration:

#### PhotoUploadButton
```jsx
import PhotoUploadButton from './components/PhotoUploadButton';

<PhotoUploadButton
  onPhotosSelected={(files) => handlePhotosSelected(files)}
  disabled={false}
  maxPhotos={5}
/>
```

#### PhotoPreview
```jsx
import PhotoPreview from './components/PhotoPreview';

<PhotoPreview
  photos={selectedPhotos}
  onRemove={(index) => removePhoto(index)}
  onReorder={(photos) => reorderPhotos(photos)}
/>
```

#### PhotoGalleryInPost
```jsx
import PhotoGalleryInPost from './components/PhotoGalleryInPost';

<PhotoGalleryInPost
  photos={post.photos}
  onDeletePhoto={(photoId) => deletePhoto(photoId)}
  editable={isOwnPost}
/>
```

## API Endpoints

### Admin Photo Management

#### Upload Photo
```bash
POST /api/admin/photos/upload
Content-Type: multipart/form-data

file: <binary>
caption: "Photo title"
category: "gallery|featured|events|promotions"
```

Response:
```json
{
  "success": true,
  "photo": {
    "id": "uuid",
    "file_path": "/photos/admin/originals/...",
    "thumbnail_path": "/photos/admin/thumbnails/...",
    "width": 1920,
    "height": 1080,
    "file_size": 524288,
    "category": "gallery",
    "created_at": "2026-02-19T..."
  }
}
```

#### List Photos
```bash
GET /api/admin/photos/list?category=gallery&search=sunset&limit=50&offset=0&sortBy=created_at&sortOrder=DESC
```

Response:
```json
{
  "success": true,
  "photos": [...],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

#### Get Photo Details
```bash
GET /api/admin/photos/{photoId}
```

#### Update Photo
```bash
PUT /api/admin/photos/{photoId}
Content-Type: application/json

{
  "caption": "New title",
  "category": "featured"
}
```

#### Delete Photo
```bash
DELETE /api/admin/photos/{photoId}
```

#### Get Statistics
```bash
GET /api/admin/photos/stats
```

Response:
```json
{
  "success": true,
  "stats": {
    "overall": {
      "total_photos": 1250,
      "total_storage_bytes": 5368709120,
      "avg_width": 1920,
      "avg_height": 1080,
      "categories": 5,
      "contributors": 45
    },
    "admin": {
      "count": 800,
      "size": 3221225472
    },
    "userPosts": {
      "count": 450,
      "size": 2147483648
    },
    "byCategory": [...]
  }
}
```

#### Batch Delete
```bash
POST /api/admin/photos/batch/delete
Content-Type: application/json

{
  "photoIds": ["id1", "id2", "id3"]
}
```

### User Photo Management

#### Upload Photo (Temporary)
```bash
POST /api/photos/upload
Content-Type: multipart/form-data

file: <binary>
caption: "Photo description" (optional)
```

Response:
```json
{
  "success": true,
  "photo": {
    "id": "uuid",
    "file_path": "/photos/user-posts/originals/...",
    "thumbnail_path": "/photos/user-posts/thumbnails/...",
    "width": 1080,
    "height": 1080,
    "file_size": 262144
  }
}
```

#### Get User Photo Stats
```bash
GET /api/photos/stats
```

Response:
```json
{
  "success": true,
  "stats": {
    "total_photos": 42,
    "total_size_bytes": 104857600,
    "photos_this_month": 8,
    "last_upload_at": "2026-02-19T..."
  },
  "limits": {
    "maxFileSize": 10485760,
    "maxFilesPerMonth": 10,
    "maxTotalStorage": 524288000,
    "maxFilesPerPost": 5
  }
}
```

#### Get Post Photos
```bash
GET /api/posts/{postId}/photos
```

#### Update Photo Caption
```bash
PUT /api/posts/{postId}/photos/{photoId}
Content-Type: application/json

{
  "caption": "Updated caption"
}
```

#### Delete Photo from Post
```bash
DELETE /api/posts/{postId}/photos/{photoId}
```

#### Reorder Post Photos
```bash
PUT /api/posts/{postId}/photos/reorder
Content-Type: application/json

{
  "photoIds": ["id1", "id2", "id3", "id4", "id5"]
}
```

## Integration Examples

### Adding Photos to Social Posts

```jsx
import PhotoUploadButton from './components/PhotoUploadButton';
import PhotoPreview from './components/PhotoPreview';
import { uploadPhotoForPost, createPost } from './api/client';

export function PostComposer() {
  const [content, setContent] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [uploadedPhotos, setUploadedPhotos] = useState([]);

  const handlePhotosSelected = async (files) => {
    setSelectedPhotos(Array.from(files));
  };

  const handlePublish = async () => {
    let photoIds = [];

    // Upload photos first
    if (selectedPhotos.length > 0) {
      for (const file of selectedPhotos) {
        const formData = new FormData();
        formData.append('file', file);
        try {
          const result = await uploadPhotoForPost(formData);
          photoIds.push(result.photo.id);
        } catch (err) {
          console.error('Photo upload failed:', err);
        }
      }
    }

    // Create post with photos
    const post = await createPost({
      content,
      photoIds,
    });

    setContent('');
    setSelectedPhotos([]);
    setUploadedPhotos([]);
  };

  return (
    <div>
      <textarea value={content} onChange={(e) => setContent(e.target.value)} />
      <PhotoUploadButton onPhotosSelected={handlePhotosSelected} maxPhotos={5} />
      <PhotoPreview
        photos={selectedPhotos}
        onRemove={(index) => {
          setSelectedPhotos(selectedPhotos.filter((_, i) => i !== index));
        }}
        onReorder={setSelectedPhotos}
      />
      <button onClick={handlePublish}>Publish</button>
    </div>
  );
}
```

### Displaying Photos in Feed

```jsx
import PhotoGalleryInPost from './components/PhotoGalleryInPost';

export function PostCard({ post }) {
  const handleDeletePhoto = async (photoId) => {
    await deletePostPhoto(post.id, photoId);
    // Refresh post
  };

  return (
    <div className="post">
      <p>{post.content}</p>
      <PhotoGalleryInPost
        photos={post.photos || []}
        onDeletePhoto={post.user_id === currentUser.id ? handleDeletePhoto : null}
        editable={post.user_id === currentUser.id}
      />
    </div>
  );
}
```

## Testing

### Test Admin Upload (curl)
```bash
curl -X POST http://localhost:3001/api/admin/photos/upload \
  -H "Cookie: connect.sid=your-session-cookie" \
  -F "file=@/path/to/image.jpg" \
  -F "caption=Test Photo" \
  -F "category=gallery"
```

### Test User Upload
```bash
curl -X POST http://localhost:3001/api/photos/upload \
  -H "Cookie: connect.sid=your-session-cookie" \
  -F "file=@/path/to/image.jpg"
```

### Test List Admin Photos
```bash
curl -X GET "http://localhost:3001/api/admin/photos/list?category=gallery&limit=10" \
  -H "Cookie: connect.sid=your-session-cookie"
```

### Test Statistics
```bash
curl -X GET http://localhost:3001/api/admin/photos/stats \
  -H "Cookie: connect.sid=your-session-cookie"
```

## Storage Limits by Role

Default limits can be modified in the `photo_storage_limits` table:

| Role | Max File Size | Files/Month | Total Storage | Per Post |
|------|---------------|-------------|---------------|----------|
| user | 10 MB | 10 | 500 MB | 5 |
| creator | 25 MB | 50 | 2 GB | 10 |
| model | 50 MB | 100 | 5 GB | 10 |
| admin | 50 MB | 999 | 99 GB | 999 |
| superadmin | 50 MB | 999 | 99 GB | 999 |

Update limits:
```sql
UPDATE photo_storage_limits
SET max_file_size_mb = 20, max_files_per_month = 20, max_total_storage_mb = 1000
WHERE role = 'creator';
```

## Troubleshooting

### Photos not saving
- Check `/public/photos/` directory exists and is writable
- Verify file permissions: `chmod -R 755 public/photos/`
- Check disk space: `df -h`

### Upload fails with size error
- Verify Express body parser limit matches photo size
- Check in routes.js: `app.use(express.json({ limit: '50mb' }))`

### Thumbnails not generating
- Verify sharp is installed: `npm ls sharp`
- Check Node.js memory: `node --max_old_space_size=2048`

### Session authentication fails
- Verify Redis is running: `redis-cli ping`
- Check SESSION_SECRET is set in .env
- Verify cookies are being sent with requests

## Performance Optimization

### Enable caching
```bash
# Cache photos for 30 days
curl -X PUT http://localhost:3001/api/admin/photos/cache \
  -H "Content-Type: application/json" \
  -d '{"maxAge": 2592000}'
```

### Pregenerate thumbnails (background job)
```javascript
// In your cron job or worker:
const photos = await PhotoService.getAdminPhotos({ limit: 1000 });
for (const photo of photos) {
  await PhotoService.generateThumbnail(photo.id);
}
```

## Production Deployment Checklist

- [ ] Database migration applied
- [ ] `/public/photos/` directory created with proper permissions
- [ ] Sharp installed and verified
- [ ] Admin users can access `/admin/photos`
- [ ] Test admin upload with multiple formats
- [ ] Test user upload within quota limits
- [ ] Verify storage quota enforcement
- [ ] Check Redis session store is working
- [ ] Monitor disk space and cleanup old photos
- [ ] Set up monitoring/alerting for failed uploads
- [ ] Test batch delete operations
- [ ] Verify audit logging is working

## Support

For issues or questions about the photo system:
1. Check the logs: `pm2 logs bot`
2. Review photo_activity_log table for audit trail
3. Check user_photo_stats for quota information
4. Verify database migrations: `psql -U postgres -d pnptv_db -c "SELECT * FROM photo_storage_limits;"`
