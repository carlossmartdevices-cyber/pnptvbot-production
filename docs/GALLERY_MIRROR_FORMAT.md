# PNPtv Gallery - Enhanced Mirror Format

## Overview

When users post media (photos, videos, GIFs) in the general chat, it automatically mirrors to **PNPtv Gallery!** with rich profile information.

---

## Mirror Caption Format

### Example 1: User with Full Profile

```
📸 **Shared Media**

👤 **John Doe** (@johndoe)
📝 Music lover 🎵 | Travel enthusiast ✈️ | Photography 📸
🔗 [View Profile](https://t.me/PNPtvbot?start=profile_123456789)

💬 Check out this amazing sunset from my trip to Bali!

───────────────
```

### Example 2: User with Name Only (No Bio)

```
📸 **Shared Media**

👤 **Maria Garcia** (@mariagarcia)
🔗 [View Profile](https://t.me/PNPtvbot?start=profile_987654321)

💬 My latest creation! What do you think?

───────────────
```

### Example 3: User Without Username

```
📸 **Shared Media**

👤 **Alex Smith**
📝 Tech enthusiast | Developer | Coffee addict ☕
🔗 [View Profile](https://t.me/PNPtvbot?start=profile_555444333)

───────────────
```

### Example 4: Media Without Caption

```
📸 **Shared Media**

👤 **Sarah Wilson** (@sarahwilson)
📝 Artist | Painter | Creative soul 🎨
🔗 [View Profile](https://t.me/PNPtvbot?start=profile_111222333)

───────────────
```

---

## Profile Information Included

### Always Shown:
- 👤 **Display Name** - User's first name or username
- 🔗 **Profile Link** - Clickable deep link to full PNPtv profile

### Conditionally Shown:
- **@username** - Shown in parentheses if user has a Telegram username
- 📝 **Bio** - Shown if user has set a bio in their PNPtv profile
- 💬 **Caption** - Original caption from the media (if provided)

---

## Technical Details

### Profile Data Source

The mirror fetches profile data from the `users` table in PostgreSQL:

```sql
SELECT
  id,
  username,
  first_name,
  last_name,
  bio,
  photo_file_id
FROM users
WHERE id = $1;
```

### Deep Link Format

Profile links use Telegram's deep linking feature:

```
https://t.me/{BOT_USERNAME}?start=profile_{USER_ID}
```

Example: `https://t.me/PNPtvbot?start=profile_123456789`

When clicked:
1. Opens the bot in Telegram
2. Starts the bot with parameter `profile_123456789`
3. Bot shows the user's full profile with:
   - Profile photo
   - Bio
   - Interests
   - Stats
   - Subscription tier
   - Badges

---

## Configuration

### Current Gallery Settings

```javascript
{
  topic_id: 3132,
  topic_name: 'PNPtv Gallery!',
  auto_mirror_enabled: true,        // ✅ Auto-mirror ON
  mirror_from_general: true,        // ✅ Mirror from general chat
  enable_leaderboard: true,         // ✅ Track in leaderboard
  track_posts: true,                // ✅ Analytics enabled
  media_required: true              // ✅ Media-only enforcement
}
```

---

## User Privacy

Users can control what information appears in their profile via privacy settings:

```javascript
privacy: {
  showBio: true,          // Show bio in profile/mirrors
  showOnline: true,       // Show online status
  showLocation: true,     // Show location
  allowMessages: true,    // Allow DMs
  showInterests: true     // Show interests
}
```

If `showBio: false`, the bio will not appear in mirror captions.

---

## Analytics Tracking

Each mirrored media post tracks:
- **Total posts** - Incremented for user
- **Total media shared** - Incremented for user
- **Topic ID** - Associated with Gallery (3132)
- **Username** - For leaderboard display

View with:
```bash
psql -c "SELECT * FROM topic_analytics WHERE topic_id = 3132 ORDER BY total_media_shared DESC LIMIT 10;"
```

---

## Fallback Behavior

If profile fetch fails:
- Falls back to basic username/name from Telegram
- Format: `👤 @username` or `👤 FirstName`
- No bio or profile link shown
- Media still mirrors successfully

---

## Benefits

1. **User Recognition** - Members can see who shared the media
2. **Profile Discovery** - Easy access to full user profiles
3. **Context** - Bios provide personality/context
4. **Engagement** - Clickable profiles increase interaction
5. **Credit** - Proper attribution to content creators
6. **Community Building** - Learn more about fellow members

---

## Example Use Cases

### Photographer
```
👤 **Elena Rodriguez** (@elenaphoto)
📝 Professional photographer 📷 | Nature & Wildlife | Available for bookings
🔗 [View Profile](https://t.me/PNPtvbot?start=profile_...)

💬 Captured this eagle at sunrise! Shot with Sony A7III
```

### Artist
```
👤 **Marcus Lee** (@marcusart)
📝 Digital artist | NFT creator | Commissions open 🎨
🔗 [View Profile](https://t.me/PNPtvbot?start=profile_...)

💬 New artwork! Inspired by cyberpunk aesthetics
```

### Traveler
```
👤 **Isabella Santos** (@bella_travels)
📝 World traveler ✈️ | 47 countries | Travel blogger
🔗 [View Profile](https://t.me/PNPtvbot?start=profile_...)

💬 Santorini sunset - bucket list moment! 🌅
```

---

## Implementation

**File:** `src/bot/core/middleware/mediaMirror.js`

**Key Function:** `mediaMirrorMiddleware()`

**Process:**
1. Detect media in general chat
2. Fetch user profile from database
3. Build rich caption with profile info
4. Mirror to Gallery topic with attribution
5. Track analytics for leaderboard
6. Continue processing original message

---

## Testing

### Test the Mirror Feature

1. **Post media in general chat:**
   - Photo with caption
   - Video without caption
   - GIF with emoji

2. **Check Gallery topic:**
   - Media should appear immediately
   - Profile info should be formatted correctly
   - Bio should show if user has one
   - Profile link should be clickable

3. **Click profile link:**
   - Should open bot
   - Should show user's full profile
   - Should include all profile details

---

## Updates & Customization

To customize the mirror format, edit:

```javascript
// src/bot/core/middleware/mediaMirror.js

let mirrorCaption = '📸 **Shared Media**\n\n';
mirrorCaption += profileInfo;
if (caption && caption.trim()) {
  mirrorCaption += `\n\n💬 ${caption.trim()}`;
}
mirrorCaption += '\n\n───────────────';
```

Possible customizations:
- Change emoji icons
- Modify separator style
- Add timestamps
- Include media type indicator
- Add reaction prompts
- Include user stats/badges
