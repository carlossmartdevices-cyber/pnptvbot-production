# Firestore Index Fix

## Problem

The application is encountering a Firestore error when querying upcoming private calls:

```
Error getting upcoming calls: 9 FAILED_PRECONDITION: The query requires an index.
```

## Root Cause

The query in `src/models/callModel.js:213-221` performs a compound query on the `privateCalls` collection:

```javascript
const snapshot = await db.collection(COLLECTION)
  .where('status', 'in', ['pending', 'confirmed'])
  .where('scheduledDate', '>=', fromDate)
  .orderBy('scheduledDate', 'asc')
  .limit(50)
  .get();
```

This query requires a composite index on:
- `status` (ASCENDING)
- `scheduledDate` (ASCENDING)

## Solution

### Option 1: Create Index via Firebase Console (Quick Fix)

Click this link to create the index automatically:

[Create Composite Index](https://console.firebase.google.com/v1/r/project/pnptv-b8af8/firestore/indexes?create_composite=ClBwcm9qZWN0cy9wbnB0di1iOGFmOC9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvcHJpdmF0ZUNhbGxzL2luZGV4ZXMvXxABGgoKBnN0YXR1cxABGhEKDXNjaGVkdWxlZERhdGUQARoMCghfX25hbWVfXxAB)

Steps:
1. Click the link above
2. Review the index configuration
3. Click "Create Index"
4. Wait for the index to build (usually takes a few minutes)

### Option 2: Deploy via Firebase CLI (Recommended for Production)

If you want to manage indexes via code:

1. Install Firebase CLI (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase (if not already done):
   ```bash
   firebase init firestore
   ```
   - Select your project: `pnptv-b8af8`
   - Use the existing `firestore.indexes.json` file

4. Deploy the indexes:
   ```bash
   firebase deploy --only firestore:indexes
   ```

5. Wait for deployment to complete

## Index Configuration

The required index has been defined in `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "privateCalls",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "scheduledDate",
          "order": "ASCENDING"
        }
      ]
    }
  ]
}
```

## Verification

After creating the index, verify it's working:

1. Wait 2-5 minutes for the index to build
2. Check the index status in Firebase Console:
   - Go to Firestore Database > Indexes
   - Look for the `privateCalls` index
   - Status should show "Enabled" (green)

3. Restart your application:
   ```bash
   docker-compose restart
   ```

4. Monitor the logs for the error:
   ```bash
   docker-compose logs -f pnptv-bot
   ```

The "Error getting upcoming calls" message should no longer appear.

## Additional Notes

- Firestore indexes are region-specific and persist across deployments
- Once created via console, the index will remain even if you redeploy your application
- For future index needs, always define them in `firestore.indexes.json` for version control
- Building an index can take several minutes depending on data volume

## Related Files

- Query implementation: `src/models/callModel.js:213-221`
- Service layer: `src/bot/services/callService.js:264-270`
- Index configuration: `firestore.indexes.json`
